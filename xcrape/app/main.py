import asyncio
import csv
import io
import json
import os
import threading
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from .db import create_job, delete_job, get_job, get_jobs, init_db
from .scraper import run_scraper


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Smart Local Web Scraper", lifespan=lifespan)

# Ensure directories exist
os.makedirs("app/static", exist_ok=True)
os.makedirs("app/templates", exist_ok=True)
os.makedirs("app/data", exist_ok=True)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


# ── Pages ────────────────────────────────────────────────────────────────────


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"title": "XCrape Terminal"},
    )


# ── API Models ───────────────────────────────────────────────────────────────


class ScrapeRequest(BaseModel):
    url: str
    selector: Optional[str] = None


# ── API Routes ───────────────────────────────────────────────────────────────


@app.post("/api/scrape")
async def trigger_scrape(req: ScrapeRequest):
    job_id = await create_job(req.url)

    def run_in_thread(jid, url, selector):
        import sys
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        asyncio.run(run_scraper(jid, url, selector))

    threading.Thread(
        target=run_in_thread, args=(job_id, req.url, req.selector), daemon=True
    ).start()

    return {"message": "Job created", "job_id": job_id}


@app.get("/api/jobs")
async def list_jobs():
    jobs = await get_jobs()
    return {"jobs": jobs}


@app.get("/api/jobs/{job_id}")
async def get_job_detail(job_id: int):
    job = await get_job(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"error": "Job not found"})
    return {"job": job}


@app.delete("/api/jobs/{job_id}")
async def remove_job(job_id: int):
    deleted = await delete_job(job_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"error": "Job not found"})
    return {"message": "Job deleted"}


@app.get("/api/jobs/{job_id}/export")
async def export_job(job_id: int, format: str = "json"):
    job = await get_job(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"error": "Job not found"})

    if not job.get("data"):
        return JSONResponse(
            status_code=400, content={"error": "No data available for this job"}
        )

    try:
        data = json.loads(job["data"])
    except (json.JSONDecodeError, TypeError):
        return JSONResponse(
            status_code=400, content={"error": "Job data is not valid JSON"}
        )

    if format == "csv":
        return _export_csv(job_id, data)
    else:
        content = json.dumps(data, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=xcrape_job_{job_id}.json"
            },
        )


def _export_csv(job_id: int, data: dict) -> StreamingResponse:
    """Flatten scraped data into a CSV file."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Meta section
    meta = data.get("meta", {})
    if meta:
        writer.writerow(["== META =="])
        writer.writerow(["Field", "Value"])
        for k, v in meta.items():
            writer.writerow([k, v])
        writer.writerow([])

    # Headings
    headings = data.get("headings", [])
    if headings:
        writer.writerow(["== HEADINGS =="])
        writer.writerow(["Level", "Text"])
        for h in headings:
            writer.writerow([f"H{h['level']}", h["text"]])
        writer.writerow([])

    # Links
    links = data.get("links", [])
    if links:
        writer.writerow(["== LINKS =="])
        writer.writerow(["URL", "Text", "Internal"])
        for link in links:
            writer.writerow([link["url"], link["text"], link.get("internal", "")])
        writer.writerow([])

    # Images
    images = data.get("images", [])
    if images:
        writer.writerow(["== IMAGES =="])
        writer.writerow(["Source", "Alt Text", "Width", "Height"])
        for img in images:
            writer.writerow([img["src"], img.get("alt", ""), img.get("width", ""), img.get("height", "")])
        writer.writerow([])

    # Stats
    stats = data.get("stats", {})
    if stats:
        writer.writerow(["== STATS =="])
        writer.writerow(["Metric", "Value"])
        for k, v in stats.items():
            writer.writerow([k, v])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=xcrape_job_{job_id}.csv"
        },
    )
