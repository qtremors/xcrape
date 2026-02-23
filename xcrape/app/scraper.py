import json
import time
from urllib.parse import urljoin, urlparse
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from .db import update_job


async def run_scraper(job_id: int, url: str, selector: str = None):
    """Scrape a URL and extract comprehensive page data."""
    start_time = time.time()
    try:
        await update_job(job_id, "running", None)

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            # Navigate with timeout handling
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
            except Exception as nav_error:
                # Retry with domcontentloaded if networkidle times out
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                except Exception:
                    raise nav_error

            content = await page.content()
            final_url = page.url
            await browser.close()

        elapsed = round(time.time() - start_time, 2)
        soup = BeautifulSoup(content, "html.parser")
        parsed_base = urlparse(url)

        # --- Meta Information ---
        title = soup.title.string.strip() if soup.title and soup.title.string else "No Title"

        meta_tags = {}
        for tag in soup.find_all("meta"):
            name = tag.get("name") or tag.get("property") or tag.get("http-equiv")
            content_val = tag.get("content")
            if name and content_val:
                meta_tags[name.lower()] = content_val

        favicon = None
        fav_link = soup.find("link", rel=lambda r: r and "icon" in r)
        if fav_link and fav_link.get("href"):
            favicon = urljoin(url, fav_link["href"])

        canonical = None
        canon_link = soup.find("link", rel="canonical")
        if canon_link and canon_link.get("href"):
            canonical = canon_link["href"]

        # --- Headings ---
        headings = []
        for level in range(1, 7):
            for h in soup.find_all(f"h{level}"):
                text = h.get_text(strip=True)
                if text:
                    headings.append({"level": level, "text": text[:200]})

        # --- Links ---
        all_links = []
        internal_count = 0
        external_count = 0
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue
            full_url = urljoin(url, href)
            link_text = a.get_text(strip=True)[:100] or "[no text]"
            link_parsed = urlparse(full_url)
            is_internal = link_parsed.netloc == parsed_base.netloc
            if is_internal:
                internal_count += 1
            else:
                external_count += 1
            all_links.append({
                "url": full_url,
                "text": link_text,
                "internal": is_internal,
            })

        # --- Images ---
        images = []
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src")
            if src:
                images.append({
                    "src": urljoin(url, src),
                    "alt": img.get("alt", "")[:150],
                    "width": img.get("width"),
                    "height": img.get("height"),
                })

        # --- Tables ---
        tables = []
        for table in soup.find_all("table"):
            rows_data = []
            for row in table.find_all("tr")[:50]:  # Cap at 50 rows per table
                cells = []
                for cell in row.find_all(["th", "td"]):
                    cells.append(cell.get_text(strip=True)[:200])
                if cells:
                    rows_data.append(cells)
            if rows_data:
                tables.append(rows_data)

        # --- Lists ---
        lists = []
        for lst in soup.find_all(["ul", "ol"]):
            items = []
            for li in lst.find_all("li", recursive=False)[:30]:
                text = li.get_text(strip=True)[:200]
                if text:
                    items.append(text)
            if items:
                lists.append({
                    "type": lst.name,
                    "items": items,
                })
        # Cap the number of lists stored
        lists = lists[:20]

        # --- Text Content ---
        paragraphs = []
        for p_tag in soup.find_all("p"):
            text = p_tag.get_text(strip=True)
            if text and len(text) > 20:
                paragraphs.append(text[:500])
        paragraphs = paragraphs[:50]

        # --- Resource Counts ---
        script_count = len(soup.find_all("script", src=True))
        style_count = len(soup.find_all("link", rel="stylesheet"))
        inline_script_count = len([s for s in soup.find_all("script") if not s.get("src")])

        # --- Page Stats ---
        full_text = soup.get_text()
        word_count = len(full_text.split())

        # --- Selector Results ---
        selector_results = None
        if selector:
            elements = soup.select(selector)
            selector_results = []
            for el in elements:
                selector_results.append({
                    "tag": el.name,
                    "text": el.get_text(strip=True)[:500],
                    "html": str(el)[:1000],
                })

        # --- Build result ---
        extracted_data = {
            "meta": {
                "title": title,
                "description": meta_tags.get("description", ""),
                "keywords": meta_tags.get("keywords", ""),
                "og_title": meta_tags.get("og:title", ""),
                "og_description": meta_tags.get("og:description", ""),
                "og_image": meta_tags.get("og:image", ""),
                "favicon": favicon,
                "canonical": canonical,
                "final_url": final_url,
            },
            "headings": headings,
            "links": all_links,
            "images": images,
            "tables": tables,
            "lists": lists,
            "text": paragraphs,
            "selector_results": selector_results,
            "stats": {
                "word_count": word_count,
                "link_count": len(all_links),
                "internal_links": internal_count,
                "external_links": external_count,
                "image_count": len(images),
                "heading_count": len(headings),
                "table_count": len(tables),
                "list_count": len(lists),
                "script_count": script_count,
                "inline_script_count": inline_script_count,
                "style_count": style_count,
                "load_time_seconds": elapsed,
            },
        }

        await update_job(job_id, "completed", json.dumps(extracted_data))

    except Exception as e:
        elapsed = round(time.time() - start_time, 2)
        error_data = json.dumps({
            "error": str(e),
            "error_type": type(e).__name__,
            "load_time_seconds": elapsed,
        })
        await update_job(job_id, "failed", error_data)
