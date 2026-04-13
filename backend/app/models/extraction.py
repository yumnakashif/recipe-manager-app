from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from .recipe import RecipeOutput

class ExtractionStatus(str, Enum):
    COMPLETE = "complete"
    INCOMPLETE = "incomplete"
    NO_RECIPE_DETECTED = "no_recipe_detected"
    ERROR = "error"

class ExtractionStage(str, Enum):
    YOUTUBE_TRANSCRIPT = "youtube_transcript" # Stage 2
    WEBSITE_JSON_LD = "website_json_ld"       # Stage 3
    WEBSITE_SCRAPE = "website_scrape"         # Stage 3

class ExtractionRequest(BaseModel):
    # Changed from youtube_url to a generic url for the Input Router
    url: str = Field(..., description="YouTube video or Website URL to extract recipe from")

class TranscriptInfo(BaseModel):
    word_count: int = Field(..., description="Number of words in transcript")
    has_cooking_verbs: bool = Field(..., description="Whether cooking verbs were detected")
    has_numeric_quantities: bool = Field(..., description="Whether numeric quantities were found")
    is_low_signal: bool = Field(..., description="Whether transcript is classified as low-signal")
    caption_type: Optional[str] = Field(None, description="Type of captions (manual/auto)")

class ExtractionMetadata(BaseModel):
    stage_used: ExtractionStage = Field(..., description="Which extraction stage was used")
    
    # YouTube specific metadata
    video_id: Optional[str] = Field(None, description="YouTube video ID")
    video_title: Optional[str] = Field(None, description="Video title")
    channel_name: Optional[str] = Field(None, description="Channel name")
    duration_seconds: Optional[int] = Field(None, description="Video duration in seconds")
    transcript_info: Optional[TranscriptInfo] = Field(None, description="Transcript analysis info")
    
    # Short-Circuit metadata
    short_circuit_url: Optional[str] = Field(None, description="External URL found in YT description")

class ExtractionResponse(BaseModel):
    status: ExtractionStatus = Field(..., description="Status of the extraction")
    recipe: Optional[RecipeOutput] = Field(None, description="Extracted recipe data")
    metadata: Optional[ExtractionMetadata] = Field(None, description="Metadata about the process")
    error_message: Optional[str] = Field(None, description="Error message if extraction failed")