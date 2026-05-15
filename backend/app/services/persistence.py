import logging
from typing import Any

import httpx

from app.config import get_settings
from app.models import RecipeOutput

logger = logging.getLogger(__name__)


class PersistenceService:
    def __init__(self) -> None:
        s = get_settings()
        if not s.supabase_url or not s.supabase_service_key:
            raise ValueError("Supabase URL/service key not configured")
        self.base = s.supabase_url.rstrip("/") + "/rest/v1"
        self.service_key = s.supabase_service_key

    def _get_headers(self, auth_token: str | None = None) -> dict[str, str]:
        # If no auth_token is provided, we fall back to the service key (admin)
        # However, for RLS-enabled tables, we SHOULD pass the user's token.
        token = auth_token or self.service_key
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def _recipe_row_from_output(self, recipe: RecipeOutput) -> dict[str, Any]:
        sources = []
        if recipe.video_url:
            sources.append(recipe.video_url)
        if recipe.source_url:
            sources.append(recipe.source_url)
        db_source_url = " | ".join(sources) if sources else None

        return {
            "title": recipe.title,
            "description": recipe.description,
            "source_url": db_source_url,
            "thumbnail_url": recipe.thumbnail_url,
            "author_name": recipe.author_name,
            "tags": recipe.tags,
            "notes": recipe.notes,
        }

    def _ingredient_rows(self, recipe_id: str, recipe: RecipeOutput) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for ing in recipe.ingredients:
            rows.append(
                {
                    "recipe_id": recipe_id,
                    "name": ing.name,
                    "quantity": ing.quantity,
                    "unit": ing.unit,
                    "notes": ing.notes,
                    "section": ing.section,
                    "source": [s.value for s in ing.source],
                    "confidence": ing.confidence.value,
                }
            )
        return rows

    def _step_rows(self, recipe_id: str, recipe: RecipeOutput) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for step in recipe.steps:
            rows.append(
                {
                    "recipe_id": recipe_id,
                    "step_number": step.step_number,
                    "instruction": step.instruction,
                    "section": step.section,
                    "source": [s.value for s in step.source],
                    "confidence": step.confidence.value,
                    "missing_details": [m.value for m in step.missing_details],
                }
            )
        return rows

    def save_recipe(self, recipe: RecipeOutput, auth_token: str | None = None) -> str:
        with httpx.Client(timeout=30.0) as client:
            headers = self._get_headers(auth_token)
            # Insert recipe
            r = client.post(f"{self.base}/recipes", headers=headers, json=self._recipe_row_from_output(recipe))
            r.raise_for_status()
            recipe_id = r.json()[0]["id"]

            # Insert ingredients
            ings = self._ingredient_rows(recipe_id, recipe)
            if ings:
                r = client.post(f"{self.base}/ingredients", headers=headers, json=ings)
                r.raise_for_status()

            # Insert steps
            steps = self._step_rows(recipe_id, recipe)
            if steps:
                r = client.post(f"{self.base}/steps", headers=headers, json=steps)
                r.raise_for_status()

            logger.info("Saved recipe %s with %d ingredients and %d steps", recipe_id, len(ings), len(steps))
            return recipe_id

    def update_recipe(self, recipe_id: str, recipe: RecipeOutput, auth_token: str | None = None) -> None:
        with httpx.Client(timeout=30.0) as client:
            headers = self._get_headers(auth_token)
            # Update core recipe
            r = client.patch(f"{self.base}/recipes", headers=headers, params={"id": f"eq.{recipe_id}"}, json=self._recipe_row_from_output(recipe))
            r.raise_for_status()

            # Replace ingredients
            client.delete(f"{self.base}/ingredients", headers=headers, params={"recipe_id": f"eq.{recipe_id}"}).raise_for_status()
            ings = self._ingredient_rows(recipe_id, recipe)
            if ings:
                client.post(f"{self.base}/ingredients", headers=headers, json=ings).raise_for_status()

            # Replace steps
            client.delete(f"{self.base}/steps", headers=headers, params={"recipe_id": f"eq.{recipe_id}"}).raise_for_status()
            steps = self._step_rows(recipe_id, recipe)
            if steps:
                client.post(f"{self.base}/steps", headers=headers, json=steps).raise_for_status()

            logger.info("Updated recipe %s", recipe_id)

    def _postgrest_ilike_token(self, raw: str) -> str:
        t = raw.strip()
        if t.startswith("#"):
            t = t[1:].strip()
        return t.replace("\\", r"\\").replace("*", r"\*").replace(",", r"\,").replace("(", r"\(").replace(")", r"\)")

    def list_recipes(
        self,
        *,
        limit: int,
        offset: int,
        search: str | None,
        auth_token: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return (rows, total_count) using PostgREST range + Prefer: count=exact."""
        terms = [p for p in (search or "").lower().split() if p.strip()]
        esc_terms: list[str] = []
        for term in terms:
            esc = self._postgrest_ilike_token(term)
            if esc:
                esc_terms.append(esc)
        list_headers = {**self._get_headers(auth_token), "Prefer": "return=representation,count=exact"}
        params: dict[str, str] = {
            "select": "id,title,description,source_url,thumbnail_url,created_at,author_name,tags",
            "order": "created_at.desc",
            "limit": str(limit),
            "offset": str(offset),
        }
        if len(esc_terms) == 1:
            e = esc_terms[0]
            params["or"] = f"(title.ilike.*{e}*,tags::text.ilike.*{e}*)"
        elif len(esc_terms) > 1:
            parts = ",".join(f"or(title.ilike.*{e}*,tags::text.ilike.*{e}*)" for e in esc_terms)
            params["and"] = f"({parts})"
        with httpx.Client(timeout=30.0) as client:
            r = client.get(f"{self.base}/recipes", headers=list_headers, params=params)
            r.raise_for_status()
            rows = r.json()
            cr = r.headers.get("content-range", "")
            total = len(rows)
            if "/" in cr:
                try:
                    total = int(cr.split("/")[-1])
                except ValueError:
                    pass
            return rows, total

    def get_recipe(self, recipe_id: str, auth_token: str | None = None) -> dict[str, Any]:
        with httpx.Client(timeout=30.0) as client:
            headers = self._get_headers(auth_token)
            # Fetch core recipe
            r = client.get(f"{self.base}/recipes", headers=headers, params={"id": f"eq.{recipe_id}"})
            r.raise_for_status()
            rows = r.json()
            if not rows:
                raise ValueError("Recipe not found")
            recipe = rows[0]
            # Fetch ingredients and steps
            ri = client.get(f"{self.base}/ingredients", headers=headers, params={"recipe_id": f"eq.{recipe_id}", "order": "id.asc"})
            ri.raise_for_status()
            rs = client.get(f"{self.base}/steps", headers=headers, params={"recipe_id": f"eq.{recipe_id}", "order": "step_number.asc"})
            rs.raise_for_status()
            recipe["ingredients"] = ri.json()
            recipe["steps"] = rs.json()
            return recipe

    def delete_recipe(self, recipe_id: str, auth_token: str | None = None) -> None:
        with httpx.Client(timeout=30.0) as client:
            headers = self._get_headers(auth_token)
            r = client.delete(f"{self.base}/recipes", headers=headers, params={"id": f"eq.{recipe_id}"})
            r.raise_for_status()
