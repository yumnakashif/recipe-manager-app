import logging
import re
from urllib.parse import urlparse

from app.models import (
    ExtractionMetadata,
    ExtractionResponse,
    ExtractionStage,
    ExtractionStatus,
)
from app.services.openai_service import OpenAIService
from app.services.scraper import ScraperService
from app.services.transcript import TranscriptAnalyzer
from app.services.youtube import YouTubeService

logger = logging.getLogger(__name__)

URL_RE = re.compile(r"https?://[^\s)>\"]+")


class ExtractionOrchestrator:
    def __init__(
        self,
        youtube_service: YouTubeService | None = None,
        scraper_service: ScraperService | None = None,
        openai_service: OpenAIService | None = None,
        transcript_analyzer: TranscriptAnalyzer | None = None,
    ) -> None:
        self.youtube_service = youtube_service or YouTubeService()
        self.scraper_service = scraper_service or ScraperService()
        self.openai_service = openai_service or OpenAIService()
        self.transcript_analyzer = transcript_analyzer or TranscriptAnalyzer()

    @staticmethod
    def _is_youtube_url(url: str) -> bool:
        host = (urlparse(url).hostname or "").lower()
        return "youtube.com" in host or "youtu.be" in host

    @staticmethod
    def _has_recipe_in_description(description: str) -> bool:
        desc_lower = (description or "").lower()
        markers = [
            "ingredients", "instructions", "directions", "recipe:",
            "cups", "tbsp", "tablespoon", "tsp", "teaspoon",
            " cup ", " oz ", " lb ", " gram", " ml ",
        ]
        return any(marker in desc_lower for marker in markers)

    @staticmethod
    def _find_short_circuit_url(description: str, comments: list[str]) -> str | None:
        ignore_domains = [
            "instagram.com", "amazon.com", "facebook.com", "tiktok.com", "twitter.com",
            "youtube.com", "youtu.be", "amzn.to", "amzn.com", "linktr.ee",
            "bit.ly", "ow.ly", "tinyurl.com", "t.co", "goo.gl", "ift.tt",
            "spotify.com", "apple.com", "patreon.com", "ko-fi.com",
            "shop.com", "etsy.com", "ebay.com",
        ]
        
        for text in [description, *comments]:
            for match in URL_RE.findall(text or ""):
                try:
                    parsed = urlparse(match)
                    host = (parsed.hostname or "").lower()
                    
                    if any(ignored in host for ignored in ignore_domains):
                        continue
                    
                    path = parsed.path.rstrip("/")
                    if not path:
                        continue
                        
                    return match
                except Exception:
                    continue
        return None

    async def _extract_from_website_stage(self, url: str) -> tuple[ExtractionResponse, ExtractionStage]:
        parsed_recipe, website_text = await self.scraper_service.parse(url)
        if parsed_recipe is not None:
            parsed_recipe.source_url = url
            return (
                ExtractionResponse(
                    status=ExtractionStatus.COMPLETE,
                    recipe=parsed_recipe,
                    metadata=ExtractionMetadata(stage_used=ExtractionStage.WEBSITE_JSON_LD),
                ),
                ExtractionStage.WEBSITE_JSON_LD,
            )
        if not website_text:
            return (
                ExtractionResponse(
                    status=ExtractionStatus.NO_RECIPE_DETECTED,
                    recipe=None,
                    metadata=ExtractionMetadata(stage_used=ExtractionStage.WEBSITE_SCRAPE),
                    error_message="No recipe content found on website.",
                ),
                ExtractionStage.WEBSITE_SCRAPE,
            )

        recipe = await self.openai_service.extract_from_website(website_text)
        recipe.source_url = url
        return (
            ExtractionResponse(
                status=ExtractionStatus.COMPLETE if (recipe.ingredients or recipe.steps) else ExtractionStatus.INCOMPLETE,
                recipe=recipe,
                metadata=ExtractionMetadata(stage_used=ExtractionStage.WEBSITE_SCRAPE),
            ),
            ExtractionStage.WEBSITE_SCRAPE,
        )

    async def extract(self, url: str) -> ExtractionResponse:
        try:
            # Validate URL
            url = url.strip()
            if not url:
                return ExtractionResponse(
                    status=ExtractionStatus.NO_RECIPE_DETECTED,
                    recipe=None,
                    metadata=None,
                    error_message="No recipe found for this link.",
                )
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return ExtractionResponse(
                    status=ExtractionStatus.NO_RECIPE_DETECTED,
                    recipe=None,
                    metadata=None,
                    error_message="No recipe found for this link.",
                )

            if not self._is_youtube_url(url):
                response, _ = await self._extract_from_website_stage(url)
                if response.recipe:
                    response.recipe.source_url = url
                return response

            yt_data = await self.youtube_service.extract(url)
            
            # Priority 1: Description Heuristic
            short_circuit_url = None
            if self._has_recipe_in_description(yt_data.description):
                logger.info("Smart Routing: Recipe markers found in description. Bypassing link hunt.")
            else:
                # Priority 2: Strict Link Heuristic
                short_circuit_url = self._find_short_circuit_url(yt_data.description, yt_data.comments)
            
            # Priority 3: Try short circuit, but fallback on failure
            if short_circuit_url:
                logger.info("Smart Routing: Deep link found, attempting short-circuit: %s", short_circuit_url)
                try:
                    response, stage = await self._extract_from_website_stage(short_circuit_url)
                    if response.status == ExtractionStatus.COMPLETE:
                        if response.recipe:
                            response.recipe.video_url = url
                            response.recipe.source_url = short_circuit_url
                            if not response.recipe.thumbnail_url:
                                response.recipe.thumbnail_url = yt_data.metadata.get("thumbnail_url")
                        if response.metadata:
                            response.metadata.video_id = yt_data.metadata.get("video_id")
                            response.metadata.video_title = yt_data.metadata.get("video_title")
                            response.metadata.channel_name = yt_data.metadata.get("channel_name")
                            response.metadata.duration_seconds = yt_data.metadata.get("duration_seconds")
                            response.metadata.short_circuit_url = short_circuit_url
                            response.metadata.stage_used = stage
                        return response
                    logger.info("Smart Routing: Short circuit failed (%s). Falling back to YouTube extract.", response.status)
                except Exception as sc_exc:
                    logger.warning("Smart Routing: Short circuit threw exception (%s). Falling back to YouTube extract.", sc_exc)

            # Fallback to OpenAI YouTube extraction

            transcript_info = self.transcript_analyzer.analyze(
                yt_data.transcript,
                caption_type=yt_data.metadata.get("caption_type"),
            )
            recipe = await self.openai_service.extract_from_youtube(
                transcript=yt_data.transcript,
                description=yt_data.description,
            )
            recipe.video_url = url
            recipe.source_url = short_circuit_url
            recipe.thumbnail_url = recipe.thumbnail_url or yt_data.metadata.get("thumbnail_url")

            # After OpenAI extraction: check if it actually found a recipe
            has_ingredients = bool(recipe.ingredients)
            has_steps = bool(recipe.steps)
            if not has_ingredients and not has_steps:
                return ExtractionResponse(
                    status=ExtractionStatus.NO_RECIPE_DETECTED,
                    recipe=None,
                    metadata=ExtractionMetadata(
                        stage_used=ExtractionStage.YOUTUBE_TRANSCRIPT,
                        video_id=yt_data.metadata.get("video_id"),
                        video_title=yt_data.metadata.get("video_title"),
                        channel_name=yt_data.metadata.get("channel_name"),
                    ),
                    error_message="No recipe was found in this video. It may not be a cooking/recipe video, or the content wasn't clear enough to extract.",
                )

            status = ExtractionStatus.COMPLETE
            return ExtractionResponse(
                status=status,
                recipe=recipe,
                metadata=ExtractionMetadata(
                    stage_used=ExtractionStage.YOUTUBE_TRANSCRIPT,
                    video_id=yt_data.metadata.get("video_id"),
                    video_title=yt_data.metadata.get("video_title"),
                    channel_name=yt_data.metadata.get("channel_name"),
                    duration_seconds=yt_data.metadata.get("duration_seconds"),
                    transcript_info=transcript_info,
                    short_circuit_url=None,
                ),
            )
        except Exception as exc:
            logger.exception("Extraction failed for URL: %s", url)
            return ExtractionResponse(
                status=ExtractionStatus.NO_RECIPE_DETECTED,
                recipe=None,
                metadata=None,
                error_message="No recipe found for this link.",
            )
