import html as html_mod
import json
import logging
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

from app.models import RecipeOutput, Source, Ingredient

logger = logging.getLogger(__name__)


class ScraperService:
    async def _fetch_html(self, url: str) -> str:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        }
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.text

    @staticmethod
    def _collect_json_ld_nodes(html: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(html, "html.parser")
        nodes: list[dict[str, Any]] = []
        for tag in soup.find_all("script", {"type": "application/ld+json"}):
            text = tag.string or tag.get_text()
            if not text:
                continue
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and isinstance(data.get("@graph"), list):
                nodes.extend(n for n in data["@graph"] if isinstance(n, dict))
            elif isinstance(data, dict):
                nodes.append(data)
            elif isinstance(data, list):
                nodes.extend(n for n in data if isinstance(n, dict))
        return nodes

    @staticmethod
    def _parse_ingredient(raw_str: str) -> tuple[str | None, str | None, str, str | None]:
        unit_words = {
            "cup", "cups", "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
            "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
            "g", "gram", "grams", "kg", "ml", "liter", "liters", "pinch", "dash",
            "clove", "cloves", "can", "cans",
        }
        
        # Extract notes from parentheses
        notes = None
        notes_match = re.search(r"\((.*?)\)", raw_str)
        if notes_match:
            notes = notes_match.group(1).strip()
            raw_str = re.sub(r"\(.*?\)", "", raw_str).strip()

        match = re.match(r"^[\d\s\-\/\.,\u00bd\u00bc\u00be\u2153\u2154\u2155\u2156\u2157\u2158\u2159\u215a\u215b\u215c\u215d\u215e]+", raw_str.strip())
        if match:
            qty = match.group(0).strip() or None
            rest = raw_str[match.end():].strip()
            parts = rest.split()
            if parts and parts[0].lower().rstrip(".") in unit_words:
                return qty, parts[0], " ".join(parts[1:]), notes
            return qty, None, rest, notes
        return None, None, raw_str.strip(), notes

    @staticmethod
    def _find_ingredient_sections_from_html(soup: BeautifulSoup) -> list[dict[str, Any]]:
        """
        Tries multiple known recipe plugin HTML patterns to find ingredient groups.
        Returns list of {'section': str|None, 'items': [str]} in document order.
        """
        def text_of(el) -> str:
            return el.get_text(" ", strip=True)

        # Pattern 1: WPRM (WP Recipe Maker)
        wprm_groups = soup.select(".wprm-recipe-ingredient-group")
        if wprm_groups:
            result = []
            for group in wprm_groups:
                heading_el = group.select_one(".wprm-recipe-ingredient-group-name")
                section = text_of(heading_el) if heading_el else None
                items = [text_of(li) for li in group.select("li.wprm-recipe-ingredient")]
                if items:
                    result.append({"section": section, "items": items})
            if result:
                logger.info("Ingredient sections found via WPRM pattern")
                return result

        # Pattern 2: Tasty Recipes
        tasty_body = soup.select_one(".tasty-recipes-ingredients-body, .tasty-recipes-ingredients")
        if tasty_body:
            result, current_section, current_items = [], None, []
            for child in tasty_body.children:
                tag = getattr(child, "name", None)
                if tag in ("h2", "h3", "h4", "strong", "b"):
                    if current_items:
                        result.append({"section": current_section, "items": current_items})
                        current_items = []
                    current_section = text_of(child)
                elif tag in ("ul", "ol"):
                    for li in child.find_all("li"):
                        t = text_of(li)
                        if t:
                            current_items.append(t)
            if current_items:
                result.append({"section": current_section, "items": current_items})
            if result:
                logger.info("Ingredient sections found via Tasty Recipes pattern")
                return result

        # Pattern 3: Generic — find the "Ingredients" heading then scan siblings
        ingr_heading = None
        for h in soup.find_all(["h1", "h2", "h3", "h4", "h5"]):
            if "ingredient" in text_of(h).lower():
                ingr_heading = h
                break

        if ingr_heading:
            stop_words = {"instructions", "directions", "method", "steps", "preparation"}
            result, current_section, current_items = [], None, []
            for sib in ingr_heading.find_next_siblings():
                tag = getattr(sib, "name", None)
                if not tag:
                    continue
                sib_text_lower = text_of(sib).lower()
                # Stop when we hit the instructions section
                if tag in ("h1", "h2", "h3", "h4", "h5") and any(w in sib_text_lower for w in stop_words):
                    break
                if tag in ("h3", "h4", "h5", "h6") and "ingredient" not in sib_text_lower:
                    if current_items:
                        result.append({"section": current_section, "items": current_items})
                        current_items = []
                    current_section = text_of(sib)
                elif tag in ("ul", "ol"):
                    for li in sib.find_all("li", recursive=True):
                        t = text_of(li)
                        if t:
                            current_items.append(t)
            if current_items:
                result.append({"section": current_section, "items": current_items})
            if result:
                logger.info("Ingredient sections found via generic heading pattern")
                return result

        return []

    @staticmethod
    def _assign_sections_to_ingredients(
        flat_json_ld: list[str],
        html_groups: list[dict[str, Any]],
    ) -> list[str | None]:
        """
        Matches each JSON-LD ingredient string to a section name from HTML groups.
        Uses word-overlap scoring + ordered sequential matching (JSON-LD and HTML
        share the same document order, so we advance a pointer as we match).
        """
        def norm(s: str) -> str:
            # Strip parenthetical notes, then remove non-word chars, lowercase
            s = re.sub(r"\(.*?\)", "", s)
            return re.sub(r"[^\w\s]", "", s.lower()).strip()

        def word_overlap(a: str, b: str) -> float:
            # Fraction of the shorter set's words found in the other
            wa = set(a.split()) - {""}
            wb = set(b.split()) - {""}
            if not wa or not wb:
                return 0.0
            shorter = wa if len(wa) <= len(wb) else wb
            return len(wa & wb) / len(shorter)

        # Flatten HTML groups into an ordered list with 'used' flag
        html_flat: list[dict] = [
            {"norm": norm(item), "section": g["section"], "used": False}
            for g in html_groups
            for item in g["items"]
        ]

        if not html_flat:
            return [None] * len(flat_json_ld)

        THRESHOLD = 0.5   # minimum word-overlap to count as a match
        LOOKAHEAD = 6     # how many HTML items ahead we scan before global fallback

        sections: list[str | None] = []
        html_cursor = 0   # tracks our position in html_flat (advances with each match)

        for raw in flat_json_ld:
            raw_norm = norm(raw)

            # 1) Ordered scan: look at the next LOOKAHEAD unused items
            best_score = 0.0
            best_idx = -1
            for i in range(html_cursor, min(html_cursor + LOOKAHEAD, len(html_flat))):
                if html_flat[i]["used"]:
                    continue
                score = word_overlap(raw_norm, html_flat[i]["norm"])
                if score > best_score:
                    best_score = score
                    best_idx = i

            # 2) Global fallback scan if no good match found in window
            if best_score < THRESHOLD:
                for i, item in enumerate(html_flat):
                    if item["used"]:
                        continue
                    score = word_overlap(raw_norm, item["norm"])
                    if score > best_score:
                        best_score = score
                        best_idx = i

            if best_score >= THRESHOLD and best_idx >= 0:
                html_flat[best_idx]["used"] = True
                sections.append(html_flat[best_idx]["section"])
                html_cursor = best_idx + 1
            else:
                # No match found — inherit the section at the current cursor position
                cur_section = html_flat[html_cursor]["section"] if html_cursor < len(html_flat) else None
                sections.append(cur_section)

        return sections

    @staticmethod
    def _extract_thumbnail(node: dict[str, Any]) -> str | None:
        """Extracts image URL from JSON-LD node (string, list, or object)."""
        img_node = node.get("image")
        if not img_node:
            return None
        
        # If it's a string, use it
        if isinstance(img_node, str):
            return img_node
            
        # If it's a list, use the first item (could be a string or object)
        if isinstance(img_node, list) and len(img_node) > 0:
            first = img_node[0]
            if isinstance(first, str):
                return first
            if isinstance(first, dict):
                return first.get("url") or first.get("contentUrl")
                
        # If it's a dict (ImageObject)
        if isinstance(img_node, dict):
            return img_node.get("url") or img_node.get("contentUrl")
            
        return None

    @staticmethod
    def _find_fallback_image(soup: BeautifulSoup) -> str | None:
        """Heuristic-based fallback image search from HTML metadata and body."""
        # 1. OpenGraph
        og_img = soup.find("meta", attrs={"property": "og:image"})
        if og_img and og_img.get("content"):
            return og_img["content"]
            
        # 2. Twitter Card
        tw_img = soup.find("meta", attrs={"name": "twitter:image"})
        if tw_img and tw_img.get("content"):
            return tw_img["content"]
            
        # 3. Look for images with 'recipe' or 'featured' in class/alt
        # This targets the "main" image logic requested by the user
        featured = soup.find("img", class_=re.compile(r"recipe|featured|attachment-large", re.I))
        if featured and featured.get("src"):
            return featured["src"]

        # 4. Large image near title or in article
        article = soup.find(["article", "main", "div.recipe-container", "div.wprm-recipe-container"])
        if article:
            first_img = article.find("img", src=True)
            if first_img:
                return first_img["src"]
                
        return None

    @staticmethod
    def _map_json_ld_to_recipe(node: dict[str, Any], soup: BeautifulSoup | None = None) -> RecipeOutput:
        import html as html_mod

        # Collect flat JSON-LD ingredient strings
        flat_json_ld = [
            html_mod.unescape(r.strip())
            for r in (node.get("recipeIngredient") or [])
            if isinstance(r, str) and r.strip()
        ]

        # Try to get ingredient sections from HTML
        html_groups = ScraperService._find_ingredient_sections_from_html(soup) if soup else []
        section_assignments = ScraperService._assign_sections_to_ingredients(flat_json_ld, html_groups)

        ingredients = []
        for raw, section in zip(flat_json_ld, section_assignments):
            qty, unit, name, notes = ScraperService._parse_ingredient(raw)
            ingredients.append({
                "name": name,
                "quantity": qty,
                "unit": unit,
                "section": section,
                "source": [Source.JSON_LD.value],
                "confidence": "high",
                "notes": notes,
            })

        raw_steps: list[dict] = []

        def extract_steps(elements, current_section=None):
            if not isinstance(elements, list):
                elements = [elements]
            for el in elements:
                if isinstance(el, str):
                    if el.strip():
                        raw_steps.append({"text": html_mod.unescape(el.strip()), "section": current_section})
                elif isinstance(el, dict):
                    if el.get("@type") == "HowToSection":
                        section_name = el.get("name", "").strip() or current_section
                        extract_steps(el.get("itemListElement", []), section_name)
                    elif el.get("@type") == "HowToStep":
                        text = el.get("text", "").strip()
                        if text:
                            raw_steps.append({"text": html_mod.unescape(text), "section": current_section})
                    else:
                        text = el.get("text", "").strip()
                        if text:
                            raw_steps.append({"text": html_mod.unescape(text), "section": current_section})

        extract_steps(node.get("recipeInstructions", []) or [])

        formatted_steps = [
            {
                "step_number": idx,
                "instruction": step["text"],
                "section": step["section"],
                "source": [Source.JSON_LD.value],
                "confidence": "high",
                "missing_details": [],
            }
            for idx, step in enumerate(raw_steps, 1)
        ]

        title = node.get("name", "")
        description = node.get("description", "")
        recipe_notes = node.get("recipeNotes", "")
        
        if isinstance(recipe_notes, list):
            recipe_notes = "\n".join([str(n) for n in recipe_notes])

        # Fallback to finding "Notes" heading or plugin-specific containers in HTML
        if not recipe_notes and soup:
            # Check for common recipe plugin note containers
            plugin_notes = soup.find(class_=re.compile(r"recipe-notes|notes-container", re.I))
            if plugin_notes:
                recipe_notes = plugin_notes.get_text("\n", strip=True)
                # Remove the "Notes" prefix if it exists as a header inside
                recipe_notes = re.sub(r"^(notes|recipe notes)\n+", "", recipe_notes, flags=re.I)
            else:
                # Heuristic: find a heading that looks like "Notes"
                notes_heading = soup.find(["h2", "h3", "h4", "h5"], string=re.compile(r"^\s*(notes|recipe notes)\s*$", re.I))
                if not notes_heading:
                    # Try a more relaxed match if exact fails
                    notes_heading = soup.find(["h2", "h3", "h4", "h5"], string=re.compile(r"notes", re.I))
                
                if notes_heading:
                    notes_content = []
                    for sib in notes_heading.find_next_siblings():
                        if sib.name in ["h1", "h2", "h3", "h4", "h5"]: break
                        text = sib.get_text(" ", strip=True)
                        if text: notes_content.append(text)
                    recipe_notes = "\n".join(notes_content)

        # Log extraction metadata to backend console as requested
        logger.info(f"EXTRACTION METADATA - Title: {title}")
        logger.info(f"EXTRACTION METADATA - Sources used: {[Source.JSON_LD.value]}")
        logger.info(f"EXTRACTION METADATA - Notes extracted: {bool(recipe_notes)}")

        # Image Extraction
        thumb_url = ScraperService._extract_thumbnail(node)
        if not thumb_url and soup:
            thumb_url = ScraperService._find_fallback_image(soup)

        return RecipeOutput.model_validate({
            "title": html_mod.unescape(title) if title else None,
            "description": html_mod.unescape(description) if description else None,
            "source_url": None,
            "thumbnail_url": thumb_url,
            "ingredients": ingredients,
            "steps": formatted_steps,
            "notes": html_mod.unescape(recipe_notes).strip() if recipe_notes else None,
            "missing_information": [],
            "overall_confidence": "high",
        })

    async def parse(self, url: str) -> tuple[RecipeOutput | None, str | None]:
        try:
            raw_html = await self._fetch_html(url)
            soup = BeautifulSoup(raw_html, "html.parser")
            nodes = self._collect_json_ld_nodes(raw_html)
            for node in nodes:
                node_type = node.get("@type")
                is_recipe = node_type == "Recipe" or (isinstance(node_type, list) and "Recipe" in node_type)
                if is_recipe:
                    recipe = self._map_json_ld_to_recipe(node, soup)
                    recipe.source_url = url
                    logger.info("JSON-LD recipe detected for %s", url)
                    return recipe, None

            # Try to extract from HTML patterns before giving up
            html_groups = self._find_ingredient_sections_from_html(soup)
            if html_groups:
                # Found ingredients in HTML - create a basic recipe from them
                logger.info("Found ingredients via HTML patterns for %s; creating basic recipe", url)
                ingredients = []
                for group in html_groups:
                    section = group.get("section")
                    for item_text in group.get("items", []):
                        qty, unit, name, notes = self._parse_ingredient(item_text)
                        ingredients.append(Ingredient(
                            name=name,
                            quantity=qty,
                            unit=unit,
                            section=section,
                            notes=notes,
                            source=[Source.WEBSITE_TEXT],
                        ))
                
                if ingredients:
                    # Extract title if possible
                    title = None
                    h1 = soup.find("h1")
                    if h1:
                        title = h1.get_text(strip=True)
                    
                    recipe = RecipeOutput(
                        title=title or "Recipe",
                        ingredients=ingredients,
                        source_url=url,
                    )
                    return recipe, None

            # Fallback: return text for OpenAI extraction
            for tag_name in ["script", "style", "nav", "header", "footer", "noscript"]:
                for tag in soup.find_all(tag_name):
                    tag.decompose()
            body_text = soup.get_text(" ", strip=True)
            logger.info("No JSON-LD or HTML recipe patterns found for %s; returning text fallback", url)
            return None, body_text
        except Exception:
            logger.exception("Failed scraping website %s", url)
            raise
