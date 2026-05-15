import logging
import sys
from contextlib import asynccontextmanager

from typing import Annotated

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models import ExtractionRequest, ExtractionResponse, RecipeOutput
from app.services import ExtractionOrchestrator, PersistenceService

settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)
orchestrator: ExtractionOrchestrator | None = None
persistence: PersistenceService | None = None


def get_token(authorization: str | None = None) -> str | None:
    if not authorization:
        return None
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            return None
        return token
    except Exception:
        return None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global orchestrator, persistence
    logger.info("Starting Recipe Manager Extraction API")
    orchestrator = ExtractionOrchestrator()
    try:
        persistence = PersistenceService()
        logger.info("Persistence service initialized")
    except Exception as e:
        logger.warning("Persistence service not initialized: %s", e)
    yield
    logger.info("Shutting down Recipe Manager Extraction API")


app = FastAPI(title="Recipe Manager Extraction API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract", response_model=ExtractionResponse)
async def extract(request: ExtractionRequest) -> ExtractionResponse:
    if orchestrator is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    return await orchestrator.extract(request.url)

@app.post("/save")
async def save(recipe: RecipeOutput, authorization: Annotated[str | None, Header()] = None) -> dict[str, str]:
    if persistence is None:
        raise HTTPException(status_code=503, detail="Persistence not configured")
    try:
        token = get_token(authorization)
        recipe_id = persistence.save_recipe(recipe, auth_token=token)
        return {"recipe_id": recipe_id}
    except Exception as e:
        logger.exception("Save failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/recipes/{recipe_id}")
async def update(recipe_id: str, recipe: RecipeOutput, authorization: Annotated[str | None, Header()] = None) -> dict[str, str]:
    if persistence is None:
        raise HTTPException(status_code=503, detail="Persistence not configured")
    try:
        token = get_token(authorization)
        persistence.update_recipe(recipe_id, recipe, auth_token=token)
        return {"status": "ok", "recipe_id": recipe_id}
    except Exception as e:
        logger.exception("Update failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recipes")
async def list_recipes(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    search: str | None = Query(None),
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    if persistence is None:
        raise HTTPException(status_code=503, detail="Persistence not configured")
    try:
        token = get_token(authorization)
        offset = (page - 1) * page_size
        items, total = persistence.list_recipes(
            limit=page_size,
            offset=offset,
            search=search,
            auth_token=token,
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        logger.exception("List recipes failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str, authorization: Annotated[str | None, Header()] = None) -> dict[str, object]:
    if persistence is None:
        raise HTTPException(status_code=503, detail="Persistence not configured")
    try:
        token = get_token(authorization)
        return persistence.get_recipe(recipe_id, auth_token=token)
    except Exception as e:
        logger.exception("Get recipe failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, authorization: Annotated[str | None, Header()] = None) -> dict[str, str]:
    if persistence is None:
        raise HTTPException(status_code=503, detail="Persistence not configured")
    try:
        token = get_token(authorization)
        persistence.delete_recipe(recipe_id, auth_token=token)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Delete recipe failed")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
