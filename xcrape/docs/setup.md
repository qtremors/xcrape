# X-Crape Setup

This is a modern, lightweight, locally-hosted web scraper.

## Installation

Ensure you have [uv](https://github.com/astral-sh/uv) installed.

```sh
# The project has a .python-version file and pyproject.toml
# You can just run the project using uv

# Install browsers (already done)
uv run playwright install chromium
```

## Running the App

```sh
# Start the FastAPI server on port 8000
uv run uvicorn app.main:app --reload
```

## Usage
1. Open [http://localhost:8000](http://localhost:8000).
2. Enter a target URL in the New Job form.
3. Provide an optional CSS selector to pull specific text elements.
4. Click "Start Scrape" and watch the job status update dynamically.
