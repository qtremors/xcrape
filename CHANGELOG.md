# xcrape Changelog

> **Project:** xcrape
> **Version:** 0.1.0
> **Last Updated:** 2026-02-23

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Export results to CSV.

---

## [0.1.0] - 2026-02-23

### Added
- Core scraping logic using Playwright and Chromium.
- FastAPI backend with asynchronous job processing.
- SQLite persistence for job status and results using `aiosqlite`.
- Basic dashboard UI with Jinja2 templates.
- Support for CSS selector based extraction.
- Automatic browser installation via `uv run playwright install`.

[Unreleased]: https://github.com/qtremors/xcrape/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/qtremors/xcrape/releases/tag/v0.1.0
