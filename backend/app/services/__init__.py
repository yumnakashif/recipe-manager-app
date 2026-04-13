__all__ = [
    "OpenAIService",
    "YouTubeService",
    "ScraperService",
    "TranscriptAnalyzer",
    "ExtractionOrchestrator",
    "PersistenceService",
]


def __getattr__(name: str):
    if name == "OpenAIService":
        from .openai_service import OpenAIService

        return OpenAIService
    if name == "YouTubeService":
        from .youtube import YouTubeService

        return YouTubeService
    if name == "ScraperService":
        from .scraper import ScraperService

        return ScraperService
    if name == "TranscriptAnalyzer":
        from .transcript import TranscriptAnalyzer

        return TranscriptAnalyzer
    if name == "ExtractionOrchestrator":
        from .extraction import ExtractionOrchestrator

        return ExtractionOrchestrator
    if name == "PersistenceService":
        from .persistence import PersistenceService

        return PersistenceService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
