<p align="center">
  <img src="https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png" alt="xcrape Logo" width="120"/>
</p>

<h1 align="center"><a href="http://localhost:8000">xcrape</a></h1>

<p align="center">
  Smart Local Web Scraper
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-0.1.0-blue?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/Playwright-1.58.0-blue?logo=playwright" alt="Playwright">
  <img src="https://img.shields.io/badge/License-TSL-red" alt="License">
</p>

> [!NOTE]
> **Personal Project** 🎯 I built this to provide a lightweight, locally-hosted tool for dynamic web scraping without relying on external SaaS platforms.

## Live Website

**➡️ [http://localhost:8000](http://localhost:8000)**

> **Live Demo Limitations**: This app is intended to be run locally. Remote access should be secured properly.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🕷️ **Dynamic Scraping** | Uses Playwright (Chromium) to handle JavaScript-heavy sites and SPAs. |
| 💾 **Local Persistence** | Stores job status and scraped results in a local SQLite database using aiosqlite. |
| ⚡ **Async Architecture** | Built with FastAPI and async/await for efficient concurrent processing. |
| 🛠️ **Simple Form** | Enter a URL and optional CSS selector to pull specific text elements. |

---

## 📸 Screenshots

<p align="center">
  <!-- Placeholder for future screenshots -->
  <i>Dashboard screenshot coming soon...</i>
</p>

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| uv | `>=0.5.0` | [Install uv](https://github.com/astral-sh/uv) |
| Python | `>=3.12` | Included via uv |

### Setup

```bash
# Clone and navigate
git clone https://github.com/qtremors/xcrape.git
cd xcrape/xcrape

# Install dependencies
uv sync

# Setup environment
cp ../.env.example ../.env
# Fill in any required values

# Install Playwright browsers
uv run playwright install chromium

# Run the project
uv run uvicorn app.main:app --reload
```

Visit **http://localhost:8000**

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Port to run the server on (default: `8000`) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI, Pydantic, aiosqlite |
| **Scraper** | Playwright, BeautifulSoup4 |
| **Frontend** | Jinja2 Templates, Vanilla CSS/JS |
| **Tooling** | Astral uv |

---

## 📁 Project Structure

```
xcrape/
├── xcrape/               # Source code
│   ├── app/              # FastAPI application
│   │   ├── static/       # Static assets (CSS, JS)
│   │   ├── templates/    # Jinja2 HTML templates
│   │   ├── db.py         # Database interactions
│   │   ├── scraper.py    # Playwright scraping logic
│   │   └── main.py       # FastAPI routes
│   └── main.py          # Entry point
├── DEVELOPMENT.md        # Developer documentation
├── CHANGELOG.md          # Version history
├── LICENSE.md            # License terms
└── README.md
```

---

## 📊 System Resources

| Metric | Value |
|--------|-------|
| **CPU** | Low (<10%) |
| **RAM** | ~100MB + Browser |
| **Disk** | Minimal (SQLite) |

---

## 🧪 Testing

```bash
# Run tests (if applicable)
uv run pytest
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Architecture, API reference, conventions |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [TASKS.md](TASKS.md) | Planned features and known issues |
| [LICENSE.md](LICENSE.md) | License terms and attribution |

---

## 📄 License

**Tremors Source License (TSL)** - Source-available license allowing viewing, forking, and derivative works with **mandatory attribution**. Commercial use requires written permission.

Web Version: [github.com/qtremors/license](https://github.com/qtremors/license)

See [LICENSE.md](LICENSE.md) for full terms.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/qtremors">Tremors</a>
</p>
