import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx
from yt_dlp import YoutubeDL

logger = logging.getLogger(__name__)


@dataclass
class YouTubeExtractionData:
    metadata: dict[str, Any]
    description: str
    transcript: str
    comments: list[str]


class YouTubeService:
    def __init__(self) -> None:
        self._opts = {
            "quiet": True,
            "skip_download": True,
            "extract_flat": False,
        }

    def _extract_video_info(self, url: str) -> dict[str, Any]:
        logger.info("Extracting YouTube metadata for %s", url)
        with YoutubeDL(self._opts) as ydl:
            return ydl.extract_info(url, download=False)

    @staticmethod
    def _pick_caption_track(info: dict[str, Any]) -> tuple[str | None, str | None]:
        subtitles = info.get("subtitles") or {}
        auto = info.get("automatic_captions") or {}
        candidates = [("manual", subtitles.get("en")), ("auto", auto.get("en"))]
        for caption_type, tracks in candidates:
            if not tracks:
                continue
            track = next((t for t in tracks if t.get("ext") in {"json3", "vtt", "srv3"}), tracks[0])
            if track.get("url"):
                return track["url"], caption_type
        return None, None

    @staticmethod
    def _clean_caption_payload(payload: str) -> str:
        # Handles common VTT/JSON3 outputs enough for downstream LLM parsing.
        try:
            maybe_json = json.loads(payload)
            if isinstance(maybe_json, dict):
                events = maybe_json.get("events", [])
                parts: list[str] = []
                for event in events:
                    segs = event.get("segs") or []
                    parts.extend(seg.get("utf8", "") for seg in segs if isinstance(seg, dict))
                text = " ".join(parts)
                return re.sub(r"\s+", " ", text).strip()
        except Exception:
            pass
        text = re.sub(r"<[^>]+>", " ", payload)
        text = re.sub(r"\b\d{2}:\d{2}:\d{2}\.\d{3}\b", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    async def _fetch_transcript(self, info: dict[str, Any]) -> tuple[str, str | None]:
        url, caption_type = self._pick_caption_track(info)
        if not url:
            return "", None
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
        return self._clean_caption_payload(response.text), caption_type

    async def extract(self, url: str) -> YouTubeExtractionData:
        try:
            info = self._extract_video_info(url)
        except Exception as exc:
            logger.warning("Failed to fetch YouTube info for %s: %s", url, exc)
            raise

        try:
            description = info.get("description") or ""
            comments_raw = info.get("comments") or []
            comments = [
                c.get("text", "").strip()
                for c in comments_raw
                if isinstance(c, dict) and c.get("text")
            ][:10]

            transcript, caption_type = await self._fetch_transcript(info)
            metadata = {
                "video_id": info.get("id"),
                "video_title": info.get("title"),
                "channel_name": info.get("uploader"),
                "duration_seconds": info.get("duration"),
                "thumbnail_url": info.get("thumbnail"),
                "caption_type": caption_type,
            }
            return YouTubeExtractionData(
                metadata=metadata,
                description=description,
                transcript=transcript,
                comments=comments,
            )
        except Exception:
            logger.exception("Failed to process YouTube data for %s", url)
            raise
