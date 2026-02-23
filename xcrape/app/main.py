from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os

app = FastAPI(title="Smart Local Web Scraper")

# Ensure static and templates directories exist
os.makedirs("app/static", exist_ok=True)
os.makedirs("app/templates", exist_ok=True)
os.makedirs("app/data", exist_ok=True)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

@app.on_event("startup")
async def on_startup():
    from .db import init_db
    await init_db()

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse(
        request=request, name="index.html", context={"title": "Web Scraper Dashboard"}
    )

from pydantic import BaseModel
from typing import Optional
import asyncio
from .db import create_job, get_jobs
from .scraper import run_scraper

class ScrapeRequest(BaseModel):
    url: str
    selector: Optional[str] = None

@app.post("/api/scrape")
async def trigger_scrape(req: ScrapeRequest):
    job_id = await create_job(req.url)
    
    # Run the scraper in a background thread to avoid Windows event loop conflicts
    def run_in_thread(jid, url, selector):
        import asyncio
        import sys
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        asyncio.run(run_scraper(jid, url, selector))

    import threading
    threading.Thread(target=run_in_thread, args=(job_id, req.url, req.selector)).start()
    
    return {"message": "Job created", "job_id": job_id}

@app.get("/api/jobs")
async def list_jobs():
    jobs = await get_jobs()
    return {"jobs": jobs}
