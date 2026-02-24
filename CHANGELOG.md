# xcrape Changelog

> **Project:** xcrape
> **Version:** 0.2.0
> **Last Updated:** 2026-02-23

---

## [0.2.0] - 2026-02-23

### Added

#### Backend — Scraper
- Comprehensive data extraction: meta tags, headings (H1–H6), all links (internal/external), images, tables, lists, text content.
- Screenshot capture (JPEG) via Playwright on every scrape.
- Technology detection — identifies 15+ frameworks/CMS (React, Vue, Next.js, WordPress, Shopify, etc.).
- Social media link extraction — detects 15+ platforms (Twitter, GitHub, LinkedIn, YouTube, etc.).
- Structured data extraction — JSON-LD, OpenGraph, and Twitter Card metadata.
- Page stats: word count, HTML size, load time, resource counts.
- Structured error reporting with `error_type` and `load_time_seconds`.

#### Backend — API
- `GET /api/jobs/{id}` — single job detail endpoint.
- `DELETE /api/jobs/{id}` — delete a job.
- `POST /api/jobs/{id}/rescrape` — re-scrape the same URL as a new job.
- `GET /api/jobs/{id}/images/{index}` — proxy-download a single scraped image.
- `GET /api/jobs/{id}/images/download-all` — download all scraped images as a ZIP archive.
- `GET /api/jobs/{id}/export?format=json` — download job data as JSON.
- `GET /api/jobs/{id}/export?format=csv` — download job data as CSV.

#### Backend — Database
- `created_at` timestamp column on jobs table.
- Auto-migration for existing databases.
- `delete_job()` function.

#### Frontend — Material Design 3 TUI
- Complete UI overhaul with Material Design 3 dark theme tonal palette.
- Terminal-style window chrome (title bar dots, ASCII art logo, status footer).
- JetBrains Mono monospace font for TUI aesthetic.
- M3 shape system: rounded cards, full-round buttons/badges.
- M3 state layers (8% hover, 12% press) on all interactive elements.
- 48px minimum touch targets for accessibility.
- Fluid responsive layout adapting to any screen size.

#### Frontend — Data Display
- 12 tabbed data views: Screenshot, Meta, Headings, Links, Images, Text, Tables, Tech, Social, Structured, Stats, Raw.
- Image thumbnails with lazy loading in the Images tab.
- Individual image download buttons and bulk "Download All" as ZIP.
- Search/filter bar to filter jobs by URL or status.
- Per-section copy-to-clipboard buttons.
- Global copy button (copies all data minus screenshot).
- Re-scrape button in both job table rows and detail panel.
- Toast notification system (replaces browser alerts).
- Keyboard shortcut: `Esc` to close detail panel.
- Auto-refresh with visual status indicator in footer.

### Changed
- Replaced deprecated `@app.on_event("startup")` with FastAPI `lifespan`.
- Scraper now retries with `domcontentloaded` if `networkidle` times out.
- Links are no longer capped at 15; all links are captured with internal/external classification.
- Background scraper threads run as daemon threads.

### Fixed
- README setup instructions now use correct paths (`cd xcrape/xcrape`, `uv run uvicorn app.main:app`).

---

## [0.1.0] - 2026-02-23

### Added
- Core scraping logic using Playwright and Chromium.
- FastAPI backend with asynchronous job processing.
- SQLite persistence for job status and results using `aiosqlite`.
- Basic dashboard UI with Jinja2 templates.
- Support for CSS selector based extraction.
- Automatic browser installation via `uv run playwright install`.

---
