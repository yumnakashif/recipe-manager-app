from app.models import (
    Confidence,
    ExtractionResponse,
    ExtractionStage,
    ExtractionStatus,
    Ingredient,
    RecipeOutput,
    RecipeStep,
    Source,
)


def test_recipe_output_model_validates() -> None:
    payload = {
        "title": "Pasta",
        "ingredients": [
            {
                "name": "Salt",
                "quantity": "1",
                "unit": "tsp",
                "source": [Source.DESCRIPTION.value],
                "confidence": Confidence.HIGH.value,
            }
        ],
        "steps": [
            {
                "step_number": 1,
                "instruction": "Boil water",
                "source": [Source.TRANSCRIPT.value],
                "confidence": Confidence.MEDIUM.value,
                "missing_details": [],
            }
        ],
        "missing_information": [],
        "overall_confidence": Confidence.MEDIUM.value,
    }
    model = RecipeOutput.model_validate(payload)
    assert model.title == "Pasta"
    assert isinstance(model.ingredients[0], Ingredient)
    assert isinstance(model.steps[0], RecipeStep)


def test_extraction_response_model_validates() -> None:
    response = ExtractionResponse.model_validate(
        {
            "status": ExtractionStatus.COMPLETE.value,
            "recipe": {
                "title": "Toast",
                "ingredients": [],
                "steps": [],
                "missing_information": [],
                "overall_confidence": "low",
            },
            "metadata": {"stage_used": ExtractionStage.WEBSITE_SCRAPE.value},
        }
    )
    assert response.status == ExtractionStatus.COMPLETE
    assert response.metadata.stage_used == ExtractionStage.WEBSITE_SCRAPE
