"""
FastAPI backend for UCSD Course Browser.
Serves the React frontend and provides scraping + AI chat endpoints.

    pip install fastapi uvicorn
    python server.py
"""

import json
import subprocess
import threading
import time
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, Query, Request
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Import scraper functions
from app import fetch_subject, parse_html, ALL_SUBJECTS, VALID_TYPES, DELAY

app = FastAPI()
logger = logging.getLogger(__name__)

CLAUDE_BIN = "/opt/homebrew/bin/claude"

# Scrape state
scrape_state = {
    "status": "idle",
    "current": 0,
    "total": 0,
    "currentSubject": "",
    "coursesFound": 0,
    "errors": [],
    "events": [],
}
scrape_lock = threading.Lock()

BASE_DIR = Path(__file__).parent
OUTPUT = BASE_DIR / "all_courses.json"


# ── Course Data ──────────────────────────────────────────────────────────────

@app.get("/api/courses")
def get_courses():
    if not OUTPUT.exists():
        return JSONResponse({"error": "No course data found. Run the scraper first."}, status_code=404)
    with open(OUTPUT, "r") as f:
        data = json.load(f)
    return data


# ── Scraping ─────────────────────────────────────────────────────────────────

@app.get("/api/scrape/start")
def start_scrape(term: str = Query(default="SP26")):
    with scrape_lock:
        if scrape_state["status"] == "running":
            return {"message": "Scrape already running"}
        scrape_state.update({
            "status": "running",
            "current": 0,
            "total": len(ALL_SUBJECTS),
            "currentSubject": "",
            "coursesFound": 0,
            "errors": [],
            "events": [],
        })

    thread = threading.Thread(target=_run_scrape, args=(term,), daemon=True)
    thread.start()
    return {"message": "Scrape started", "total": len(ALL_SUBJECTS)}


def _run_scrape(term: str):
    import requests
    session = requests.Session()
    all_courses = []

    for i, subject in enumerate(ALL_SUBJECTS, 1):
        with scrape_lock:
            scrape_state["current"] = i
            scrape_state["currentSubject"] = subject

        _push_event({
            "current": i,
            "total": len(ALL_SUBJECTS),
            "currentSubject": subject,
            "coursesFound": len(all_courses),
            "status": "running",
        })

        html = fetch_subject(session, term, subject)
        if html is None:
            err = f"Failed to fetch {subject}"
            with scrape_lock:
                scrape_state["errors"].append(err)
            _push_event({"error": err})
        else:
            courses = parse_html(html, subject)
            all_courses.extend(courses)
            with scrape_lock:
                scrape_state["coursesFound"] = len(all_courses)

        if i < len(ALL_SUBJECTS):
            time.sleep(DELAY)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(all_courses, f, indent=2, ensure_ascii=False)

    with scrape_lock:
        scrape_state["status"] = "done"
        scrape_state["coursesFound"] = len(all_courses)

    _push_event({
        "status": "done",
        "current": len(ALL_SUBJECTS),
        "total": len(ALL_SUBJECTS),
        "coursesFound": len(all_courses),
    })


def _push_event(data: dict):
    with scrape_lock:
        scrape_state["events"].append(data)


@app.get("/api/scrape/progress")
def scrape_progress():
    def event_stream():
        sent = 0
        while True:
            with scrape_lock:
                events = scrape_state["events"][sent:]
                status = scrape_state["status"]

            for evt in events:
                yield f"data: {json.dumps(evt)}\n\n"
                sent += 1

            if status in ("done", "error", "idle") and not events:
                break

            time.sleep(0.5)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/scrape/status")
def scrape_status():
    with scrape_lock:
        return {
            "status": scrape_state["status"],
            "current": scrape_state["current"],
            "total": scrape_state["total"],
            "currentSubject": scrape_state["currentSubject"],
            "coursesFound": scrape_state["coursesFound"],
            "errors": scrape_state["errors"],
        }


