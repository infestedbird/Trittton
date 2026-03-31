# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UCSD Course Browser — a tool that scrapes the UCSD Schedule of Classes (TritonLink) and displays courses in a modern React UI with a FastAPI backend for live scraping.

## Architecture

**Scraper (`app.py`):** Python script that POSTs to the UCSD Schedule of Classes endpoint for every department in `ALL_SUBJECTS`, parses the HTML table structure (course headers with class `crsheader`, section rows with class `brdr`), and writes structured JSON to `all_courses.json`. Uses `requests` + `BeautifulSoup` with the `lxml` parser.

**Backend (`server.py`):** FastAPI server that serves the React frontend and provides API endpoints for scraping with real-time progress via SSE. Endpoints: `/api/courses`, `/api/scrape/start`, `/api/scrape/progress`, `/api/scrape/status`.

**Frontend (`frontend/`):** React + TypeScript + Tailwind CSS app built with Vite. Dark theme, department sidebar, course cards with expandable sections, search/filter system, and live scrape progress panel. Two data loading modes: drag-and-drop JSON file upload (offline) or live scraping via the backend.

**Legacy (`index.html`, `script.js`):** Archived original single-file frontend. Not used by the new React app.

**Debug helper (`htmllls.py`):** Fetches a single department (ECE) and dumps raw HTML to `ece_raw.html` for inspecting the page structure.

**Data flow:** `app.py` → `all_courses.json` → loaded via file upload or `/api/courses` → React frontend

## Commands

```bash
# === Setup ===
# Python (use venv)
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn requests beautifulsoup4 lxml

# Frontend
cd frontend && npm install

# Playwright (for tests)
cd frontend && npx playwright install chromium

# === Development ===
# Start Vite dev server (frontend only, port 5173)
cd frontend && npm run dev

# Start FastAPI backend (port 8000, proxied by Vite in dev)
source .venv/bin/activate && python server.py

# === Production ===
cd frontend && npm run build    # builds to frontend/dist/
source .venv/bin/activate && python server.py   # serves frontend + API on :8000

# === Testing ===
cd frontend && npx playwright test --config=e2e/playwright.config.ts

# === Scraper (standalone) ===
source .venv/bin/activate && python3 app.py
```

## Key Configuration (app.py)

- `TERM`: academic term code (e.g. `SP26`, `WI26`, `FA25`, `S126`, `S226`)
- `DELAY`: seconds between HTTP requests (default 1.0) — be respectful of UCSD servers
- `ALL_SUBJECTS`: full list of department codes to scrape
- `VALID_TYPES`: section types to keep (`LE`, `DI`, `LA`, `SE`, `IN`, `TA`, `TU`, `CL`, `ST`)

## Frontend Structure (frontend/src/)

- `App.tsx` — Root component, wires up hooks and layout
- `components/` — Header, Sidebar, UploadZone, FilterBar, CourseList, CourseCard, SectionTable, ScrapePanel, Layout
- `hooks/` — useCourseData (data loading), useFilters (search/filter logic), useScraper (SSE progress)
- `lib/` — availability.ts (seat status logic), constants.ts (type colors/labels)
- `types.ts` — Course, Section, FilterState, ScrapeProgress interfaces

## JSON Schema (all_courses.json)

Each course object:
```json
{
  "subject": "ECE",
  "course_code": "ECE 15",
  "title": "Eng Computation: Prgrm in C",
  "units": "4",
  "restrictions": "FR JR SO",
  "sections": [
    {
      "section_id": "90971",
      "type": "LE",
      "section": "A00",
      "days": "TuTh",
      "time": "5:00p-6:20p",
      "building": "CENTR",
      "room": "109",
      "instructor": "Sahay, Rajeev",
      "available": "9",
      "limit": "146",
      "waitlisted": ""
    }
  ]
}
```

## Notes

- The HTML parser is tightly coupled to UCSD's page structure. If scraping breaks, use `htmllls.py` to dump fresh HTML and compare against the `parse_html` docstring.
- In development, Vite proxies `/api/*` to the FastAPI backend at localhost:8000.
- Playwright tests use a fixture file at `frontend/e2e/fixtures/sample_courses.json`.
