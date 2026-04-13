from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class Source(str, Enum):
    TRANSCRIPT = "transcript"
    DESCRIPTION = "description"
    WEBSITE_TEXT = "website_text"  # Added for Stage 3 Fallback
    JSON_LD = "json_ld"            # Added for Stage 3 Structured Data

class MissingDetail(str, Enum):
    TEMPERATURE = "temperature"
    TIME = "time"
    QUANTITY = "quantity"
    INGREDIENT = "ingredient"

class Ingredient(BaseModel):
    name: str = Field(..., description="Name of the ingredient")
    quantity: Optional[str] = Field(None, description="Amount (e.g., '2', '1/2')")
    unit: Optional[str] = Field(None, description="Unit of measurement (e.g., 'cups', 'tbsp')")
    section: Optional[str] = Field(None, description="Section heading this ingredient belongs to (e.g., 'For the Roux')")
    source: List[Source] = Field(default_factory=list, description="Where this was found")
    confidence: Confidence = Field(default=Confidence.MEDIUM)
    notes: Optional[str] = Field(None, description="Prep notes (e.g., 'diced')")

class RecipeStep(BaseModel):
    step_number: int = Field(..., ge=1, description="Step number")
    instruction: str = Field(..., description="The cooking instruction")
    section: Optional[str] = Field(None, description="Section heading this step belongs to (e.g., 'Make the Roux')")
    source: List[Source] = Field(default_factory=list)
    confidence: Confidence = Field(default=Confidence.MEDIUM)
    missing_details: List[MissingDetail] = Field(default_factory=list)

class RecipeOutput(BaseModel):
    title: Optional[str] = Field(None, description="Recipe title")
    description: Optional[str] = Field(None, description="Short summary of the dish")
    source_url: Optional[str] = Field(None, description="The Website link")
    video_url: Optional[str] = Field(None, description="The YouTube link")
    thumbnail_url: Optional[str] = Field(None, description="Image of the dish")
    author_name: Optional[str] = Field(None, description="YouTube channel or Website author")
    tags: List[str] = Field(default_factory=list, description="Recipe tags (e.g., 'Dessert', 'Quick')")
    
    ingredients: List[Ingredient] = Field(default_factory=list)
    steps: List[RecipeStep] = Field(default_factory=list)
    notes: Optional[str] = Field(None, description="General recipe notes, tips, or variations")
    missing_information: List[str] = Field(default_factory=list)
    overall_confidence: Confidence = Field(default=Confidence.MEDIUM)