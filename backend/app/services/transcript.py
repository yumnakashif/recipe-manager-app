import logging
import re

from app.models import TranscriptInfo

logger = logging.getLogger(__name__)


class TranscriptAnalyzer:
    COOKING_VERBS = ("mix", "stir", "bake", "cook", "add", "boil", "saute", "whisk", "fry")

    def analyze(self, transcript: str, caption_type: str | None = None) -> TranscriptInfo:
        text = transcript or ""
        lower = text.lower()
        word_count = len(lower.split())
        has_cooking_verbs = any(verb in lower for verb in self.COOKING_VERBS)
        has_numeric_quantities = bool(re.search(r"\b\d+([./]\d+)?\b", lower))
        info = TranscriptInfo(
            word_count=word_count,
            has_cooking_verbs=has_cooking_verbs,
            has_numeric_quantities=has_numeric_quantities,
            is_low_signal=word_count < 80,
            caption_type=caption_type,
        )
        logger.debug("Transcript analyzed: %s", info.model_dump())
        return info
