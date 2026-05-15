"use client";

import { useEffect } from "react";

type DeleteRecipeConfirmDialogProps = {
  open: boolean;
  recipeTitle: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
};

export function DeleteRecipeConfirmDialog({
  open,
  recipeTitle,
  onCancel,
  onConfirm,
  isDeleting = false,
}: DeleteRecipeConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isDeleting, onCancel]);

  if (!open) return null;

  const displayTitle = recipeTitle.trim() || "Untitled recipe";

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        aria-label="Dismiss"
        disabled={isDeleting}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-recipe-dialog-title"
        aria-describedby="delete-recipe-dialog-desc"
        className="relative z-10 w-full max-w-md rounded-2xl border border-primary/20 bg-background p-6 shadow-2xl max-sm:p-5"
      >
        <h2
          id="delete-recipe-dialog-title"
          className="text-lg font-bold text-text-main sm:text-xl"
        >
          Delete this recipe?
        </h2>
        <p
          id="delete-recipe-dialog-desc"
          className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base"
        >
          Are you sure you want to delete{" "}
          <span className="font-semibold text-text-main">&ldquo;{displayTitle}&rdquo;</span>
          ? This will remove it from your library{" "}
          <strong className="font-semibold text-text-main">permanently</strong>. You will not be
          able to undo this action.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="rounded-xl border border-primary/20 bg-background-secondary px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-background hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}
