import asyncio
import types
from typing import Any

import pytest

from app.models import ExtractionStatus, RecipeOutput
from app.services.extraction import ExtractionOrchestrator


@pytest.mark.asyncio
async def test_youtube_short_circuit_to_website(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeYouTubeData:
        def __init__(self) -> None:
            self.metadata = {
                "video_id": "vid123",
                "video_title": "Guac",
                "channel_name": "Chef",
                "duration_seconds": 60,
                "thumbnail_url": None,
                "caption_type": "manual",
            }
            self.description = "Check the full recipe: https://cookieandkate.com/best-guacamole-recipe/"
            self.transcript = ""
            self.comments: list[str] = []

    async def fake_yt_extract(url: str):
        return FakeYouTubeData()

    async def fake_scraper_parse(url: str):
        assert "cookieandkate.com" in url
        # Return parsed RecipeOutput (JSON-LD path)
        return RecipeOutput.model_validate(
            {
                "title": "Best Guacamole",
                "description": None,
                "source_url": url,
                "thumbnail_url": None,
                "ingredients": [{"name": "Avocado", "quantity": "2", "unit": None, "source": ["json_ld"], "confidence": "high"}],
                "steps": [{"step_number": 1, "instruction": "Mash avocados", "source": ["json_ld"], "confidence": "high", "missing_details": []}],
                "missing_information": [],
                "overall_confidence": "high",
            }
        ), None

    orch = ExtractionOrchestrator()

    monkeypatch.setattr(orch.youtube_service, "extract", fake_yt_extract)
    monkeypatch.setattr(orch.scraper_service, "parse", fake_scraper_parse)

    result = await orch.extract("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert result.status == ExtractionStatus.COMPLETE
    assert result.recipe is not None
    assert result.recipe.title == "Best Guacamole"
