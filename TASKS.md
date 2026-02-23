# xcrape - Tasks

> **Project:** xcrape
> **Version:** 0.1.0
> **Last Updated:** 2026-02-23

### Status Legend

| Icon | Meaning |
|------|---------|
| `[ ]` | Not started |
| `[/]` | In progress |
| `[x]` | Completed |

---

### High Priority

- [ ] [Feature] CSV/JSON Export
  - Allow users to download scraped data in common formats.
- [ ] [Bug] Handle Timeout Errors Better
  - Improve error reporting when a site takes too long to load.

### Medium Priority

- [ ] [Feature] Multi-browser Support
  - Add options to use Firefox or WebKit in addition to Chromium.
- [ ] [Refactor] Componentize Frontend JS
  - Move inline scripts to separate files in `static/js`.

### Low Priority

- [ ] [Docs] Add inline code comments
  - Document complex logic in `scraper.py`.

---

### Completed

- [x] [Feature] Core Scraper Architecture — `v0.1.0`
- [x] [Feature] SQLite Persistence — `v0.1.0`
- [x] [Docs] Migration to Standard Templates — `v0.1.0`

---

### Backlog / Ideas

- Scheduled scrapes (Cron jobs)
- Proxy rotation support
- Image/Screenshot extraction