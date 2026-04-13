/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type Ingredient = { 
  name: string; 
  quantity?: string | null; 
  unit?: string | null; 
  notes?: string | null; 
  section?: string | null;
  source?: string[];
  confidence?: string;
};
type Step = { 
  step_number: number; 
  instruction: string; 
  section?: string | null;
  source?: string[];
  confidence?: string;
};
type Recipe = {
  title?: string | null;
  description?: string | null;
  source_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  notes?: string | null;
  overall_confidence?: string;
};

export default function ExtractPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<string>("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setSessionToken(session.access_token);
      }
    });
  }, [router]);

  async function onExtract() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setStatus("loading");
    setRecipe(null);
    setSavedId(null);
    try {
      const res = await fetch(`${API_BASE}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (data.status === "complete" && data.recipe) {
        setRecipe(data.recipe);
        setStatus("done");
      } else {
        setStatus("norecipe");
      }
    } catch {
      setStatus("norecipe");
    }
  }

  async function onSave() {
    if (!recipe) return;
    setSaving(true);
    setStatus("Saving recipe to library...");
    setSavedId(null);
    try {
      const isYouTube = /youtu/i.test(url);
      const websiteUrl = recipe.source_url && !/youtu/i.test(recipe.source_url) ? recipe.source_url : (!isYouTube ? url : null);
      const videoUrl = recipe.video_url ?? (isYouTube ? url : null);
      const payload = {
        title: recipe.title ?? null,
        description: recipe.description ?? null,
        source_url: websiteUrl,
        video_url: videoUrl,
        thumbnail_url: recipe.thumbnail_url ?? null,
        ingredients: recipe.ingredients ?? [],
        steps: recipe.steps ?? [],
        notes: recipe.notes ?? null,
        missing_information: [],
        overall_confidence: "medium",
      };
      const res = await fetch(`${API_BASE}/save`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {})
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("norecipe");
      } else {
        setSavedId(data.recipe_id);
        setStatus("done");
        window.location.href = `/library/${data.recipe_id}`;
      }
    } catch {
      setStatus("norecipe");
    } finally {
      setSaving(false);
    }
  }



  return (
    <div className="max-w-4xl mx-auto pb-12">
      <h1 className="text-3xl font-bold text-primary mb-6">Extract Recipe</h1>
      
      <div className="bg-background-secondary border border-primary/20 shadow-sm rounded-xl p-6 sm:p-8 mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste YouTube or Website URL here..."
          className="flex-1 w-full px-4 py-3 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base text-primary bg-background"
        />
        <button 
          onClick={onExtract} 
          disabled={status === "loading"}
          className="w-full sm:w-auto px-8 py-3 bg-button text-button-text font-semibold rounded-lg shadow-sm hover:opacity-90 disabled:opacity-70 transition-all whitespace-nowrap"
        >
          {status === "loading" ? "Extracting..." : "Extract Recipe"}
        </button>
      </div>

      {status === "loading" && !recipe && (
        <div className="p-5 rounded-xl text-center bg-blue-50 border border-blue-100 text-primary flex items-center justify-center gap-3">
          <svg className="animate-spin h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span className="font-medium">Gathering details... just a moment</span>
        </div>
      )}
      {status === "norecipe" && (
        <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex gap-3 items-start">
          <span className="text-xl shrink-0">🔍</span>
          <div>
            <p className="font-semibold mb-1">No recipe found</p>
            <p className="text-sm">We couldn&apos;t find a recipe for this link. Try a different video or website, or <a href="/add" className="underline font-medium">add the recipe manually</a>.</p>
          </div>
        </div>
      )}

      {recipe && (
        <div className="flex flex-col gap-8 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Header Section */}
          <div className="flex flex-col gap-6">
            {recipe.thumbnail_url && (
              <img 
                alt="Recipe Thumbnail" 
                src={recipe.thumbnail_url} 
                className="w-full max-h-80 object-cover rounded-xl shadow-md" 
              />
            )}
            <div>
              <h1 className="text-3xl font-extrabold text-primary mb-2">
                {recipe.title || "Untitled Recipe"}
              </h1>
              {recipe.description && (
                <p className="text-text-secondary text-lg">
                  {recipe.description}
                </p>
              )}
            </div>
          </div>
          
          {/* Content Section */}
          <div className="flex flex-col gap-12 mt-8">
            
          {/* Ingredients Card */}
            <div>
              <h2 className="text-2xl font-bold text-primary mb-6">Ingredients</h2>
              {recipe.ingredients && recipe.ingredients.length > 0 ? (
                <ul className="space-y-2 text-text-secondary">
                  {recipe.ingredients.reduce((acc: any[], ing, idx) => {
                    const prevSection = idx > 0 ? recipe.ingredients[idx - 1].section : null;
                    if (ing.section && ing.section !== prevSection) {
                      acc.push(
                        <li key={`sec-${idx}`} className="pt-3 pb-1 list-none">
                          <span className="text-base font-bold uppercase tracking-wide text-primary/80">{ing.section}</span>
                        </li>
                      );
                    }
                    acc.push(
                      <li key={idx} className="group">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-1.5">
                          <div className="flex gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span className="text-text-secondary">
                              {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(" ")}
                              {ing.notes ? <span className="italic text-sm"> ({ing.notes})</span> : null}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                    return acc;
                  }, [])}
                </ul>
              ) : (
                <div className="text-text-secondary italic">No ingredients extracted.</div>
              )}
            </div>

            {/* Instructions Card */}
            <div>
              <h2 className="text-2xl font-bold text-primary mb-6">Instructions</h2>
              {recipe.steps && recipe.steps.length > 0 ? (
                <div className="flex flex-col space-y-4 text-text-secondary">
                  {recipe.steps.reduce((acc: any, step, idx) => {
                    const prevSection = idx > 0 ? recipe.steps[idx - 1].section : null;
                    
                    if (!acc.currentSectionSteps) acc.currentSectionSteps = 0;

                    if (step.section && step.section !== prevSection) {
                      acc.push(
                        <div key={`ssec-${idx}`} className="pt-2 pb-1">
                          <span className="text-base font-bold uppercase tracking-wide text-primary/80">{step.section}</span>
                        </div>
                      );
                      acc.currentSectionSteps = 1;
                    } else {
                      acc.currentSectionSteps++;
                    }

                    acc.push(
                      <div key={idx} className="group">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                            <p className="flex-1 text-text-secondary">
                              <span className="font-bold text-primary mr-2">{acc.currentSectionSteps}.</span> 
                              {step.instruction}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                    return acc;
                  }, [] as any)}
                </div>
              ) : (
                <div className="text-text-secondary italic">No instructions extracted.</div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          {recipe.notes && (
            <div className="bg-amber-50/30 border border-amber-100 rounded-xl p-6">
              <h2 className="text-xl font-bold text-primary mb-3">Notes</h2>
              <p className="text-text-secondary whitespace-pre-line leading-relaxed italic">
                {recipe.notes}
              </p>
            </div>
          )}

          {/* Footer / Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between mt-4">
            <div className="text-text-secondary text-sm italic">
               {status.includes("Extraction Complete") ? "Review the recipe above before saving." : ""} 
               {savedId && <span className="text-green-600 font-medium not-italic block mt-1">✓ Recipe added successfully!</span>}
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <button 
                onClick={() => {
                  localStorage.setItem("editRecipe", JSON.stringify({...recipe, source_url: url}));
                  window.location.href = "/add";
                }} 
                className="w-full sm:w-auto px-6 py-3 bg-background border border-primary/20 text-primary font-semibold rounded-lg shadow-sm hover:bg-background-secondary transition-all text-center"
              >
                Edit Recipe
              </button>
              <button 
                onClick={onSave} 
                disabled={saving} 
                className="w-full sm:w-auto px-8 py-3 bg-button text-button-text font-semibold rounded-lg shadow-sm hover:opacity-90 disabled:opacity-70 transition-all text-center"
              >
                {saving ? "Saving..." : "Save to Library"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
