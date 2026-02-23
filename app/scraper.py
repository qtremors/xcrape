import json
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from .db import update_job

async def run_scraper(job_id: int, url: str, selector: str = None):
    try:
        await update_job(job_id, "running", None)
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)
            
            content = await page.content()
            await browser.close()
            
            soup = BeautifulSoup(content, 'html.parser')
            
            extracted_data = None
            if selector:
                elements = soup.select(selector)
                extracted_data = [el.get_text(strip=True) for el in elements]
            else:
                title = soup.title.string if soup.title else "No Title"
                links = [a['href'] for a in soup.find_all('a', href=True) if a['href'].startswith('http')]
                extracted_data = {
                    "title": title.strip() if title else "",
                    "links": links[:15] # limit to 15 top links
                }
                
            await update_job(job_id, "completed", json.dumps(extracted_data))
            
    except Exception as e:
        await update_job(job_id, "failed", str(e))
