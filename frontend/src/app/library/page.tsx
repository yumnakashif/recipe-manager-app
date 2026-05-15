"use client";

import useSWR from "swr";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DeleteRecipeConfirmDialog } from "@/components/DeleteRecipeConfirmDialog";
import { ChevronLeft, ChevronRight, Eye, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
const PAGE_SIZE = 12;

type RecipeListItem = {
  id: string;
  title?: string;
  thumbnail_url?: string | null;
  created_at?: string;
  tags?: string[];
};

type RecipeListResponse = {
  items: RecipeListItem[];
  total: number;
  page: number;
  page_size: number;
};

function buildListUrl(page: number, search: string) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(PAGE_SIZE),
  });
  const q = search.trim();
  if (q) params.set("search", q);
  return `${API_BASE}/recipes?${params.toString()}`;
}

async function fetcher([url, token]: [string, string | null]): Promise<RecipeListResponse> {
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [addingTagId, setAddingTagId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecipeListItem | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
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

  useEffect(() => {
    if (!menuOpenId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpenId]);

  const listUrl =
    sessionToken != null ? buildListUrl(page, debouncedSearch) : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    sessionToken ? [listUrl, sessionToken] : null,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const recipes = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);
  const goNext = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const handleAddTag = async (recipe: RecipeListItem, overrideTag?: string) => {
    const newTag = (overrideTag ?? tagInput).trim();
    if (!newTag) {
      setAddingTagId(null);
      return;
    }
    const existingTags: string[] = recipe.tags || [];
    if (existingTags.map((t: string) => t.toLowerCase()).includes(newTag.toLowerCase())) {
      setTagInput("");
      setAddingTagId(null);
      return;
    }
    const updatedTags = [...existingTags, newTag];
    setTagInput("");
    setAddingTagId(null);

    try {
      const fullRes = await fetch(`${API_BASE}/recipes/${recipe.id}`, {
        headers: { ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
      });
      const fullRecipe = await fullRes.json();
      await fetch(`${API_BASE}/recipes/${recipe.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ ...fullRecipe, tags: updatedTags }),
      });
      mutate();
    } catch (e) {
      console.error("Failed to add tag", e);
    }
  };

  const handleViewRecipe = (id: string) => {
    setMenuOpenId(null);
    router.push(`/library/${id}`);
  };

  const handleEditRecipe = async (recipe: RecipeListItem) => {
    if (!sessionToken) return;
    setEditLoadingId(recipe.id);
    setMenuOpenId(null);
    try {
      const res = await fetch(`${API_BASE}/recipes/${recipe.id}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const full = await res.json();
      localStorage.setItem("editRecipe", JSON.stringify(full));
      router.push("/add");
    } catch {
      alert("Could not load recipe for editing.");
    } finally {
      setEditLoadingId(null);
    }
  };

  const performDeleteRecipe = async (recipe: RecipeListItem) => {
    if (!sessionToken) return;
    setMenuOpenId(null);
    const onlyItemOnPage = recipes.length === 1;
    try {
      const res = await fetch(`${API_BASE}/recipes/${recipe.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        alert("Failed to delete recipe.");
        return;
      }
      const updated = await mutate();
      if (onlyItemOnPage && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else if (
        updated &&
        updated.items.length === 0 &&
        updated.total > 0 &&
        page > 1
      ) {
        setPage((p) => Math.max(1, p - 1));
      }
    } catch {
      alert("Error deleting recipe.");
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const showSkeleton = isLoading && !data;
  const allTagsForPicker = Array.from(
    new Set(recipes.flatMap((recipe) => recipe.tags || []))
  ) as string[];

  return (
    <div className="max-w-4xl mx-auto pb-12 px-4 max-sm:px-3">
      <div className="flex justify-between items-center mb-6 max-sm:mb-4 gap-2">
        <h1 className="text-3xl max-sm:text-2xl font-bold text-primary">Recipe Library</h1>
        <div className="flex items-center gap-3 max-sm:gap-2 shrink-0">
          {(isLoading || isValidating) && (
            <span className="text-sm max-sm:text-xs font-medium text-slate-500 animate-pulse max-sm:hidden sm:inline">
              Loading...
            </span>
          )}
          <button
            type="button"
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
          Type <span className="text-primary/60 font-bold">#</span> to search by tags (e.g., #Dessert). Results update after you pause typing.
        </p>
      </div>

      {error && (
        <div className="p-4 mb-6 bg-red-50 text-red-600 rounded-lg text-sm">
          Error loading recipes: {String(error)}
        </div>
      )}

      {addingTagId && (
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => {
            setAddingTagId(null);
            setTagInput("");
            setMenuOpenId(null);
          }}
        />
      )}

      {menuOpenId && (
        <div
          className="fixed inset-0 z-[105]"
          aria-hidden
          onClick={() => setMenuOpenId(null)}
        />
      )}

      <div className="mt-8">
        {showSkeleton ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-sm:gap-3">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <div
                key={i}
                className="bg-background-secondary/50 rounded-2xl max-sm:rounded-xl h-64 max-sm:h-48 animate-pulse"
              />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="bg-background-secondary border border-primary/20 shadow-sm rounded-xl p-12 max-sm:p-6 text-center text-text-secondary">
            <p className="text-lg max-sm:text-base">No recipes found.</p>
            <p className="mt-2 text-sm italic opacity-60">
              {debouncedSearch.trim()
                ? "No match for your current search on any page."
                : "Add your own recipe to get started!"}
            </p>
          </div>
        ) : (
          <>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-sm:gap-3 transition-opacity ${
                isValidating ? "opacity-70" : ""
              }`}
            >
              {recipes.map((r) => (
                <div
                  key={r.id}
                  className={`bg-background-secondary rounded-2xl max-sm:rounded-xl shadow-md border border-primary/10 flex flex-col group relative transition-all duration-300 max-sm:shadow-sm ${
                    addingTagId === r.id || menuOpenId === r.id
                      ? "shadow-xl z-[150]"
                      : "hover:shadow-xl max-sm:hover:shadow-md hover:-translate-y-1 max-sm:hover:translate-y-0"
                  }`}
                >
                  <div className="relative z-20 aspect-video bg-background rounded-t-2xl max-sm:rounded-t-xl shrink-0">
                    <Link
                      href={`/library/${r.id}`}
                      className="absolute inset-0 z-0 block overflow-hidden rounded-t-2xl max-sm:rounded-t-xl"
                    >
                      {r.thumbnail_url ? (
                        <img
                          src={r.thumbnail_url}
                          alt={r.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-main/40 font-medium opacity-20">
                          No Image
                        </div>
                      )}
                    </Link>
                    <div className="absolute top-2 right-2 z-[200]">
                      <button
                        type="button"
                        aria-label="Recipe actions"
                        aria-expanded={menuOpenId === r.id}
                        aria-haspopup="menu"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === r.id ? null : r.id);
                          setAddingTagId(null);
                          setTagInput("");
                        }}
                        className="rounded-full p-1.5 bg-background/90 text-text-secondary shadow-sm border border-primary/15 hover:bg-background hover:text-primary transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" strokeWidth={2.5} />
                      </button>
                      {menuOpenId === r.id ? (
                        <div
                          role="menu"
                          className="absolute right-0 top-full mt-1 z-[210] min-w-[148px] rounded-xl border border-primary/20 bg-background py-1 shadow-xl text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:bg-primary/5 hover:text-primary"
                            onClick={() => handleViewRecipe(r.id)}
                          >
                            <Eye className="w-4 h-4 shrink-0" />
                            View
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={editLoadingId === r.id}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
                            onClick={() => handleEditRecipe(r)}
                          >
                            <Pencil className="w-4 h-4 shrink-0" />
                            {editLoadingId === r.id ? "Loading…" : "Edit"}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setMenuOpenId(null);
                              setDeleteTarget(r);
                            }}
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-5 max-sm:p-3 flex flex-col flex-1">
                    <Link
                      href={`/library/${r.id}`}
                      className="text-lg max-sm:text-base font-bold text-text-main hover:text-primary transition-colors line-clamp-2 mb-2 max-sm:mb-1"
                    >
                      {r.title || "Untitled Recipe"}
                    </Link>

                    <div className="flex flex-wrap gap-1 max-sm:gap-0.5 mt-1 mb-3 max-sm:mb-2 relative">
                      {r.tags?.map((tag: string) => (
                        <span
                          key={tag}
                          className="text-[10px] font-bold bg-primary/5 text-primary/60 px-2 py-0.5 rounded-md border border-primary/10"
                        >
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
                              if (e.key === "Enter") handleAddTag(r);
                              if (e.key === "Escape") {
                                setAddingTagId(null);
                                setTagInput("");
                              }
                            }}
                            placeholder="New tag..."
                            className="w-full px-3 py-2 text-xs font-medium text-primary bg-background outline-none border-b border-primary/10 placeholder:text-text-secondary/40"
                          />
                          {(() => {
                            const available = allTagsForPicker.filter(
                              (t) =>
                                !r.tags?.includes(t) &&
                                t.toLowerCase().includes(tagInput.toLowerCase())
                            );
                            return available.length > 0 ? (
                              <div className="max-h-36 overflow-y-auto py-1">
                                {available.map((tag: string) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleAddTag(r, tag);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-primary/5 hover:text-primary transition-colors"
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                          <div className="flex justify-end px-3 py-1.5 border-t border-primary/5">
                            <button
                              type="button"
                              onMouseDown={() => {
                                setAddingTagId(null);
                                setTagInput("");
                              }}
                              className="text-[10px] text-text-secondary/50 hover:text-text-secondary transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuOpenId(null);
                          setAddingTagId(addingTagId === r.id ? null : r.id);
                          setTagInput("");
                        }}
                        className="text-[10px] font-bold text-primary/30 hover:text-primary/70 hover:bg-primary/5 px-1.5 py-0.5 rounded-md border border-dashed border-primary/15 hover:border-primary/30 transition-all flex items-center"
                        title="Add tag"
                      >
                        <Plus size={10} />
                      </button>
                    </div>

                    <div className="mt-auto pt-4 max-sm:pt-2 flex items-center justify-between border-t border-primary/5">
                      <span className="text-xs max-sm:text-[10px] font-medium text-text-main/30">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <p className="text-sm text-text-secondary order-2 sm:order-none">
                  Page {page} of {totalPages}
                  <span className="text-text-secondary/60"> ({total} recipes)</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={page <= 1 || isValidating}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-primary/20 bg-background-secondary text-text-secondary text-sm font-medium hover:bg-background hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={page >= totalPages || isValidating}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-primary/20 bg-background-secondary text-text-secondary text-sm font-medium hover:bg-background hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DeleteRecipeConfirmDialog
        open={deleteTarget !== null}
        recipeTitle={deleteTarget?.title ?? ""}
        isDeleting={deleteInProgress}
        onCancel={() => !deleteInProgress && setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleteInProgress(true);
          try {
            await performDeleteRecipe(deleteTarget);
            setDeleteTarget(null);
          } finally {
            setDeleteInProgress(false);
          }
        }}
      />
    </div>
  );
}
