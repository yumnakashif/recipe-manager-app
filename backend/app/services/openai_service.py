import asyncio
import json
import logging

from openai import AsyncOpenAI

from app.config import get_settings
from app.models import RecipeOutput

logger = logging.getLogger(__name__)


class OpenAIService:
    def __init__(self, model: str | None = None, max_retries: int | None = None) -> None:
        settings = get_settings()
        api_key = settings.openai_api_key
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set")
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model or settings.openai_model
        self.max_retries = max_retries if max_retries is not None else settings.openai_max_retries

    @staticmethod
    def _system_prompt() -> str:
        return (
            "You are a strict recipe extraction engine.\n"
            "Return ONLY valid JSON matching this schema exactly:\n"
            "{\n"
            '  "title": string|null,\n'
            '  "description": string|null,\n'
            '  "source_url": string|null,\n'
            '  "thumbnail_url": string|null,\n'
            '  "ingredients": [{"name": string, "quantity": string|null, "unit": string|null, '
            '"section": string|null, '
            '"source": ["transcript"|"description"|"website_text"|"json_ld"], '
            '"confidence": "high"|"medium"|"low", "notes": string|null}],\n'
            '  "steps": [{"step_number": integer>=1, "instruction": string, '
            '"section": string|null, '
            '"source": ["transcript"|"description"|"website_text"|"json_ld"], '
            '"confidence": "high"|"medium"|"low", '
            '"missing_details": ["temperature"|"time"|"quantity"|"ingredient"]}],\n'
            '  "notes": string|null,\n'
            '  "missing_information": [string],\n'
            '  "overall_confidence": "high"|"medium"|"low"\n'
            "}\n"
            "IMPORTANT: If the recipe has named sections (e.g. 'For the Sauce', 'For the Chicken Katsu', 'Make the Roux'), "
            "set the 'section' field on each ingredient/step to that section name.\n"
            "IMPORTANT: If an ingredient includes details in parentheses (e.g. '1 onion (thinly sliced)', 'ground coriander (to taste)'), "
            "CLEAN the name and MOVE the content in parentheses to the 'notes' field (e.g. name: 'onion', notes: 'thinly sliced')."
        )

    async def _extract(self, user_payload: str) -> RecipeOutput:
        for attempt in range(1, self.max_retries + 1):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": self._system_prompt()},
                        {"role": "user", "content": user_payload},
                    ],
                    temperature=0.2,
                )
                raw = response.choices[0].message.content or "{}"
                parsed = json.loads(raw)
                output = RecipeOutput.model_validate(parsed)
                
                # Log metadata to backend as requested
                logger.info(f"AI EXTRACTION METADATA - Title: {output.title}")
                logger.info(f"AI EXTRACTION METADATA - Confidence: {output.overall_confidence}")
                logger.info(f"AI EXTRACTION METADATA - Ingredients: {len(output.ingredients)}")
                logger.info(f"AI EXTRACTION METADATA - Instructions: {len(output.steps)}")
                
                return output
            except Exception:
                logger.exception("OpenAI extraction attempt %s failed", attempt)
                if attempt >= self.max_retries:
                    raise
                await asyncio.sleep(1.5 * attempt)
        raise RuntimeError("OpenAI extraction failed unexpectedly")

    async def extract_from_youtube(self, transcript: str, description: str) -> RecipeOutput:
        payload = (
            "Extract one recipe from this YouTube content.\n"
            "Prioritize exact quantities from description and use transcript for steps.\n"
            "SECTION DETECTION: In YouTube descriptions, ingredient/step sections are often "
            "indicated by a line that ends with a colon (e.g. 'Spices:', 'Toppings:', 'For the Sauce:', 'Marinade:'). "
            "When you see such a line, set the 'section' field on every ingredient or step that follows it "
            "until the next section heading or end of list. If no sections exist, set section to null.\n\n"
            f"DESCRIPTION:\n{description}\n\n"
            f"TRANSCRIPT:\n{transcript}"
        )
        return await self._extract(payload)

    async def extract_from_website(self, website_text: str) -> RecipeOutput:
        payload = (
            "Extract one recipe from this webpage text.\n"
            "Prefer clear ingredients and steps from content context.\n\n"
            f"WEBSITE_TEXT:\n{website_text}"
        )
        return await self._extract(payload)
