# xcrape - Tasks

> **Project:** xcrape
> **Version:** 0.2.0
> **Last Updated:** 2026-02-23

---

### High Priority

- [ ] [Feature] Multi-browser Support
  - Add options to use Firefox or WebKit in addition to Chromium.
- [ ] [Feature] Pagination for Job List
  - Handle 100+ jobs without performance degradation.

### Medium Priority

- [ ] [Feature] Light/Dark Theme Toggle
  - Add M3 light mode tokens and toggle switch.
- [ ] [Feature] Keyboard Shortcuts Modal
  - Help overlay showing all available keyboard shortcuts.
- [ ] [Refactor] Add Type Annotations
  - Full type hints on all Python functions and return types.
- [ ] [Performance] Lazy Load Screenshot Data
  - Don't include base64 screenshot in job list API; load on demand.

### Low Priority

- [ ] [Docs] Add Inline Code Comments
  - Document complex logic in `scraper.py` helper functions.
- [ ] [Feature] Bulk Delete Jobs
  - Select multiple jobs and delete at once.
- [ ] [Feature] Link Graph Visualization
  - Visualize internal/external link structure.


### Backlog / Ideas

> Parking lot for ideas that aren't prioritized yet.

- Scheduled scrapes (Cron jobs)
- Proxy rotation support
- Robots.txt compliance checking
- Request header / User-Agent customization
- Sitemap crawling (discover and scrape multiple pages)
- Accessibility audit (basic a11y checks)
- Page performance metrics (resource weight, request count)