# ── AI Chat (Claude CLI) ────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    include_courses: bool = True
    model: str = "sonnet"
    term: str = "SP26"
    completed_courses: str = ""

TERM_LABELS = {
    "WI26": "Winter 2026", "SP26": "Spring 2026", "S126": "Summer I 2026",
    "S226": "Summer II 2026", "FA26": "Fall 2026", "WI27": "Winter 2027",
    "FA25": "Fall 2025",
}

SYSTEM_PROMPT_TEMPLATE = """You are an expert UCSD academic advisor and schedule planning assistant. You have the COMPLETE {term_label} course catalog with real-time seat availability data. Your mission is to help the student build an optimal quarterly schedule.

## Your Approach
1. FIRST ask about: their major, year/standing, courses they need or want, time preferences, workload preferences
2. ANALYZE the catalog data to find matching courses with OPEN SEATS
3. CHECK for time conflicts between all sections (lectures + discussions + labs)
4. PROPOSE a complete schedule with a visual breakdown
5. ITERATE based on feedback — swap sections, try different courses, adjust times

## Schedule Intelligence
- Always include BOTH lectures AND their required discussion/lab sections
- Prefer sections with available seats over waitlisted ones
- Balance the week — avoid stacking all classes on 2 days unless requested
- Consider walking distance: classes in the same building cluster are better back-to-back
- Respect unit limits: typical full-time is 12-16 units, max 22
- Note class standings in restrictions (FR=freshman, SO=sophomore, JR=junior, SR=senior)
- Morning person? Afternoon? Evening? Optimize for their energy patterns
- Mix heavy courses (labs, projects) with lighter ones for workload balance

## Time Conflict Rules
- Two sections conflict if they share ANY day AND their times overlap
- "MWF 9:00a-9:50a" uses Monday, Wednesday, Friday
- "TuTh 2:00p-3:20p" uses Tuesday, Thursday
- A 9:00a-9:50a and 10:00a-10:50a do NOT conflict (10-minute gap)
- A 9:00a-10:00a and 9:30a-10:30a DO conflict (overlap from 9:30-10:00)

## CRITICAL: When proposing a final schedule, output it as structured JSON in this EXACT format:

```schedule-json
{
  "quarter": "Spring 2026",
  "total_units": 16,
  "courses": [
    {
      "course_code": "CSE 12",
      "title": "Basic Data Struct & OO Design",
      "units": 4,
      "sections": [
        {"type": "LE", "section": "A00", "days": "MWF", "time": "9:00a-9:50a", "building": "CENTR", "room": "109", "instructor": "Politz, Joe", "available": 15, "limit": 200},
        {"type": "DI", "section": "A01", "days": "W", "time": "3:00p-3:50p", "building": "CSB", "room": "002", "instructor": "Politz, Joe", "available": 8, "limit": 40}
      ]
    }
  ]
}
```

IMPORTANT RULES:
- Use the ```schedule-json code fence EXACTLY as shown above — the frontend parses this to render a visual weekly calendar
- Only include this JSON block when proposing a COMPLETE schedule, not when discussing options
- ALWAYS use REAL data from the course catalog below — never fabricate courses, sections, times, or instructors
- Include the total_units sum and verify it's correct
- Every section must have accurate days, times, building, room, instructor, available, and limit from the catalog
- If a course has no open sections, mention it and suggest alternatives

## Conversational Style
- Be warm, helpful, and knowledgeable like a great academic advisor
- Use course codes naturally (e.g., "CSE 12" not "Computer Science and Engineering 12")
- When listing options, briefly note what each course covers and why it might be good for them
- If they ask about a specific course, give them the full picture: all sections, times, availability, instructor
- Proactively warn about common issues: waitlists, time conflicts, prerequisite chains

## INTERACTIVE UI BLOCKS — Use these to make conversations interactive!

The frontend renders special code blocks as interactive UI elements. USE THEM whenever appropriate.

### Quick-reply options — when asking a multiple-choice question:
```options
["Option A", "Option B", "Option C", "Other"]
```
The frontend renders these as clickable pill buttons. The user clicks one and it sends that text as their reply.

USE OPTIONS for: major selection, year/standing, time preferences, yes/no questions, course recommendations to choose from.

Example — your first message should include:
"What's your major?"
```options
["Computer Science (CSE)", "Electrical Engineering (ECE)", "Mathematics (MATH)", "Data Science (DSC)", "Cognitive Science (COGS)", "Other"]
```

### Text input prompt — when asking for free-text input:
```prompt
{"label": "Earliest class time", "placeholder": "e.g., 10am, no morning classes, etc."}
```
The frontend renders a labeled text input with a submit button.

USE PROMPTS for: specific time constraints, custom requirements, course-specific questions.

### Course info card — when discussing a specific course:
```course-info
{"course_code": "CSE 12", "title": "Basic Data Struct & OO Design", "units": 4, "instructor": "Politz, Joe", "rating": 4.2, "difficulty": 3.1, "would_take_again": 85, "num_ratings": 120}
```
The frontend renders a rich card with the instructor's RateMyProfessor rating (stars, difficulty, would-take-again %). Include rating/difficulty/would_take_again data if you know it or can estimate from common knowledge. Otherwise omit those fields and the frontend will try to fetch from RMP.

USE COURSE-INFO CARDS for: when recommending specific courses, when comparing course options, when showing details about courses the student asked about.

### Flow example:
1. Greet → ask major with ```options```
2. Ask year → ```options``` ["1st year", "2nd year", "3rd year", "4th year"]
3. Ask preferences → ```prompt``` for time/workload
4. Discuss courses → show ```course-info``` cards for each recommendation
5. Propose schedule → ```schedule-json``` block

IMPORTANT: Always use these blocks when they fit. They make the experience much better. Multiple blocks can appear in the same response.

NOTE: The current term is {term_label}. Use "{term_code}" as the quarter in schedule-json output."""


