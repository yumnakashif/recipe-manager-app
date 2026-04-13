# Recipe Manager Backend

A FastAPI-based backend for extracting and managing recipe data from YouTube videos and food blogs using AI-powered extraction and web scraping.

## Tech Stack

- **Framework:** FastAPI (Python)
- **Server:** Uvicorn
- **Data Validation:** Pydantic
- **LLM Engine:** OpenAI API
- **Extraction Tools:** yt-dlp (YouTube), httpx + BeautifulSoup (Web scraping)
- **Database:** Supabase (PostgreSQL)
- **Testing:** pytest + pytest-asyncio

## Getting Started

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Installation

1. Install dependencies from `requirements.txt`:

```bash
pip install -r requirements.txt
```

2. Create a `.env` file in the root directory of the backend with the following environment variables:

```env
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
LOG_LEVEL=INFO
```

### Running the Development Server

Start the development server on `http://localhost:8000`:

```bash
uvicorn app.main:app --reload
```

The API will be available at:
- **API endpoints:** `http://localhost:8000`
- **Interactive API docs (Swagger UI):** `http://localhost:8000/docs`
- **Alternative API docs (ReDoc):** `http://localhost:8000/redoc`

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app setup and routes
│   ├── config.py               # Configuration and environment variables
│   ├── models/
│   │   ├── extraction.py       # Extraction request/response models
│   │   └── recipe.py           # Recipe data models
│   └── services/
│       ├── extraction.py       # Orchestration logic for recipe extraction
│       ├── openai_service.py   # OpenAI API integration
│       ├── persistence.py      # Supabase database operations
│       ├── scraper.py          # Web scraping functionality
│       ├── transcript.py       # Transcript handling
│       ├── youtube.py          # YouTube-specific operations
│       └── __init__.py
├── tests/
│   ├── test_models.py
│   ├── test_orchestrator_contract.py
│   └── test_transcript.py
├── requirements.txt            # Python dependencies
├── pytest.ini                  # Pytest configuration
└── README.md                   # This file
```

## API Endpoints

- **GET `/health`:** Health check endpoint
- **POST `/extract`:** Extract recipe data from a URL (YouTube video or food blog)
- **POST `/save`:** Save extracted recipe data to the database

See the [interactive API docs](#running-the-development-server) for full endpoint details and schemas.

## Extraction Pipeline

The backend uses a 4-stage intelligent pipeline to extract recipes:

1. **Input Router:** Determines if the URL is a YouTube video or website
2. **YouTube Pipeline:** Fetches video metadata and transcripts, using LLM to extract recipe data
3. **Website Scraper Pipeline:** Uses JSON-LD structured data (if available) or scrapes HTML with LLM fallback
4. **Return & Edit Phase:** Standardizes output and returns cleaned recipe data

## Running Tests

Run all tests:

```bash
pytest
```

Run tests with verbose output:

```bash
pytest -v
```

Run a specific test file:

```bash
pytest tests/test_models.py
```

## Development

### Code Style

This project follows standard Python conventions. Consider using:
- `black` for code formatting
- `flake8` for linting
- `mypy` for type checking

### Adding Dependencies

To add a new dependency, update `requirements.txt` and reinstall:

```bash
pip install -r requirements.txt
```

## Learn More

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Uvicorn Documentation](https://www.uvicorn.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)

## License

This project is part of the Recipe Manager application.
