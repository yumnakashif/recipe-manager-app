"use client";

import useSWR from "swr";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Plus } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

async function fetcher([url, token]: [string, string | null]) {
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function LibraryPage() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Inline tag adding state
  const [addingTagId, setAddingTagId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setSessionToken(session.access_token);
      }
      setCheckingAuth(false);
    });
  }, [router]);

  useEffect(() => {
    if (addingTagId && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [addingTagId]);

  const { data, error, isLoading, mutate } = useSWR(
    sessionToken ? [`${API_BASE}/recipes`, sessionToken] : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const filteredRecipes = data?.filter((r: any) => {
    if (!searchTerm.trim()) return true;
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.every(term => {
      if (term.startsWith('#')) {
        const tagToMatch = term.substring(1);
        if (!tagToMatch) return true;
        return r.tags?.some((t: string) => t.toLowerCase().includes(tagToMatch));
      } else {
        return r.title?.toLowerCase().includes(term);
      }
    });
  });

  const handleAddTag = async (recipe: any, overrideTag?: string) => {
    const newTag = (overrideTag ?? tagInput).trim();
    if (!newTag) { setAddingTagId(null); return; }
    const existingTags: string[] = recipe.tags || [];
    if (existingTags.map((t: string) => t.toLowerCase()).includes(newTag.toLowerCase())) {
      setTagInput("");
      setAddingTagId(null);
      return;
    }
    const updatedTags = [...existingTags, newTag];
    setTagInput("");
    setAddingTagId(null);

    // IMPORTANT: fetch the full recipe first so we don't overwrite ingredients/steps
    // The library list view only has summary fields, not full ingredient/step data
    try {
      const fullRes = await fetch(`${API_BASE}/recipes/${recipe.id}`, {
        headers: { ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {}) },
      });
      const fullRecipe = await fullRes.json();
      await fetch(`${API_BASE}/recipes/${recipe.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ ...fullRecipe, tags: updatedTags }),
      });
      mutate();
    } catch (e) {
      console.error("Failed to add tag", e);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 px-4 max-sm:px-3">
      <div className="flex justify-between items-center mb-6 max-sm:mb-4 gap-2">
        <h1 className="text-3xl max-sm:text-2xl font-bold text-primary">Recipe Library</h1>
        <div className="flex items-center gap-3 max-sm:gap-2 shrink-0">
          {isLoading && <span className="text-sm max-sm:text-xs font-medium text-slate-500 animate-pulse max-sm:hidden sm:inline">Loading...</span>}
          <button 
            onClick={() => mutate()} 
            className="px-4 py-2 max-sm:px-2.5 max-sm:py-1.5 bg-background-secondary border border-primary/20 text-text-secondary rounded-lg hover:bg-background hover:text-primary transition-colors shadow-sm text-sm max-sm:text-xs font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-8 max-sm:mb-6">
        <input 
          type="text"
          placeholder="Search recipes or use #tag..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 max-sm:px-3 max-sm:py-2 bg-background border border-primary/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 transition-all text-sm max-sm:text-xs"
        />
        <p className="mt-2 text-[10px] text-text-secondary/40 font-medium ml-1">
          Type <span className="text-primary/60 font-bold">#</span> to search by tags (e.g., #Dessert)
        </p>
      </div>
      
      {error && <div className="p-4 mb-6 bg-red-50 text-red-600 rounded-lg text-sm">Error loading recipes: {String(error)}</div>}

      {/* Backdrop to close dropdown when clicking outside */}
      {addingTagId && (
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => { setAddingTagId(null); setTagInput(""); }}
        />
      )}

      <div className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-sm:gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-background-secondary/50 rounded-2xl max-sm:rounded-xl h-64 max-sm:h-48 animate-pulse" />
            ))}
          </div>
        ) : !filteredRecipes || filteredRecipes.length === 0 ? (
          <div className="bg-background-secondary border border-primary/20 shadow-sm rounded-xl p-12 max-sm:p-6 text-center text-text-secondary">
            <p className="text-lg max-sm:text-base">No recipes found.</p>
            <p className="mt-2 text-sm italic opacity-60">
              {searchTerm ? "No match for your current search." : "Add your own recipe to get started!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-sm:gap-3">
            {filteredRecipes.map((r: any) => (
              <div key={r.id} className={`bg-background-secondary rounded-2xl max-sm:rounded-xl shadow-md border border-primary/10 flex flex-col group relative transition-all duration-300 max-sm:shadow-sm ${addingTagId === r.id ? 'shadow-xl z-[150]' : 'hover:shadow-xl max-sm:hover:shadow-md hover:-translate-y-1 max-sm:hover:translate-y-0'}`}>
                <Link href={`/library/${r.id}`} className="block relative aspect-video overflow-hidden bg-background rounded-t-2xl max-sm:rounded-t-xl">
                  {r.thumbnail_url ? (
                    <img src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-main/40 font-medium opacity-20">No Image</div>
                  )}
                </Link>
                <div className="p-5 max-sm:p-3 flex flex-col flex-1">
                  <Link href={`/library/${r.id}`} className="text-lg max-sm:text-base font-bold text-text-main hover:text-primary transition-colors line-clamp-2 mb-2 max-sm:mb-1">
                    {r.title || "Untitled Recipe"}
                  </Link>

                  {/* Tags + inline add */}
                  <div className="flex flex-wrap gap-1 max-sm:gap-0.5 mt-1 mb-3 max-sm:mb-2 relative">
                    {r.tags?.map((tag: string) => (
                      <span key={tag} className="text-[10px] font-bold bg-primary/5 text-primary/60 px-2 py-0.5 rounded-md border border-primary/10">
                        {tag}
                      </span>
                    ))}

                    {addingTagId === r.id ? (
                      <div className="absolute top-full left-0 z-[200] mt-1 w-52 bg-background border border-primary/20 rounded-xl shadow-xl overflow-hidden">
                        <input
                          ref={tagInputRef}
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTag(r);
                            if (e.key === 'Escape') { setAddingTagId(null); setTagInput(""); }
                          }}
                          placeholder="New tag..."
                          className="w-full px-3 py-2 text-xs font-medium text-primary bg-background outline-none border-b border-primary/10 placeholder:text-text-secondary/40"
                        />
                        {/* Existing tags to pick from */}
                        {(() => {
                          const allTags = Array.from(new Set(data?.flatMap((recipe: any) => recipe.tags || []) || [])) as string[];
                          const available = allTags.filter(t => !r.tags?.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()));
                          return available.length > 0 ? (
                            <div className="max-h-36 overflow-y-auto py-1">
                              {available.map((tag: string) => (
                                <button
                                  key={tag}
                                  onMouseDown={(e) => { e.preventDefault(); handleAddTag(r, tag); }}
                                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-primary/5 hover:text-primary transition-colors"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          ) : null;
                        })()}
                        <div className="flex justify-end px-3 py-1.5 border-t border-primary/5">
                          <button onMouseDown={() => { setAddingTagId(null); setTagInput(""); }} className="text-[10px] text-text-secondary/50 hover:text-text-secondary transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : null}

                    <button
                      onClick={(e) => { e.preventDefault(); setAddingTagId(addingTagId === r.id ? null : r.id); setTagInput(""); }}
                      className="text-[10px] font-bold text-primary/30 hover:text-primary/70 hover:bg-primary/5 px-1.5 py-0.5 rounded-md border border-dashed border-primary/15 hover:border-primary/30 transition-all flex items-center"
                      title="Add tag"
                    >
                      <Plus size={10} />
                    </button>
                  </div>

                  <div className="mt-auto pt-4 max-sm:pt-2 flex items-center justify-between border-t border-primary/5">
                    <span className="text-xs max-sm:text-[10px] font-medium text-text-main/30">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