def _build_course_summary(courses: list) -> str:
    """Build a compact summary of courses for the AI context."""
    lines = []
    for c in courses:
        secs = []
        for s in c.get("sections", []):
            avail = s.get("available", "?")
            limit = s.get("limit", "?")
            wait = s.get("waitlisted", "")
            status = f"{avail}/{limit}" + (f" WL:{wait}" if wait else "")
            secs.append(
                f"  {s['type']} {s['section']} | {s.get('days','')} {s.get('time','')} | "
                f"{s.get('building','')} {s.get('room','')} | {s.get('instructor','TBA')} | {status}"
            )
        restrict = f" [{c['restrictions']}]" if c.get("restrictions") else ""
        lines.append(f"{c['course_code']} - {c['title']} ({c.get('units','')} units){restrict}")
        lines.extend(secs)
    return "\n".join(lines)


def _format_conversation(messages: List[ChatMessage]) -> str:
    parts = []
    for m in messages:
        prefix = "Student" if m.role == "user" else "Assistant"
        parts.append(f"{prefix}: {m.content}")
    return "\n\n".join(parts)


@app.post("/api/chat")
def chat(req: ChatRequest):
    # Load course data
    course_context = ""
    if req.include_courses and OUTPUT.exists():
        with open(OUTPUT, "r") as f:
            courses = json.load(f)
        course_context = f"\n\nCOURSE CATALOG ({len(courses)} courses):\n{_build_course_summary(courses)}"

    # Build prompt with calendar reminder
    term_label = TERM_LABELS.get(req.term, req.term)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(term_label=term_label, term_code=req.term)
    conversation = _format_conversation(req.messages)

    # Add completed courses context
    completed_context = ""
    if req.completed_courses:
        completed_context = f"\n\nSTUDENT'S COMPLETED COURSES: {req.completed_courses}\nUse this to check prerequisites. Only recommend courses whose prerequisites the student has completed. If suggesting a course with unmet prerequisites, clearly warn them."

    reminder = "\n\nREMINDER: When proposing a complete schedule, you MUST output it inside a ```schedule-json code fence with the exact JSON structure specified above. This is critical — the frontend renders a visual weekly calendar from this data."
    prompt = f"{system_prompt}{course_context}{completed_context}\n\nCONVERSATION SO FAR:\n{conversation}{reminder}\n\nAssistant:"

    # Map model name to CLI flag
    model_map = {"sonnet": "sonnet", "opus": "opus"}
    model_flag = model_map.get(req.model, "sonnet")

    # Spawn claude CLI
    try:
        proc = subprocess.Popen(
            [CLAUDE_BIN, "-p", "--model", model_flag, "--output-format", "text"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError:
        return JSONResponse(
            {"error": f"Claude CLI not found at {CLAUDE_BIN}. Install it first."},
            status_code=500,
        )

    proc.stdin.write(prompt.encode("utf-8"))
    proc.stdin.close()

    import os
    import select

    def stream():
        # Immediately send a thinking indicator
        yield f"data: {json.dumps({'thinking': True, 'phase': 'Analyzing course catalog...'})}\n\n"

        fd = proc.stdout.fileno()
        os.set_blocking(fd, False)

        started = False
        buf = b""
        phases = [
            (0, "Analyzing course catalog..."),
            (3, "Checking availability & conflicts..."),
            (8, "Building your schedule..."),
        ]
        phase_idx = 0
        start_time = time.time()

        try:
            while True:
                # Use select to wait for data with timeout
                ready, _, _ = select.select([fd], [], [], 0.5)

                elapsed = time.time() - start_time

                # Send thinking phase updates while waiting
                if not started and phase_idx < len(phases):
                    if elapsed >= phases[phase_idx][0]:
                        yield f"data: {json.dumps({'thinking': True, 'phase': phases[phase_idx][1]})}\n\n"
                        phase_idx += 1

                if ready:
                    try:
                        chunk = os.read(fd, 4096)
                    except BlockingIOError:
                        continue

                    if not chunk:
                        break

                    if not started:
                        started = True
                        yield f"data: {json.dumps({'thinking': False})}\n\n"

                    buf += chunk
                    # Decode what we can
                    try:
                        text = buf.decode("utf-8")
                        buf = b""
                        yield f"data: {json.dumps({'text': text})}\n\n"
                    except UnicodeDecodeError:
                        # Partial multibyte char, wait for more
                        if len(buf) > 8:
                            text = buf.decode("utf-8", errors="replace")
                            buf = b""
                            yield f"data: {json.dumps({'text': text})}\n\n"

                # Check if process ended
                if proc.poll() is not None and not ready:
                    # Drain remaining
                    os.set_blocking(fd, True)
                    remaining = proc.stdout.read()
                    if remaining:
                        if not started:
                            yield f"data: {json.dumps({'thinking': False})}\n\n"
                        yield f"data: {json.dumps({'text': (buf + remaining).decode('utf-8', errors='replace')})}\n\n"
                    break

            proc.wait()
            if proc.returncode != 0:
                stderr = proc.stderr.read().decode("utf-8", errors="replace")
                if stderr:
                    yield f"data: {json.dumps({'error': stderr})}\n\n"
        finally:
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── RateMyProfessor Proxy ─────────────────────────────────────────────────────

RMP_CACHE_FILE = BASE_DIR / "rmp_cache.json"
UCSD_SCHOOL_ID = "U2Nob29sLTEwNzk="  # Base64 encoded UCSD school ID

def _load_rmp_cache() -> dict:
    try:
        if RMP_CACHE_FILE.exists():
            with open(RMP_CACHE_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def _save_rmp_cache(cache: dict):
    try:
        with open(RMP_CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
    except Exception:
        pass


class BulkRmpRequest(BaseModel):
    instructors: List[str]

@app.post("/api/rmp/bulk")
def bulk_rmp_ratings(req: BulkRmpRequest):
    """Fetch RMP ratings for multiple instructors. Uses cache, fetches missing."""
    cache = _load_rmp_cache()
    results = {}
    to_fetch = []

    for name in req.instructors:
        key = name.strip().lower()
        if not key or key == 'tba' or key == 'staff':
            continue
        if key in cache:
            results[name] = cache[key]
        else:
            to_fetch.append(name)

    # Fetch missing (limit to 30 at a time to avoid rate limits)
    if to_fetch:
        import requests as req_lib
        for instructor in to_fetch[:30]:
            try:
                search_name = instructor.split(",")[0].strip() if "," in instructor else instructor
                search_query = {
                    "query": """
                        query SearchTeacher($text: String!, $schoolID: ID!) {
                            newSearch {
                                teachers(query: {text: $text, schoolID: $schoolID}) {
                                    edges { node { id firstName lastName avgRating avgDifficulty wouldTakeAgainPercent numRatings legacyId } }
                                }
                            }
                        }
                    """,
                    "variables": {"text": search_name, "schoolID": UCSD_SCHOOL_ID},
                }
                resp = req_lib.post(
                    "https://www.ratemyprofessors.com/graphql",
                    json=search_query,
                    headers={
                        "Authorization": "Basic dGVzdDp0ZXN0",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                        "Referer": "https://www.ratemyprofessors.com/",
                        "Origin": "https://www.ratemyprofessors.com",
                    },
                    timeout=8,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    edges = data.get("data", {}).get("newSearch", {}).get("teachers", {}).get("edges", [])
                    if edges:
                        node = edges[0]["node"]
                        result = {
                            "name": f"{node['firstName']} {node['lastName']}",
                            "rating": node.get("avgRating", 0),
                            "difficulty": node.get("avgDifficulty", 0),
                            "wouldTakeAgain": node.get("wouldTakeAgainPercent", -1),
                            "numRatings": node.get("numRatings", 0),
                            "rmpUrl": f"https://www.ratemyprofessors.com/professor/{node.get('legacyId', '')}",
                        }
                        cache[instructor.strip().lower()] = result
                        results[instructor] = result
                    else:
                        cache[instructor.strip().lower()] = None
                time.sleep(0.2)  # Rate limit
            except Exception:
                pass
        _save_rmp_cache(cache)

    return results


@app.get("/api/rmp")
def get_rmp_rating(instructor: str = Query(...)):
    """Proxy to fetch RMP ratings. Caches results locally."""
    cache = _load_rmp_cache()
    cache_key = instructor.strip().lower()

    if cache_key in cache:
        return cache[cache_key]

    # Try RMP GraphQL API
    try:
        import requests as req_lib
        # Search for the professor at UCSD
        search_query = {
            "query": """
                query SearchTeacher($text: String!, $schoolID: ID!) {
                    newSearch {
                        teachers(query: {text: $text, schoolID: $schoolID}) {
                            edges {
                                node {
                                    id
                                    firstName
                                    lastName
                                    avgRating
                                    avgDifficulty
                                    wouldTakeAgainPercent
                                    numRatings
                                    legacyId
                                }
                            }
                        }
                    }
                }
            """,
            "variables": {
                "text": instructor.split(",")[0].strip() if "," in instructor else instructor,
                "schoolID": UCSD_SCHOOL_ID,
            },
        }

        resp = req_lib.post(
            "https://www.ratemyprofessors.com/graphql",
            json=search_query,
            headers={
                "Authorization": "Basic dGVzdDp0ZXN0",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                "Referer": "https://www.ratemyprofessors.com/",
                "Origin": "https://www.ratemyprofessors.com",
            },
            timeout=10,
        )

        if resp.status_code == 200:
            data = resp.json()
            edges = data.get("data", {}).get("newSearch", {}).get("teachers", {}).get("edges", [])
            if edges:
                node = edges[0]["node"]
                result = {
                    "name": f"{node['firstName']} {node['lastName']}",
                    "rating": node.get("avgRating", 0),
                    "difficulty": node.get("avgDifficulty", 0),
                    "wouldTakeAgain": node.get("wouldTakeAgainPercent", -1),
                    "numRatings": node.get("numRatings", 0),
                    "rmpUrl": f"https://www.ratemyprofessors.com/professor/{node.get('legacyId', '')}",
                }
                cache[cache_key] = result
                _save_rmp_cache(cache)
                return result

        return JSONResponse({"error": "Professor not found on RMP"}, status_code=404)
    except Exception as e:
        logger.error("RMP fetch error: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Prerequisites (scraped from UCSD catalog) ────────────────────────────────

PREREQ_CACHE_FILE = BASE_DIR / "prereq_cache.json"

def _load_prereq_cache() -> dict:
    try:
        if PREREQ_CACHE_FILE.exists():
            with open(PREREQ_CACHE_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def _save_prereq_cache(cache: dict):
    try:
        with open(PREREQ_CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
    except Exception:
        pass


@app.get("/api/prereqs")
def get_prereqs(course: str = Query(...)):
    """Fetch prerequisites for a course from the UCSD catalog."""
    cache = _load_prereq_cache()
    cache_key = course.strip().upper()

    if cache_key in cache:
        return cache[cache_key]

    try:
        import requests as req_lib
        # Parse course code: "CSE 12" → subject="CSE", number="12"
        parts = course.strip().split()
        if len(parts) < 2:
            return JSONResponse({"error": "Invalid course code"}, status_code=400)
        subject = parts[0].upper()
        number = parts[1]

        # Fetch from UCSD catalog
        url = f"https://catalog.ucsd.edu/courses/{subject}.html"
        resp = req_lib.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; UCSDCourseBrowser/1.0)"
        })

        if resp.status_code != 200:
            return JSONResponse({"error": "Could not fetch catalog page"}, status_code=404)

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "lxml")

        # Find the course anchor/heading
        # Catalog format: <p class="course-name"> or <a name="cse12">
        result = {"course": cache_key, "prerequisites": "", "description": ""}

        # Search for course in the page text
        course_id = f"{subject} {number}"
        course_id_alt = f"{subject}{number}"

        for p in soup.find_all(["p", "div"]):
            text = p.get_text(" ", strip=True)
            if course_id in text or course_id_alt.lower() in (p.get("id", "") or "").lower():
                # Look for prerequisites in nearby text
                full_text = text
                # Check next siblings too
                for sib in p.find_next_siblings(limit=3):
                    sib_text = sib.get_text(" ", strip=True)
                    full_text += " " + sib_text
                    if "prerequisite" in sib_text.lower():
                        break

                # Extract description (first sentence or paragraph)
                if len(text) > 20:
                    result["description"] = text[:500]

                # Extract prerequisites
                prereq_match = None
                import re
                prereq_match = re.search(r"[Pp]rerequisites?:\s*(.+?)(?:\.|$)", full_text)
                if prereq_match:
                    result["prerequisites"] = prereq_match.group(1).strip()[:300]
                break

        cache[cache_key] = result
        _save_prereq_cache(cache)
        return result

    except Exception as e:
        logger.error("Prereq fetch error: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Static Files (production) ────────────────────────────────────────────────

dist_dir = BASE_DIR / "frontend" / "dist"
if dist_dir.exists():
    @app.get("/")
    def serve_index():
        return FileResponse(dist_dir / "index.html")

    app.mount("/", StaticFiles(directory=str(dist_dir)), name="static")


if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.INFO)
    uvicorn.run(app, host="0.0.0.0", port=8000)
