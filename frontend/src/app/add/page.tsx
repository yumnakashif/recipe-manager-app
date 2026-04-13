"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type IngredientRow =
  | { id: string; kind: 'section'; name: string }
  | { id: string; kind: 'ingredient'; quantity: string; unit: string; name: string; notes: string };
type StepRow =
  | { id: string; kind: 'section'; name: string }
  | { id: string; kind: 'step'; instruction: string };
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from "lucide-react";

function SortableItem({ id, children }: { id: string, children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : undefined };
  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 ${isDragging ? "opacity-50" : ""}`}>
      <button {...attributes} {...listeners} className="cursor-grab p-2 text-text-secondary hover:text-primary active:cursor-grabbing shrink-0">
        <GripVertical size={16} />
      </button>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function AddPage() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [thumb, setThumb] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [recipeNotes, setRecipeNotes] = useState("");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ id: Math.random().toString(), kind: 'ingredient', quantity: "", unit: "", name: "", notes: "" }]);
  const [steps, setSteps] = useState<StepRow[]>([{ id: Math.random().toString(), kind: 'step', instruction: "" }]);
  const [status, setStatus] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  useEffect(() => {
    try {
      const data = localStorage.getItem("editRecipe");
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.id) setEditingId(parsed.id);
        setTitle(parsed.title || "");
        setTags(Array.isArray(parsed.tags) ? parsed.tags.join(", ") : "");
        setDescription(parsed.description || "");
        setThumb(parsed.thumbnail_url || "");

        let sUrl = parsed.source_url || "";
        let vUrl = parsed.video_url || "";
        if (sUrl.includes(" | ")) {
          const parts = sUrl.split(" | ");
          if (parts[0].includes("youtu")) { vUrl = parts[0]; sUrl = parts[1]; }
          else { sUrl = parts[0]; vUrl = parts[1]; }
        } else if (/(youtube\.com|youtu\.be)/.test(sUrl)) {
          vUrl = sUrl;
          sUrl = "";
        }
        setSourceUrl(sUrl);
        setVideoUrl(vUrl);

        if (parsed.ingredients && parsed.ingredients.length > 0) {
          const rows: IngredientRow[] = [];
          let lastSection: string | null = null;
          for (const i of parsed.ingredients) {
            const sec = i.section || null;
            if (sec && sec !== lastSection) {
              rows.push({ id: `sec-${Math.random()}`, kind: 'section', name: sec });
              lastSection = sec;
            }
            rows.push({ id: `ing-${Math.random()}`, kind: 'ingredient', quantity: i.quantity || "", unit: i.unit || "", name: i.name || "", notes: i.notes || "" });
          }
          setIngredients(rows);
        }
        if (parsed.steps && parsed.steps.length > 0) {
          const rows: StepRow[] = [];
          let lastSection: string | null = null;
          for (const s of parsed.steps) {
            const sec = s.section || null;
            if (sec && sec !== lastSection) {
              rows.push({ id: `ssec-${Math.random()}`, kind: 'section', name: sec });
              lastSection = sec;
            }
            rows.push({ id: `step-${Math.random()}`, kind: 'step', instruction: s.instruction || "" });
          }
          setSteps(rows);
        }
        setRecipeNotes(parsed.notes || "");
        localStorage.removeItem("editRecipe");
      }
    } catch (e) { }
  }, []);

  async function onSave() {
    setStatus("Saving...");
    setSavedId(null);

    // Convert mixed rows to flat ingredients with section tags
    let currentSection: string | null = null;
    const formattedIngredients: any[] = [];
    for (const row of ingredients) {
      if (row.kind === 'section') {
        currentSection = row.name || null;
      } else {
        formattedIngredients.push({
          name: row.name.trim(),
          quantity: row.quantity.trim() || null,
          unit: row.unit.trim() || null,
          notes: row.notes.trim() || null,
          section: currentSection,
          source: ["website_text"],
          confidence: "medium",
        });
      }
    }

    let currentStepSection: string | null = null;
    const formattedSteps: any[] = [];
    let stepNum = 1;
    for (const row of steps) {
      if (row.kind === 'section') {
        currentStepSection = row.name || null;
      } else {
        formattedSteps.push({
          step_number: stepNum++,
          instruction: row.instruction.trim(),
          section: currentStepSection,
          source: ["website_text"],
          confidence: "medium",
          missing_details: [],
        });
      }
    }

    const payload = {
      title: title || null,
      tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      description: description || null,
      source_url: sourceUrl || null,
      video_url: videoUrl || null,
      thumbnail_url: thumb || null,
      ingredients: formattedIngredients,
      steps: formattedSteps,
      notes: recipeNotes || null,
      missing_information: [],
      overall_confidence: "medium",
    };

    try {
      const endpoint = editingId ? `${API_BASE}/recipes/${editingId}` : `${API_BASE}/save`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {})
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Save failed: ${data.detail || res.status}`);
      } else {
        const id = editingId || data.recipe_id;
        setSavedId(id);
        setStatus("Saved");
        window.location.href = `/library/${id}`;
      }
    } catch (e: any) {
      setStatus(`Save failed: ${String(e)}`);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleIngredientDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setIngredients((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function handleStepDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <h1 className="text-3xl font-bold text-primary mb-6">Add Custom Recipe</h1>

      <div className="bg-background-secondary border border-primary/20 shadow-sm rounded-xl p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Recipe Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g., Homemade Pizza"
              className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-primary bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Tags <span className="text-text-secondary font-normal">(comma separated)</span></label>
            <input 
              value={tags} 
              onChange={(e) => setTags(e.target.value)} 
              placeholder="E.g., Dessert, Quick, Vegetarian" 
              className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-primary bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Description <span className="text-text-secondary font-normal">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="A short description of this delicious dish..."
              className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-y text-primary bg-background"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Website Link <span className="text-text-secondary font-normal">(optional)</span></label>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all mb-4 text-primary bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Video Link <span className="text-text-secondary font-normal">(optional)</span></label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="YouTube URL..."
              className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all mb-4 text-primary bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-1">Thumbnail Image <span className="text-text-secondary font-normal">(optional)</span></label>
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                value={thumb.startsWith('data:') ? 'Uploaded Image' : thumb}
                onChange={(e) => setThumb(e.target.value)}
                placeholder="Paste an image URL..."
                className="flex-1 px-4 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-primary bg-background"
              />
              <div className="flex shrink-0">
                <span className="self-center px-3 text-slate-500 font-bold">OR</span>
                <label className="cursor-pointer bg-background border border-primary/20 hover:bg-slate-200 text-primary px-4 py-2 rounded-lg transition-colors flex items-center">
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setThumb(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            {thumb && <img src={thumb} alt="Preview" className="mt-3 h-24 object-cover rounded-lg border border-primary/20" />}
          </div>


        </div>

        <hr className="my-8 border-slate-200" />

        <div className="mb-8">
          <h3 className="text-lg font-bold text-primary mb-3">Ingredients</h3>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center flex-wrap text-xs font-semibold text-text-secondary px-1 mb-1">
              <span className="w-8"></span>
              <span className="w-20">Qty</span>
              <span className="w-24">Unit</span>
              <span className="flex-1 min-w-32">Ingredient Name</span>
              <span className="w-36">Notes</span>
              <span className="w-8"></span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleIngredientDragEnd}>
              <SortableContext items={ingredients.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {ingredients.map((row, idx) => (
                  <SortableItem key={row.id} id={row.id}>
                    {row.kind === 'section' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-primary/70 whitespace-nowrap">Section:</span>
                        <input
                          value={row.name}
                          onChange={(e) => {
                            const next = [...ingredients];
                            (next[idx] as { kind: 'section'; name: string }).name = e.target.value;
                            setIngredients(next);
                          }}
                          placeholder="e.g. For the Sauce"
                          className="flex-1 max-w-xs px-3 py-1.5 border border-dashed border-primary/40 rounded-lg text-sm font-semibold text-primary bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="p-1 text-text-secondary hover:text-red-500 transition-colors" title="Remove section">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center flex-wrap">
                        <input placeholder="Qty" value={row.quantity}
                          onChange={(e) => { const n = [...ingredients]; (n[idx] as any).quantity = e.target.value; setIngredients(n); }}
                          className="w-20 px-3 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-primary bg-background" />
                        <input placeholder="Unit" value={row.unit}
                          onChange={(e) => { const n = [...ingredients]; (n[idx] as any).unit = e.target.value; setIngredients(n); }}
                          className="w-24 px-3 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-primary bg-background" />
                        <input placeholder="Ingredient Name" value={row.name}
                          onChange={(e) => { const n = [...ingredients]; (n[idx] as any).name = e.target.value; setIngredients(n); }}
                          className="flex-1 min-w-32 px-3 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-primary bg-background" />
                        <input placeholder="Notes" value={row.notes}
                          onChange={(e) => { const n = [...ingredients]; (n[idx] as any).notes = e.target.value; setIngredients(n); }}
                          className="w-36 px-3 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-primary bg-background" />
                        <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="p-2 text-text-secondary hover:text-red-500 transition-colors" title="Remove">✕</button>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="mt-3 flex gap-4">
            <button className="text-sm font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
              onClick={() => setIngredients([...ingredients, { id: Math.random().toString(), kind: 'ingredient', quantity: "", unit: "", name: "", notes: "" }])}>
              + Add Ingredient
            </button>
            <button className="text-sm font-medium text-primary/60 hover:text-primary flex items-center gap-1 transition-colors border border-dashed border-primary/30 px-3 py-1 rounded-lg"
              onClick={() => setIngredients([...ingredients, { id: Math.random().toString(), kind: 'section', name: "" }])}>
              + Add Section
            </button>
          </div>
        </div>

        <hr className="my-8 border-slate-200" />

        <div className="mb-8">
          <h3 className="text-lg font-bold text-primary mb-3">Instructions</h3>
          <div className="flex flex-col gap-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStepDragEnd}>
              <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {steps.map((row, idx) => (
                  <SortableItem key={row.id} id={row.id}>
                    {row.kind === 'section' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-primary/70 whitespace-nowrap">Section:</span>
                        <input
                          value={row.name}
                          onChange={(e) => {
                            const next = [...steps];
                            (next[idx] as { kind: 'section'; name: string }).name = e.target.value;
                            setSteps(next);
                          }}
                          placeholder="e.g. Make the Roux"
                          className="flex-1 max-w-xs px-3 py-1.5 border border-dashed border-primary/40 rounded-lg text-sm font-semibold text-primary bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <button onClick={() => setSteps(steps.filter((_, i) => i !== idx))} className="p-1 text-text-secondary hover:text-red-500 transition-colors" title="Remove section">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-3 items-start w-full">
                        <div className="w-8 h-8 shrink-0 bg-background text-slate-600 rounded-full border border-primary/20 flex items-center justify-center font-bold text-xs mt-1">
                          {(() => {
                            const before = steps.slice(0, idx);
                            const lastSec = before.findLastIndex(r => r.kind === 'section');
                            const inSec = before.slice(lastSec + 1).filter(r => r.kind === 'step').length;
                            return inSec + 1;
                          })()}
                        </div>
                        <textarea
                          placeholder="Describe this step..."
                          value={row.instruction}
                          onChange={(e) => { const n = [...steps]; (n[idx] as any).instruction = e.target.value; setSteps(n); }}
                          rows={2}
                          className="flex-1 px-3 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm resize-y text-primary bg-background"
                        />
                        <button onClick={() => setSteps(steps.filter((_, i) => i !== idx))} className="p-2 text-text-secondary hover:text-red-500 transition-colors mt-1" title="Remove">✕</button>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="mt-3 flex gap-4">
            <button className="text-sm font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
              onClick={() => setSteps([...steps, { id: Math.random().toString(), kind: 'step', instruction: "" }])}>
              + Add Step
            </button>
            <button className="text-sm font-medium text-primary/60 hover:text-primary flex items-center gap-1 transition-colors border border-dashed border-primary/30 px-3 py-1 rounded-lg"
              onClick={() => setSteps([...steps, { id: Math.random().toString(), kind: 'section', name: "" }])}>
              + Add Section
            </button>
          </div>
        </div>

        <hr className="my-8 border-slate-200" />

        <div className="mb-8">
          <label className="block text-base font-bold text-primary mb-3">Notes</label>
          <textarea
            value={recipeNotes}
            onChange={(e) => setRecipeNotes(e.target.value)}
            rows={4}
            placeholder="Additional tips, variations, or serving suggestions..."
            className="w-full px-4 py-2 border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-y text-primary bg-background"
          ></textarea>
        </div>
        <div className="flex items-center gap-4 mt-8 pt-6 border-t border-slate-200">
          <button
            onClick={onSave}
            disabled={status === "Saving..."}
            className="px-6 py-2.5 bg-button text-button-text font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {status === "Saving..." ? "Saving..." : "Save Recipe"}
          </button>
          <button
            onClick={() => {
              if (editingId) window.location.href = `/library/${editingId}`;
              else window.history.back();
            }}
            className="px-6 py-2.5 bg-background text-primary border border-primary/20 font-medium rounded-lg hover:bg-slate-50 transition-all shadow-sm"
          >
            Cancel
          </button>

          {savedId && <div className="text-green-600 font-medium">Recipe added successfully!</div>}
          {status && status !== "Saving..." && status !== "Saved" && (
            <div className="text-red-500 font-medium">{status}</div>
          )}
        </div>
      </div>
    </div>
  );
}
