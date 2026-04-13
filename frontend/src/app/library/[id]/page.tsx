"use client";

import { use, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Copy, Check, ClipboardList, ChefHat } from "lucide-react";

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

export default function RecipeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [copiedRecipe, setCopiedRecipe] = useState(false);
  const [copiedIngredients, setCopiedIngredients] = useState(false);
  const [scale, setScale] = useState(1);
  const [cookMode, setCookMode] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const toggleCookMode = async () => {
    if (!cookMode) {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
        setCookMode(true);
      } catch (e) {
        // Wake lock failed (e.g. page not visible), still enter cook mode
        setCookMode(true);
      }
    } else {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
      setCookMode(false);
    }
  };

  // Release wake lock when navigating away
  useEffect(() => {
    return () => { wakeLockRef.current?.release(); };
  }, []);

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  // Converts a quantity string (including fractions) to a scaled fraction string
  const scaleQty = (qty: string | null | undefined): string | null => {
    if (!qty) return null;
    const UNICODE_FRACS: Record<string, number> = {
      '½': 1/2, '⅓': 1/3, '⅔': 2/3, '¼': 1/4, '¾': 3/4,
      '⅕': 1/5, '⅖': 2/5, '⅗': 3/5, '⅘': 4/5,
      '⅙': 1/6, '⅚': 5/6, '⅛': 1/8, '⅜': 3/8, '⅝': 5/8, '⅞': 7/8,
    };
    // Nearest cooking fractions sorted by value
    const FRAC_CHARS: [number, string][] = [
      [1/8, '⅛'], [1/6, '⅙'], [1/4, '¼'], [1/3, '⅓'],
      [3/8, '⅜'], [1/2, '½'], [5/8, '⅝'], [2/3, '⅔'],
      [3/4, '¾'], [7/8, '⅞'],
    ];
    const toFrac = (n: number): string => {
      if (n <= 0) return '0';
      const whole = Math.floor(n);
      const dec = n - whole;
      if (dec < 0.05) return whole > 0 ? `${whole}` : '0';
      // Find closest cooking fraction
      let best = FRAC_CHARS[0];
      for (const f of FRAC_CHARS) {
        if (Math.abs(f[0] - dec) < Math.abs(best[0] - dec)) best = f;
      }
      return whole > 0 ? `${whole} ${best[1]}` : best[1];
    };
    // Replace unicode fraction chars with decimal equivalents
    let normalized = qty.trim();
    for (const [ch, val] of Object.entries(UNICODE_FRACS)) {
      normalized = normalized.replace(ch, ` ${val}`);
    }
    // Parse mixed numbers like "1 1/2" or "2 0.5"
    const parts = normalized.trim().split(/\s+/);
    let total = 0;
    for (const part of parts) {
      if (part.includes('/')) {
        const [n, d] = part.split('/').map(Number);
        if (!isNaN(n) && !isNaN(d) && d !== 0) total += n / d;
      } else {
        const n = parseFloat(part);
        if (!isNaN(n)) total += n;
      }
    }
    if (total === 0) return qty; // couldn't parse, return as-is
    return toFrac(total * scale);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setSessionToken(session.access_token);
        setCheckingAuth(false);
      }
    });
  }, [router]);

  const { data: recipe, error, isLoading } = useSWR(
    sessionToken ? [`${API_BASE}/recipes/${resolvedParams.id}`, sessionToken] : null,
    fetcher
  );

  const handleCopyRecipe = () => {
    if (!recipe) return;
    let text = `${recipe.title?.toUpperCase() || "UNTITLED RECIPE"}\n`;
    if (recipe.description) text += `${recipe.description}\n\n`;
    
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      text += "INGREDIENTS:\n";
      let lastSection: string | null = null;
      recipe.ingredients.forEach((ing: any) => {
        if (ing.section && ing.section !== lastSection) {
          text += `\n[ ${ing.section.toUpperCase()} ]\n`;
          lastSection = ing.section;
        }
        text += `- ${ing.quantity || ""} ${ing.unit || ""} ${ing.name} ${ing.notes ? `(${ing.notes})` : ""}\n`;
      });
      text += "\n";
    }

    if (recipe.steps && recipe.steps.length > 0) {
      text += "INSTRUCTIONS:\n";
      let lastSection: string | null = null;
      recipe.steps.forEach((step: any) => {
        if (step.section && step.section !== lastSection) {
          text += `\n[ ${step.section.toUpperCase()} ]\n`;
          lastSection = step.section;
        }
        text += `${step.step_number}. ${step.instruction}\n`;
      });
    }

    if (recipe.notes) {
      text += `\nNOTES:\n${recipe.notes}\n`;
    }

    navigator.clipboard.writeText(text.trim());
    setCopiedRecipe(true);
    setTimeout(() => setCopiedRecipe(false), 2000);
  };

  const handleCopyIngredients = () => {
    if (!recipe || !recipe.ingredients) return;
    let text = `Ingredients for ${recipe.title || "Recipe"}:\n`;
    let lastSection: string | null = null;
    recipe.ingredients.forEach((ing: any) => {
      if (ing.section && ing.section !== lastSection) {
        text += `\n[ ${ing.section.toUpperCase()} ]\n`;
        lastSection = ing.section;
      }
      text += `- ${ing.quantity || ""} ${ing.unit || ""} ${ing.name} ${ing.notes ? `(${ing.notes})` : ""}\n`;
    });
    
    navigator.clipboard.writeText(text.trim());
    setCopiedIngredients(true);
    setTimeout(() => setCopiedIngredients(false), 2000);
  };
  
  if (checkingAuth || isLoading) return <div className="text-center py-20 text-slate-500 animate-pulse font-medium">Loading recipe details...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg max-w-4xl mx-auto mt-8">Error loading recipe: {String(error)}</div>;
  if (!recipe) return <div className="text-center py-20 font-medium text-slate-600">Recipe not found.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-6">
        <Link href="/library" className="text-slate-500 hover:text-primary transition-colors font-medium flex items-center gap-1 w-fit">
          &larr; Back to Library
        </Link>
      </div>

      <div className="bg-white border border-slate-200 shadow-lg shadow-slate-100 rounded-2xl overflow-hidden bg-slate-50">
        {/* Header Section */}
        <div className="p-6 sm:p-10 border-b border-slate-100 bg-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col justify-between h-full"> 
            {recipe.thumbnail_url && (
              <div className="w-full h-64 sm:h-80 mb-8 rounded-xl overflow-hidden shadow-md border border-slate-200 relative">
                <img 
                  alt={recipe.title || "Recipe Thumbnail"} 
                  src={recipe.thumbnail_url} 
                  className="w-full h-full object-cover" 
                />
              </div>
            )}
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-4 tracking-tight">
                  {recipe.title || "Untitled Recipe"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleCookMode}
                  className={`p-3 rounded-full transition-all flex items-center gap-2 group ${cookMode ? 'bg-amber-50 text-amber-600 ring-2 ring-amber-200' : 'bg-slate-50 text-slate-400 hover:text-amber-500 hover:bg-amber-50'}`}
                  title={cookMode ? 'Exit Cook Mode' : 'Cook Mode — keeps screen awake'}
                >
                  <ChefHat size={20} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold uppercase tracking-wide">Cook Mode</span>
                </button>
                <button 
                  onClick={handleCopyRecipe}
                  className={`p-3 rounded-full transition-all flex items-center gap-2 group ${copiedRecipe ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5'}`}
                  title="Copy Full Recipe"
                >
                  {copiedRecipe ? (
                    <><Check size={18} /> <span className="text-xs font-bold uppercase tracking-widest">Copied!</span></>
                  ) : (
                    <Copy size={20} className="group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>
            </div>
            <div>
              {recipe.description && (
                <p className="text-slate-600 text-lg leading-relaxed mb-6">
                  {recipe.description}
                </p>
              )}
              
              {(() => {
                let sUrl = recipe.source_url || "";
                let vUrl = recipe.video_url || "";
                if (sUrl.includes(" | ")) {
                   const parts = sUrl.split(" | ");
                   if (parts[0].includes("youtu")) { vUrl = parts[0]; sUrl = parts[1]; }
                   else { sUrl = parts[0]; vUrl = parts[1]; }
                } else if (/(youtube\.com|youtu\.be)/.test(sUrl)) {
                   vUrl = sUrl;
                   sUrl = "";
                }
                return (
                  <div className="flex flex-wrap gap-3">
                    {vUrl && (
                      <a href={vUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm font-bold text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-full hover:bg-red-100 transition-colors">
                        Watch Video ↗
                      </a>
                    )}
                    {sUrl && (
                      <a href={sUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm font-bold text-primary bg-primary/10 px-4 py-2 rounded-full hover:bg-primary/20 transition-colors">
                        View Recipe Website ↗
                      </a>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        
        {/* Content Section */}
        <div className="p-6 sm:p-10 flex flex-col gap-12 bg-slate-50">
          
          {/* Ingredients Col */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-slate-800 border-b-2 border-primary/20 pb-3 inline-block">
                Ingredients
              </h2>
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Servings</span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.5}
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-28 accent-primary"
                />
                <span className={`text-sm font-bold w-8 text-center ${
                  scale === 1 ? 'text-slate-500' : 'text-primary'
                }`}>{scale}×</span>
              </div>
            </div>
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <ul className="space-y-3">
                {recipe.ingredients.reduce((acc: any[], ing: any, idx: number) => {
                  const prevSection = idx > 0 ? recipe.ingredients[idx - 1].section : null;
                  if (ing.section && ing.section !== prevSection) {
                    acc.push(
                      <li key={`section-${idx}`} className="pt-3 pb-1">
                        <span className="text-base font-bold uppercase tracking-wide text-primary/80">{ing.section}</span>
                      </li>
                    );
                  }
                  acc.push(
                    <li
                      key={ing.id || ing.name + idx}
                      onClick={() => toggleIngredient(idx)}
                      className={`flex gap-3 leading-relaxed cursor-pointer select-none transition-all duration-200 rounded-lg px-2 py-1 -mx-2 ${
                        checkedIngredients.has(idx)
                          ? 'opacity-40 line-through text-slate-400'
                          : 'text-slate-700 hover:bg-primary/5'
                      }`}
                    >
                      <span className={`mt-1 shrink-0 transition-all ${checkedIngredients.has(idx) ? 'text-green-500' : 'text-primary'}`}>
                        {checkedIngredients.has(idx) ? <Check size={14} /> : '•'}
                      </span>
                      <span>
                        {ing.quantity && <span className={`font-semibold ${scale !== 1 ? 'text-primary' : ''}`}>{scaleQty(ing.quantity)} </span>}
                        {ing.unit && <span className="font-medium text-slate-600">{ing.unit} </span>}
                        <span className="font-medium text-slate-900">{ing.name} </span>
                        {ing.notes && <span className="text-slate-500 italic text-sm">({ing.notes})</span>}
                      </span>
                    </li>
                  );
                  return acc;
                }, [])}
              </ul>
            ) : (
              <div className="text-slate-500 italic">No ingredients found.</div>
            )}
            
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <button 
                onClick={handleCopyIngredients}
                className={`mt-8 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${copiedIngredients ? 'bg-green-50 text-green-600' : 'bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 hover:shadow-sm'}`}
              >
                {copiedIngredients ? (
                  <><Check size={14} /> Copied List!</>
                ) : (
                  <><ClipboardList size={14} /> Copy Ingredients</>
                )}
              </button>
            )}
          </div>

          {/* Instructions Col */}
          <div>
            <h2 className="text-xl font-bold text-slate-800 border-b-2 border-primary/20 pb-3 mb-6 inline-block">
              Instructions
            </h2>
            {recipe.steps && recipe.steps.length > 0 ? (
              <div className="space-y-6">
                {recipe.steps.reduce((acc: any, step: any, idx: number) => {
                  const prevSection = idx > 0 ? recipe.steps[idx - 1].section : null;
                  
                  // Initialize or increment section counter
                  if (!acc.currentSectionSteps) acc.currentSectionSteps = 0;
                  
                  if (step.section && step.section !== prevSection) {
                    acc.push(
                      <div key={`step-section-${idx}`} className="pt-2 pb-1">
                        <span className="text-base font-bold uppercase tracking-wide text-primary/80">{step.section}</span>
                      </div>
                    );
                    // Reset counter for new section
                    acc.currentSectionSteps = 1;
                  } else {
                    acc.currentSectionSteps++;
                  }

                  acc.push(
                    <div key={step.id || step.step_number} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {acc.currentSectionSteps}
                      </div>
                      <p className="text-slate-700 leading-relaxed text-lg">
                        {step.instruction}
                      </p>
                    </div>
                  );
                  return acc;
                }, [] as any)}
              </div>
            ) : (
              <div className="text-slate-500 italic">No instructions found.</div>
            )}
          </div>

          {/* Notes Card */}
          {recipe.notes && (
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-6 sm:p-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                Notes
              </h2>
              <p className="text-slate-600 leading-relaxed italic whitespace-pre-line text-lg">
                {recipe.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div className="bg-slate-100 p-6 sm:p-8 flex justify-end gap-3">
          <button 
            onClick={async () => {
              if (!confirm("Are you sure you want to delete this recipe?")) return;
              try {
                const res = await fetch(`${API_BASE}/recipes/${recipe.id}`, { 
                  method: "DELETE",
                  headers: { 
                    ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {})
                  }
                });
                if (res.ok) {
                  window.location.href = "/library";
                } else {
                  alert("Failed to delete recipe");
                }
              } catch (err) {
                alert("Error deleting recipe");
              }
            }} 
            className="px-6 py-3 bg-white text-red-600 border border-red-200 font-semibold rounded-lg shadow-sm hover:bg-red-50 hover:border-red-300 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          <button 
            onClick={() => {
              localStorage.setItem("editRecipe", JSON.stringify(recipe));
              window.location.href = "/add";
            }} 
            className="px-8 py-3 bg-white text-primary border border-slate-300 font-semibold rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Edit Recipe
          </button>
        </div>
      </div>
    </div>
  );
}
