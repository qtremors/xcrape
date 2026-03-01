import base64
import json
import re
import time
from urllib.parse import urljoin, urlparse
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from .db import update_job

# Known social media domains
SOCIAL_DOMAINS = {
    "twitter.com": "Twitter/X", "x.com": "Twitter/X",
    "facebook.com": "Facebook", "fb.com": "Facebook",
    "instagram.com": "Instagram",
    "linkedin.com": "LinkedIn",
    "github.com": "GitHub",
    "youtube.com": "YouTube", "youtu.be": "YouTube",
    "tiktok.com": "TikTok",
    "reddit.com": "Reddit",
    "discord.gg": "Discord", "discord.com": "Discord",
    "pinterest.com": "Pinterest",
    "mastodon.social": "Mastodon",
    "threads.net": "Threads",
    "twitch.tv": "Twitch",
    "medium.com": "Medium",
}

# Technology detection patterns
TECH_PATTERNS = {
    "meta_generator": {},  # filled dynamically from <meta name="generator">
    "scripts": {
        "react": ["react", "react-dom", "reactjs"],
        "vue": ["vue.js", "vuejs", "vue.min"],
        "angular": ["angular", "ng-"],
        "svelte": ["svelte"],
        "next.js": ["_next/", "__next"],
        "nuxt.js": ["_nuxt/", "__nuxt"],
        "jquery": ["jquery"],
        "bootstrap": ["bootstrap"],
        "tailwind": ["tailwindcss", "tailwind"],
        "webpack": ["webpack", "__webpack"],
        "vite": ["vite", "@vite"],
        "gatsby": ["gatsby"],
        "remix": ["remix"],
        "astro": ["astro"],
    },
    "headers": {
        "wordpress": ["wp-content", "wp-includes", "wordpress"],
        "shopify": ["shopify", "cdn.shopify"],
        "wix": ["wix.com", "parastorage"],
        "squarespace": ["squarespace"],
        "drupal": ["drupal"],
        "ghost": ["ghost"],
    },
}


def _detect_technologies(soup: BeautifulSoup, html: str) -> list[dict]:
    """Detect technologies used on the page."""
    detected = []
    seen = set()
    html_lower = html.lower()

    # Meta generator tag
    gen = soup.find("meta", attrs={"name": "generator"})
    if gen and gen.get("content"):
        val = gen["content"].strip()
        if val and val.lower() not in seen:
            detected.append({"name": val, "source": "meta generator"})
            seen.add(val.lower())

    # Script-based detection
    for tech, keywords in TECH_PATTERNS["scripts"].items():
        if tech.lower() in seen:
            continue
        for kw in keywords:
            if kw in html_lower:
                detected.append({"name": tech, "source": "script/markup"})
                seen.add(tech.lower())
                break

    # HTML pattern detection
    for tech, keywords in TECH_PATTERNS["headers"].items():
        if tech.lower() in seen:
            continue
        for kw in keywords:
            if kw in html_lower:
                detected.append({"name": tech, "source": "markup pattern"})
                seen.add(tech.lower())
                break

    # Common framework indicators
    if soup.find("div", id="__next"):
        if "next.js" not in seen:
            detected.append({"name": "Next.js", "source": "DOM element"})
    if soup.find("div", id="__nuxt"):
        if "nuxt.js" not in seen:
            detected.append({"name": "Nuxt.js", "source": "DOM element"})
    if soup.find("div", id="app") and any("vue" in str(s) for s in soup.find_all("script")):
        if "vue" not in seen:
            detected.append({"name": "Vue.js", "source": "DOM element"})

    return detected


def _extract_social_links(links: list[dict]) -> list[dict]:
    """Identify social media links from the scraped links."""
    social = []
    seen_platforms = {}
    for link in links:
        try:
            parsed = urlparse(link["url"])
            domain = parsed.netloc.lower().lstrip("www.")
            for social_domain, platform in SOCIAL_DOMAINS.items():
                if domain == social_domain or domain.endswith("." + social_domain):
                    if platform not in seen_platforms:
                        seen_platforms[platform] = {
                            "platform": platform,
                            "url": link["url"],
                            "text": link.get("text", ""),
                        }
                    break
        except Exception:
            continue
    return list(seen_platforms.values())


def _extract_structured_data(soup: BeautifulSoup) -> list[dict]:
    """Extract JSON-LD and other structured data from the page."""
    structured = []

    # JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, list):
                for item in data:
                    structured.append({"format": "JSON-LD", "data": item})
            else:
                structured.append({"format": "JSON-LD", "data": data})
        except (json.JSONDecodeError, TypeError):
            continue

    # OpenGraph (collected as a group)
    og_tags = {}
    for tag in soup.find_all("meta", property=re.compile(r"^og:")):
        prop = tag.get("property", "")
        content = tag.get("content", "")
        if prop and content:
            og_tags[prop] = content
    if og_tags:
        structured.append({"format": "OpenGraph", "data": og_tags})

    # Twitter Cards
    tc_tags = {}
    for tag in soup.find_all("meta", attrs={"name": re.compile(r"^twitter:")}):
        name = tag.get("name", "")
        content = tag.get("content", "")
        if name and content:
            tc_tags[name] = content
    if tc_tags:
        structured.append({"format": "Twitter Card", "data": tc_tags})

    return structured


async def run_scraper(job_id: int, url: str, selector: str = None):
    """Scrape a URL and extract comprehensive page data."""
    start_time = time.time()
    try:
        await update_job(job_id, "running", None)

        screenshot_b64 = None

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            # Use a realistic User-Agent to avoid being blocked/reset by servers
            user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            page = await browser.new_page(
                viewport={"width": 1280, "height": 720},
                user_agent=user_agent
            )
            
            # Add common browser headers
            await page.set_extra_http_headers({
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-User": "?1",
                "Sec-Fetch-Dest": "document",
            })

            # Navigate with timeout handling
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
            except Exception as nav_error:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                except Exception:
                    raise nav_error

            # Capture screenshot
            try:
                screenshot_bytes = await page.screenshot(
                    type="jpeg", quality=70, full_page=False
                )
                screenshot_b64 = base64.b64encode(screenshot_bytes).decode("ascii")
            except Exception:
                pass  # Screenshot is non-critical

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
            for row in table.find_all("tr")[:50]:
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
                lists.append({"type": lst.name, "items": items})
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
        html_size = len(content)

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

        # --- New: Technology Detection ---
        technologies = _detect_technologies(soup, content)

        # --- New: Social Links ---
        social_links = _extract_social_links(all_links)

        # --- New: Structured Data ---
        structured_data = _extract_structured_data(soup)

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
            "technologies": technologies,
            "social_links": social_links,
            "structured_data": structured_data,
            "screenshot": screenshot_b64,
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
                "html_size_bytes": html_size,
                "tech_count": len(technologies),
                "social_count": len(social_links),
                "structured_data_count": len(structured_data),
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
