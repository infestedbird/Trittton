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

import shutil
import hashlib
import secrets
import os as _os

CLAUDE_BIN = shutil.which("claude") or "/opt/homebrew/bin/claude"

# ── Auth ─────────────────────────────────────────────────────────────────────

AUTH_EMAIL = _os.environ.get("AUTH_EMAIL", "joshhatzer@gmail.com")
AUTH_HASH = _os.environ.get("AUTH_HASH", "16057e270cb342728edd61cd2072788626ad4f2bb58e81e0659543ea8aecebe1")
_auth_tokens: set = set()


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    pw_hash = hashlib.sha256(req.password.encode()).hexdigest()
    if req.email.lower().strip() != AUTH_EMAIL or pw_hash != AUTH_HASH:
        return JSONResponse({"error": "Invalid email or password"}, status_code=401)
    token = secrets.token_urlsafe(32)
    _auth_tokens.add(token)
    return {"token": token, "email": AUTH_EMAIL}


@app.get("/api/auth/verify")
def auth_verify(request: Request):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""
    if token not in _auth_tokens:
        return JSONResponse({"valid": False}, status_code=401)
    return {"valid": True, "email": AUTH_EMAIL}

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


# ── Dynamic Term Detection ───────────────────────────────────────────────────

_terms_cache: dict = {"terms": [], "ts": 0}
TERMS_TTL = 600  # 10 minutes

# Filter to standard academic terms students care about
TERM_PREFIX_LABELS = {
    "FA": "Fall", "WI": "Winter", "SP": "Spring",
    "S1": "Summer I", "S2": "Summer II",
}


def _scrape_terms() -> list:
    """Scrape available terms from UCSD Schedule of Classes."""
    import requests as req_lib
    from bs4 import BeautifulSoup
    try:
        resp = req_lib.get(
            "https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudent.htm",
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (compatible; UCSDCourseBrowser/1.0)"},
        )
        if resp.status_code != 200:
            return []
        soup = BeautifulSoup(resp.text, "lxml")
        select = soup.find("select", {"id": "selectedTerm"})
        if not select:
            return []
        terms = []
        for option in select.find_all("option"):
            value = option.get("value", "").strip()
            label = option.get_text(strip=True)
            if not value or len(value) < 3:
                continue
            # Filter: only keep standard terms (FA, WI, SP, S1, S2)
            prefix = value[:2]
            if prefix not in TERM_PREFIX_LABELS:
                continue
            # Build a clean label: "Spring 2026" instead of "Spring Quarter 2026"
            year_suffix = value[2:]
            year = f"20{year_suffix}" if len(year_suffix) == 2 else year_suffix
            clean_label = f"{TERM_PREFIX_LABELS[prefix]} {year}"
            terms.append({"value": value, "label": clean_label})
        return terms
    except Exception as e:
        logger.error("Term scrape error: %s", e)
        return []


def _get_terms() -> list:
    """Get terms, using cache if fresh."""
    now = time.time()
    if _terms_cache["terms"] and (now - _terms_cache["ts"]) < TERMS_TTL:
        return _terms_cache["terms"]
    terms = _scrape_terms()
    if terms:
        _terms_cache["terms"] = terms
        _terms_cache["ts"] = now
    return _terms_cache["terms"] or []


# Background thread to poll terms every 10 minutes
def _term_poll_loop():
    while True:
        try:
            terms = _scrape_terms()
            if terms:
                _terms_cache["terms"] = terms
                _terms_cache["ts"] = time.time()
                logger.info("Term poll: found %d terms", len(terms))
        except Exception:
            pass
        time.sleep(600)  # 10 minutes


_term_thread = threading.Thread(target=_term_poll_loop, daemon=True)
_term_thread.start()


@app.get("/api/terms")
def get_terms():
    """Return available terms from UCSD Schedule of Classes. Cached 10 min."""
    terms = _get_terms()
    if not terms:
        # Fallback to hardcoded if scrape fails
        terms = [
            {"value": "SP26", "label": "Spring 2026"},
            {"value": "S126", "label": "Summer I 2026"},
            {"value": "S226", "label": "Summer II 2026"},
        ]
    return {"terms": terms}


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


def _build_prompt(req: ChatRequest) -> tuple[str, str]:
    """Build system prompt and conversation prompt from a ChatRequest."""
    course_context = ""
    if req.include_courses and OUTPUT.exists():
        with open(OUTPUT, "r") as f:
            courses = json.load(f)
        course_context = f"\n\nCOURSE CATALOG ({len(courses)} courses):\n{_build_course_summary(courses)}"

    term_label = TERM_LABELS.get(req.term, req.term)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.replace("{term_label}", term_label).replace("{term_code}", req.term)
    conversation = _format_conversation(req.messages)

    completed_context = ""
    if req.completed_courses:
        completed_context = f"\n\nSTUDENT'S COMPLETED COURSES: {req.completed_courses}\nUse this to check prerequisites. Only recommend courses whose prerequisites the student has completed. If suggesting a course with unmet prerequisites, clearly warn them."

    reminder = "\n\nREMINDER: When proposing a complete schedule, you MUST output it inside a ```schedule-json code fence with the exact JSON structure specified above. This is critical — the frontend renders a visual weekly calendar from this data."
    full_system = f"{system_prompt}{course_context}{completed_context}{reminder}"
    return full_system, conversation


def _stream_gemini(system_prompt: str, conversation: str):
    """Stream a response from Gemini 2.0 Flash."""
    import os as _os
    api_key = _os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        yield f"data: {json.dumps({'error': 'GEMINI_API_KEY environment variable not set'})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
        return

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system_prompt,
        )

        yield f"data: {json.dumps({'thinking': True, 'phase': 'Analyzing course catalog...'})}\n\n"

        response = model.generate_content(
            conversation + "\n\nAssistant:",
            stream=True,
        )

        started = False
        for chunk in response:
            if chunk.text:
                if not started:
                    started = True
                    yield f"data: {json.dumps({'thinking': False})}\n\n"
                yield f"data: {json.dumps({'text': chunk.text})}\n\n"

        if not started:
            yield f"data: {json.dumps({'thinking': False})}\n\n"

    except Exception as e:
        logger.error("Gemini error: %s", e)
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    finally:
        yield f"data: {json.dumps({'done': True})}\n\n"


def _stream_claude(system_prompt: str, conversation: str, model_name: str):
    """Stream a response from the Claude CLI."""
    import os
    import select

    prompt = f"{system_prompt}\n\nCONVERSATION SO FAR:\n{conversation}\n\nAssistant:"

    model_map = {"sonnet": "sonnet", "opus": "opus"}
    model_flag = model_map.get(model_name, "sonnet")

    try:
        proc = subprocess.Popen(
            [CLAUDE_BIN, "-p", "--model", model_flag, "--output-format", "text"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError:
        yield f"data: {json.dumps({'error': f'Claude CLI not found at {CLAUDE_BIN}. Install it first.'})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
        return

    proc.stdin.write(prompt.encode("utf-8"))
    proc.stdin.close()

    def stream():
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
                ready, _, _ = select.select([fd], [], [], 0.5)
                elapsed = time.time() - start_time

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
                    try:
                        text = buf.decode("utf-8")
                        buf = b""
                        yield f"data: {json.dumps({'text': text})}\n\n"
                    except UnicodeDecodeError:
                        if len(buf) > 8:
                            text = buf.decode("utf-8", errors="replace")
                            buf = b""
                            yield f"data: {json.dumps({'text': text})}\n\n"

                if proc.poll() is not None and not ready:
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

    yield from stream()


@app.post("/api/chat")
def chat(req: ChatRequest):
    system_prompt, conversation = _build_prompt(req)

    if req.model == "gemini":
        return StreamingResponse(_stream_gemini(system_prompt, conversation), media_type="text/event-stream")

    return StreamingResponse(_stream_claude(system_prompt, conversation, req.model), media_type="text/event-stream")


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


# ── Campus Occupancy & Hours ─────────────────────────────────────────────────

# Category mapping for Waitz locations
LOCATION_CATEGORIES = {
    7: "library", 8: "library",
    12: "fitness", 13: "fitness",
    14: "dining",
    52: "dining", 53: "dining", 56: "dining", 57: "dining", 59: "dining", 60: "dining",
    204: "recreation", 205: "recreation",
}

# "Best time to go" mock data (hour → typical busyness %)
TYPICAL_PATTERNS = {
    "library": {8: 15, 9: 25, 10: 40, 11: 55, 12: 60, 13: 65, 14: 70, 15: 75, 16: 80, 17: 75, 18: 65, 19: 55, 20: 45, 21: 35, 22: 20},
    "fitness": {6: 30, 7: 45, 8: 55, 9: 50, 10: 40, 11: 45, 12: 55, 13: 50, 14: 40, 15: 45, 16: 60, 17: 75, 18: 80, 19: 70, 20: 55, 21: 35},
    "dining":  {7: 20, 8: 35, 9: 30, 10: 15, 11: 45, 12: 80, 13: 70, 14: 40, 15: 20, 16: 15, 17: 50, 18: 75, 19: 65, 20: 40, 21: 20},
    "recreation": {9: 15, 10: 25, 11: 35, 12: 40, 13: 45, 14: 50, 15: 55, 16: 60, 17: 55, 18: 45, 19: 35, 20: 25},
}


def _best_time(category: str) -> str:
    pattern = TYPICAL_PATTERNS.get(category, TYPICAL_PATTERNS["library"])
    from datetime import datetime
    now_hour = datetime.now().hour
    # Find the lowest busyness hour from now onwards
    future = {h: b for h, b in pattern.items() if h > now_hour}
    if not future:
        return "Early morning"
    best_h = min(future, key=future.get)
    suffix = "am" if best_h < 12 else "pm"
    display = best_h if best_h <= 12 else best_h - 12
    return f"~{display}{suffix}"


@app.get("/api/campus/live")
def campus_live():
    """All campus locations from Waitz with categories and best-time predictions."""
    try:
        import requests as req_lib
        resp = req_lib.get("https://waitz.io/live/ucsd", timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (compatible; UCSDCourseBrowser/1.0)"
        })
        if resp.status_code != 200:
            return JSONResponse({"error": "Waitz API unavailable"}, status_code=502)
        data = resp.json().get("data", [])
        locations = []
        for loc in data:
            cat = LOCATION_CATEGORIES.get(loc.get("id"), "other")
            cleaned = {
                "name": loc["name"],
                "id": loc["id"],
                "category": cat,
                "busyness": loc.get("busyness", 0),
                "people": loc.get("people", 0),
                "capacity": loc.get("capacity", 0),
                "isAvailable": loc.get("isAvailable", False),
                "isOpen": loc.get("isOpen", False),
                "hourSummary": loc.get("hourSummary", ""),
                "bestTime": _best_time(cat),
                "bestLocations": loc.get("bestLocations", []),
                "trend": list(TYPICAL_PATTERNS.get(cat, {}).values())[:12],
                "subLocs": [],
            }
            if loc.get("subLocs"):
                for sub in loc["subLocs"]:
                    cleaned["subLocs"].append({
                        "name": sub["name"],
                        "id": sub["id"],
                        "abbreviation": sub.get("abbreviation", ""),
                        "busyness": sub.get("busyness", 0),
                        "people": sub.get("people", 0),
                        "capacity": sub.get("capacity", 0),
                        "isAvailable": sub.get("isAvailable", False),
                        "isOpen": sub.get("isOpen", False),
                        "hourSummary": sub.get("hourSummary", ""),
                    })
            locations.append(cleaned)
        return locations
    except Exception as e:
        logger.error("Campus live fetch error: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/library/live")
def library_live():
    """Proxy to Waitz API for real-time library occupancy data (kept for backwards compat)."""
    try:
        import requests as req_lib
        resp = req_lib.get("https://waitz.io/live/ucsd", timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (compatible; UCSDCourseBrowser/1.0)"
        })
        if resp.status_code != 200:
            return JSONResponse({"error": "Waitz API unavailable"}, status_code=502)
        data = resp.json().get("data", [])
        LIBRARY_IDS = {7, 8}
        libraries = []
        for loc in data:
            if loc.get("id") in LIBRARY_IDS:
                cleaned = {
                    "name": loc["name"], "id": loc["id"],
                    "busyness": loc.get("busyness", 0), "people": loc.get("people", 0),
                    "capacity": loc.get("capacity", 0), "isAvailable": loc.get("isAvailable", False),
                    "isOpen": loc.get("isOpen", False), "hourSummary": loc.get("hourSummary", ""),
                    "bestLocations": loc.get("bestLocations", []), "subLocs": [],
                }
                if loc.get("subLocs"):
                    for sub in loc["subLocs"]:
                        cleaned["subLocs"].append({
                            "name": sub["name"], "id": sub["id"],
                            "abbreviation": sub.get("abbreviation", ""),
                            "busyness": sub.get("busyness", 0), "people": sub.get("people", 0),
                            "capacity": sub.get("capacity", 0), "isAvailable": sub.get("isAvailable", False),
                            "isOpen": sub.get("isOpen", False), "hourSummary": sub.get("hourSummary", ""),
                        })
                libraries.append(cleaned)
        return libraries
    except Exception as e:
        logger.error("Library live fetch error: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/library/hours")
def library_hours():
    """Proxy to LibCal API for library operating hours."""
    try:
        import requests as req_lib
        resp = req_lib.get(
            "https://ucsd.libcal.com/widget/hours/grid",
            params={"iid": "457", "format": "json", "weeks": "1", "systemTime": "0"},
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0 (compatible; UCSDCourseBrowser/1.0)"},
        )
        if resp.status_code != 200:
            return JSONResponse({"error": "LibCal API unavailable"}, status_code=502)
        data = resp.json()
        # Filter to main library locations only
        LIBRARY_LIDS = {16116, 16221}  # Geisel, WongAvery
        locations = data.get("locations", [])
        filtered = [loc for loc in locations if loc.get("lid") in LIBRARY_LIDS]
        return {"locations": filtered}
    except Exception as e:
        logger.error("Library hours fetch error: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Auto-Scheduler ───────────────────────────────────────────────────────────

class Assignment(BaseModel):
    name: str
    due_date: str
    difficulty: int  # 1-5


class LeisureActivity(BaseModel):
    name: str
    preferred_day: str = ""   # e.g. "Mon", "Wed", or "" for any
    preferred_time: str = ""  # e.g. "morning", "afternoon", "evening", or ""
    duration: float = 1.0     # hours


class ScheduleRequest(BaseModel):
    assignments: List[Assignment]
    leisure: List[LeisureActivity] = []
    start_date: str
    end_date: str
    model: str = "gemini"


EFFORT_HOURS = {1: 1.2, 2: 2.4, 3: 4.2, 4: 6.0, 5: 9.0}


def _fetch_gcal_events(start_date: str, end_date: str) -> list:
    """Fetch events from ALL Google Calendars."""
    service = _get_gcal_service()
    if not service:
        return []

    from datetime import datetime, timezone
    events = []
    try:
        # Get all calendars
        cal_list = service.calendarList().list().execute()
        cal_ids = [c["id"] for c in cal_list.get("items", [])]

        start_iso = start_date + "T00:00:00Z" if "T" not in start_date else start_date
        end_iso = end_date + "T23:59:59Z" if "T" not in end_date else end_date

        for cal_id in cal_ids:
            try:
                result = service.events().list(
                    calendarId=cal_id,
                    timeMin=start_iso,
                    timeMax=end_iso,
                    singleEvents=True,
                    orderBy="startTime",
                    maxResults=100,
                ).execute()
                for evt in result.get("items", []):
                    s = evt.get("start", {})
                    e = evt.get("end", {})
                    start_str = s.get("dateTime") or s.get("date")
                    end_str = e.get("dateTime") or e.get("date")
                    if start_str and end_str:
                        events.append({
                            "start": start_str,
                            "end": end_str,
                            "title": evt.get("summary", "Busy"),
                            "type": "fixed",
                            "calendar": cal_id,
                        })
            except Exception:
                continue
    except Exception as e:
        logger.error("GCal fetch all error: %s", e)

    return events


@app.get("/api/scheduler/events")
def get_calendar_events(start: str = Query(...), end: str = Query(...)):
    """Fetch all Google Calendar events for the date range."""
    events = _fetch_gcal_events(start, end)
    return {"events": events, "connected": len(events) > 0 or _get_gcal_service() is not None}


@app.post("/api/scheduler/plan")
def auto_schedule(req: ScheduleRequest):
    """Use AI to generate optimal study blocks around existing calendar events."""
    from datetime import datetime, timedelta

    # Fetch existing calendar events
    busy_blocks = _fetch_gcal_events(req.start_date, req.end_date)

    # Build a summary of busy times for AI
    busy_summary = ""
    for b in busy_blocks:
        try:
            s = datetime.fromisoformat(b["start"].replace("Z", "+00:00"))
            e = datetime.fromisoformat(b["end"].replace("Z", "+00:00"))
            busy_summary += f"- {s.strftime('%a %b %d %I:%M%p')}-{e.strftime('%I:%M%p')}: {b['title']}\n"
        except Exception:
            busy_summary += f"- {b['start']} to {b['end']}: {b['title']}\n"

    assignments_summary = ""
    for a in req.assignments:
        hours = EFFORT_HOURS.get(a.difficulty, 3.0)
        assignments_summary += f"- {a.name}: Due {a.due_date}, Difficulty {a.difficulty}/5, Estimated effort: {hours}h (incl 20% buffer)\n"

    leisure_summary = ""
    for l in req.leisure:
        pref = []
        if l.preferred_day:
            pref.append(f"prefers {l.preferred_day}")
        if l.preferred_time:
            pref.append(l.preferred_time)
        pref_str = f" ({', '.join(pref)})" if pref else ""
        leisure_summary += f"- {l.name}: {l.duration}h{pref_str}\n"

    now = datetime.now()

    ai_prompt = f"""You are a smart time-management AI for a UCSD student. Today is {now.strftime('%A, %B %d, %Y')} and it's currently {now.strftime('%I:%M %p')}.

ASSIGNMENTS TO SCHEDULE:
{assignments_summary if assignments_summary else "None."}

LEISURE ACTIVITIES TO FIT IN:
{leisure_summary if leisure_summary else "None specified — add some guilt-free breaks anyway."}

EXISTING CALENDAR EVENTS (DO NOT overlap with these):
{busy_summary if busy_summary else "No existing events found."}

RULES:
1. Schedule ONLY between {req.start_date} and {req.end_date}
2. Study blocks: 1-2.5 hours each (never longer)
3. Don't schedule before 8am or after 10pm
4. Space out work — don't cram everything the day before it's due
5. Leave at least 30min gaps between blocks for breaks
6. Harder assignments (difficulty 4-5) should have morning blocks when focus is best
7. NEVER overlap with existing calendar events
8. Each assignment's total blocks must add up to at least its estimated effort hours
9. Schedule leisure activities at their preferred times/days when possible
10. Leisure is important for mental health — treat it as non-negotiable, not optional
11. Balance the schedule: don't have all-study days or all-leisure days

OUTPUT FORMAT — You MUST output ONLY a JSON array, no other text:
```scheduler-json
[
  {{"start": "2026-04-01T09:00:00", "end": "2026-04-01T11:00:00", "title": "Study: Assignment Name", "type": "suggested", "assignment": "Assignment Name", "difficulty": 3}},
  {{"start": "2026-04-01T12:00:00", "end": "2026-04-01T13:00:00", "title": "Lunch Break", "type": "free"}},
  {{"start": "2026-04-01T17:00:00", "end": "2026-04-01T18:00:00", "title": "Gym Session", "type": "leisure"}},
  ...
]
```

Types: "suggested" for study blocks, "free" for breaks, "leisure" for leisure activities.
Use real dates and times. Be specific. Output ONLY the JSON block."""

    # Use AI to generate the plan
    import re

    if req.model == "gemini":
        import os as _os
        api_key = _os.environ.get("GEMINI_API_KEY", "")
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(model_name="gemini-2.5-flash")
                response = model.generate_content(ai_prompt)
                ai_text = response.text
            except Exception as e:
                logger.error("Gemini scheduler error: %s", e)
                ai_text = ""
        else:
            ai_text = ""
    else:
        # Use Claude CLI
        try:
            model_flag = "sonnet" if req.model == "sonnet" else "opus"
            proc = subprocess.Popen(
                [CLAUDE_BIN, "-p", "--model", model_flag, "--output-format", "text"],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            proc.stdin.write(ai_prompt.encode("utf-8"))
            proc.stdin.close()
            ai_text = proc.stdout.read().decode("utf-8", errors="replace")
            proc.wait()
        except Exception as e:
            logger.error("Claude scheduler error: %s", e)
            ai_text = ""

    # Parse AI response
    study_blocks = []
    guilt_free = []
    leisure_blocks = []
    match = re.search(r"```scheduler-json\s*\n([\s\S]*?)\n```", ai_text)
    if not match:
        match = re.search(r"\[\s*\{[\s\S]*?\}\s*\]", ai_text)

    if match:
        try:
            blocks = json.loads(match.group(1) if match.lastindex else match.group(0))
            for b in blocks:
                if b.get("type") == "free":
                    guilt_free.append(b)
                elif b.get("type") == "leisure":
                    leisure_blocks.append(b)
                else:
                    study_blocks.append(b)
        except json.JSONDecodeError:
            pass

    # Fallback: if AI produced nothing, use simple algorithm
    if not study_blocks:
        for assignment in req.assignments:
            effort = EFFORT_HOURS.get(assignment.difficulty, 3.0)
            due = datetime.fromisoformat(assignment.due_date)
            start = max(now, datetime.fromisoformat(req.start_date))
            days_until = max(1, (due - start).days)
            block_dur = 1.5 if effort <= 3 else 2.0
            num_blocks = max(1, round(effort / block_dur))
            spread = min(num_blocks, days_until)
            day_step = max(1, days_until // spread) if spread > 0 else 1

            for i in range(num_blocks):
                day_offset = min(i * day_step, days_until - 1)
                block_date = start + timedelta(days=day_offset)
                for hour in [9, 10, 11, 13, 14, 15, 16, 17, 19, 20]:
                    slot_s = block_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                    slot_e = slot_s + timedelta(hours=block_dur)
                    s_iso, e_iso = slot_s.isoformat(), slot_e.isoformat()
                    conflict = any(s_iso < bb.get("end", "") and e_iso > bb.get("start", "") for bb in busy_blocks + study_blocks)
                    if not conflict:
                        study_blocks.append({
                            "start": s_iso, "end": e_iso,
                            "title": f"Study: {assignment.name}",
                            "assignment": assignment.name,
                            "type": "suggested", "difficulty": assignment.difficulty,
                        })
                        break

    return {
        "busy_blocks": busy_blocks,
        "study_blocks": study_blocks,
        "guilt_free": guilt_free,
        "leisure_blocks": leisure_blocks,
        "effort_summary": [
            {"name": a.name, "hours": EFFORT_HOURS.get(a.difficulty, 3.0), "difficulty": a.difficulty, "due": a.due_date}
            for a in req.assignments
        ],
    }


class SchedulerChatRequest(BaseModel):
    messages: List[ChatMessage]
    current_plan: Optional[dict] = None  # The current ScheduleResult
    assignments: list = []
    leisure: list = []
    model: str = "gemini"


SCHEDULER_CHAT_SYSTEM = """You are a smart schedule assistant for a UCSD student. You help them adjust their weekly plan by conversation.

You have access to their current schedule plan (assignments, study blocks, leisure activities, and Google Calendar events).

When the user asks to make changes (move a block, add leisure, remove something, swap times, etc.), output the FULL updated plan as a JSON block:

```scheduler-json
[
  {"start": "2026-04-01T09:00:00", "end": "2026-04-01T11:00:00", "title": "Study: Assignment Name", "type": "suggested", "assignment": "Assignment Name", "difficulty": 3},
  {"start": "2026-04-01T17:00:00", "end": "2026-04-01T18:30:00", "title": "Gym", "type": "leisure"},
  {"start": "2026-04-01T12:00:00", "end": "2026-04-01T13:00:00", "title": "Lunch Break", "type": "free"},
  ...
]
```

Types: "suggested" = study, "free" = break, "leisure" = leisure activity.

RULES:
- Keep existing Google Calendar events untouched (type "fixed")
- Only output suggested/free/leisure blocks in the JSON
- Never schedule before 8am or after 10pm
- Always include the full updated block list, not just changes
- Be conversational and explain your reasoning briefly before the JSON
- If the user just asks a question (no schedule change needed), just answer without JSON"""


@app.post("/api/scheduler/chat")
def scheduler_chat(req: SchedulerChatRequest):
    """Conversational schedule editing."""
    plan_context = ""
    if req.current_plan:
        plan_context = f"\n\nCURRENT PLAN:\n{json.dumps(req.current_plan, indent=2)}"

    assignments_ctx = ""
    if req.assignments:
        assignments_ctx = "\n\nASSIGNMENTS:\n" + "\n".join(
            f"- {a.get('name', '?')}: Due {a.get('dueDate', '?')}, Difficulty {a.get('difficulty', 3)}/5"
            for a in req.assignments
        )

    leisure_ctx = ""
    if req.leisure:
        leisure_ctx = "\n\nLEISURE ACTIVITIES:\n" + "\n".join(
            f"- {l.get('name', '?')}: {l.get('duration', 1)}h" + (f" ({l.get('preferred_day', '')} {l.get('preferred_time', '')})" if l.get('preferred_day') or l.get('preferred_time') else "")
            for l in req.leisure
        )

    system = SCHEDULER_CHAT_SYSTEM + plan_context + assignments_ctx + leisure_ctx
    conversation = _format_conversation(req.messages)

    if req.model == "gemini":
        return StreamingResponse(_stream_gemini(system, conversation), media_type="text/event-stream")
    return StreamingResponse(_stream_claude(system, conversation, req.model), media_type="text/event-stream")


class PushBlocksRequest(BaseModel):
    blocks: list


@app.post("/api/scheduler/push")
def push_study_blocks(req: PushBlocksRequest):
    """Push AI-generated study blocks to Google Calendar."""
    service = _get_gcal_service()
    if not service:
        return JSONResponse({"error": "Google Calendar not connected"}, status_code=401)

    # Find or create "Trittton Study Plan" calendar
    cal_name = "Trittton Study Plan"
    cal_id = None
    try:
        calendars = service.calendarList().list().execute()
        for cal in calendars.get("items", []):
            if cal.get("summary") == cal_name:
                cal_id = cal["id"]
                break
        if not cal_id:
            new_cal = service.calendars().insert(body={
                "summary": cal_name,
                "description": "AI-generated study blocks from Trittton",
                "timeZone": "America/Los_Angeles",
            }).execute()
            cal_id = new_cal["id"]

        created = 0
        for block in req.blocks:
            if block.get("type") not in ("suggested", "free", "leisure"):
                continue
            color_map = {"free": "7", "leisure": "2", "suggested": "9"}  # Peacock, Sage, Grape
            event = {
                "summary": block.get("title", "Study Block"),
                "start": {"dateTime": block["start"], "timeZone": "America/Los_Angeles"},
                "end": {"dateTime": block["end"], "timeZone": "America/Los_Angeles"},
                "colorId": color_map.get(block.get("type", ""), "9"),
                "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 10}]},
            }
            service.events().insert(calendarId=cal_id, body=event).execute()
            created += 1

        return {"success": True, "calendar": cal_name, "events_created": created}
    except Exception as e:
        logger.error("Push study blocks error: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Google Calendar Sync ─────────────────────────────────────────────────────

GCAL_CREDS_FILE = BASE_DIR / "gcal_credentials.json"
GCAL_TOKEN_FILE = BASE_DIR / "gcal_token.json"
GCAL_SCOPES = ["https://www.googleapis.com/auth/calendar"]
GCAL_EMAIL = "joshhatzer@gmail.com"

# Quarter instruction date ranges
TERM_DATES = {
    "FA25": ("2025-09-25", "2025-12-05"),
    "WI26": ("2026-01-05", "2026-03-13"),
    "SP26": ("2026-03-30", "2026-06-05"),
    "S126": ("2026-06-29", "2026-07-31"),
    "S226": ("2026-08-03", "2026-09-04"),
    "FA26": ("2026-09-24", "2026-12-04"),
    "WI27": ("2027-01-04", "2027-03-12"),
}

TERM_LABELS = {
    **TERM_LABELS,  # keep existing
}


def _get_gcal_service():
    """Get authenticated Google Calendar service, or None if not set up."""
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request as GRequest
    from googleapiclient.discovery import build

    creds = None
    if GCAL_TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(GCAL_TOKEN_FILE), GCAL_SCOPES)

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(GRequest())
            with open(GCAL_TOKEN_FILE, "w") as f:
                f.write(creds.to_json())
        except Exception:
            creds = None

    if not creds or not creds.valid:
        return None

    return build("calendar", "v3", credentials=creds)


@app.get("/api/gcal/status")
def gcal_status():
    """Check if Google Calendar is connected."""
    has_creds = GCAL_CREDS_FILE.exists()
    service = _get_gcal_service() if has_creds else None
    return {
        "configured": has_creds,
        "connected": service is not None,
        "email": GCAL_EMAIL,
    }


GCAL_REDIRECT_URI = "http://localhost:8000/api/gcal/callback"

# Store the flow object between auth and callback requests
_gcal_pending_flow = {"flow": None}


@app.get("/api/gcal/auth")
def gcal_auth():
    """Start OAuth flow. Returns auth URL to open in browser."""
    if not GCAL_CREDS_FILE.exists():
        return JSONResponse(
            {"error": "gcal_credentials.json not found. Download OAuth client credentials from Google Cloud Console and save to project root."},
            status_code=400,
        )

    import os
    os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_secrets_file(
        str(GCAL_CREDS_FILE),
        scopes=GCAL_SCOPES,
        redirect_uri=GCAL_REDIRECT_URI,
    )

    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    # Persist the flow so callback can use it (has the code_verifier)
    _gcal_pending_flow["flow"] = flow

    return {"auth_url": auth_url}


@app.get("/api/gcal/callback")
def gcal_callback(code: str = Query(...), scope: str = Query(default=""), state: str = Query(default="")):
    """OAuth callback — exchanges code for token."""
    flow = _gcal_pending_flow.get("flow")
    if not flow:
        return JSONResponse({"error": "No pending OAuth flow. Start again from Connect button."}, status_code=400)

    try:
        flow.fetch_token(code=code)

        creds = flow.credentials
        with open(GCAL_TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

        _gcal_pending_flow["flow"] = None  # Clean up

        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="http://localhost:5173/?gcal=connected")
    except Exception as e:
        logger.error("GCal callback error: %s", e)
        _gcal_pending_flow["flow"] = None
        return JSONResponse({"error": str(e)}, status_code=500)


class GCalSyncRequest(BaseModel):
    term: str
    courses: list  # SavedCourse[] from frontend


DAY_MAP_GCAL = {
    "M": "MO", "Tu": "TU", "W": "WE", "Th": "TH", "F": "FR",
}


def _parse_days_gcal(days_str: str) -> list[str]:
    """Parse day string like 'MWF' or 'TuTh' into RRULE day codes."""
    result = []
    remaining = days_str
    patterns = [("Th", "TH"), ("Tu", "TU"), ("M", "MO"), ("W", "WE"), ("F", "FR"), ("Sa", "SA"), ("Su", "SU")]
    for pat, code in patterns:
        if pat in remaining:
            result.append(code)
            remaining = remaining.replace(pat, "")
    return result


def _parse_time_gcal(time_str: str):
    """Parse '9:00a-9:50a' into (start_hour, start_min, end_hour, end_min)."""
    import re
    m = re.match(r"(\d{1,2}):(\d{2})(a|p)-(\d{1,2}):(\d{2})(a|p)", time_str)
    if not m:
        return None
    sh, sm, sap, eh, em, eap = m.groups()
    sh = int(sh) + (12 if sap == "p" and int(sh) != 12 else 0) + (-12 if sap == "a" and int(sh) == 12 else 0)
    eh = int(eh) + (12 if eap == "p" and int(eh) != 12 else 0) + (-12 if eap == "a" and int(eh) == 12 else 0)
    return sh, int(sm), eh, int(em)


def _find_first_day(start_date: str, target_rrule_day: str) -> str:
    """Find first occurrence of a weekday on or after start_date."""
    from datetime import datetime, timedelta
    day_to_num = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}
    d = datetime.strptime(start_date, "%Y-%m-%d")
    target = day_to_num.get(target_rrule_day, 0)
    diff = (target - d.weekday()) % 7
    result = d + timedelta(days=diff)
    return result.strftime("%Y-%m-%d")


@app.post("/api/gcal/sync")
def gcal_sync(req: GCalSyncRequest):
    """Sync schedule to Google Calendar. Creates/updates a calendar for the term."""
    service = _get_gcal_service()
    if not service:
        return JSONResponse({"error": "Google Calendar not connected. Authorize first."}, status_code=401)

    term = req.term
    term_label_map = {
        "WI26": "Winter 2026", "SP26": "Spring 2026", "S126": "Summer I 2026",
        "S226": "Summer II 2026", "FA26": "Fall 2026", "WI27": "Winter 2027",
        "FA25": "Fall 2025",
    }
    term_label = term_label_map.get(term, term)
    cal_name = f"UCSD {term_label}"
    term_dates = TERM_DATES.get(term)

    if not term_dates:
        return JSONResponse({"error": f"Unknown term dates for {term}"}, status_code=400)

    start_date, end_date = term_dates

    try:
        # Find or create the calendar for this term
        cal_id = None
        calendars = service.calendarList().list().execute()
        for cal in calendars.get("items", []):
            if cal.get("summary") == cal_name:
                cal_id = cal["id"]
                break

        if not cal_id:
            new_cal = service.calendars().insert(body={
                "summary": cal_name,
                "description": f"UCSD course schedule for {term_label}",
                "timeZone": "America/Los_Angeles",
            }).execute()
            cal_id = new_cal["id"]

        # Clear existing events in this calendar
        existing = service.events().list(calendarId=cal_id, maxResults=500).execute()
        for evt in existing.get("items", []):
            service.events().delete(calendarId=cal_id, eventId=evt["id"]).execute()

        # Create events for each section
        created = 0
        for course in req.courses:
            code = course.get("course_code", "")
            title = course.get("title", "")
            units = course.get("units", 0)

            for sec in course.get("sections", []):
                days_str = sec.get("days", "")
                time_str = sec.get("time", "")
                building = sec.get("building", "")
                room = sec.get("room", "")
                instructor = sec.get("instructor", "TBA")

                rrule_days = _parse_days_gcal(days_str)
                parsed_time = _parse_time_gcal(time_str)
                if not parsed_time or not rrule_days:
                    continue

                sh, sm, eh, em = parsed_time

                # Find first occurrence
                first_date = _find_first_day(start_date, rrule_days[0])

                location = f"{building} {room} - UC San Diego".strip()
                summary = f"{code} {sec.get('type', '')} {sec.get('section', '')}"
                description = f"{code} - {title}\n{sec.get('type', '')} {sec.get('section', '')}\nInstructor: {instructor}\n{units} units"

                event = {
                    "summary": summary,
                    "description": description,
                    "location": location,
                    "start": {
                        "dateTime": f"{first_date}T{sh:02d}:{sm:02d}:00",
                        "timeZone": "America/Los_Angeles",
                    },
                    "end": {
                        "dateTime": f"{first_date}T{eh:02d}:{em:02d}:00",
                        "timeZone": "America/Los_Angeles",
                    },
                    "recurrence": [
                        f"RRULE:FREQ=WEEKLY;BYDAY={','.join(rrule_days)};UNTIL={end_date.replace('-', '')}T235959Z"
                    ],
                    "attendees": [{"email": GCAL_EMAIL}],
                    "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 15}]},
                }

                service.events().insert(calendarId=cal_id, body=event, sendUpdates="none").execute()
                created += 1

        return {"success": True, "calendar": cal_name, "calendar_id": cal_id, "events_created": created}

    except Exception as e:
        logger.error("GCal sync error: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


# ── AI Councillor ────────────────────────────────────────────────────────────

WIKI_PATH = BASE_DIR / "ucsd_wiki.md"

COUNCILLOR_SYSTEM_PROMPT = """You are the UCSD AI Councillor — a knowledgeable, friendly, and helpful virtual advisor for UC San Diego students. You have access to a comprehensive knowledge base about UCSD covering academics, colleges, housing, dining, transportation, health, student life, finances, technology, and campus policies.

## Your Role
You are like having a knowledgeable upperclassman friend, academic advisor, and campus guide all in one. Students come to you with questions they'd normally ask a counselor, instructor, RA, or friend.

## How to Respond
- Be warm, conversational, and approachable — not robotic or overly formal
- Give specific, actionable answers with real details (building names, websites, phone numbers, deadlines)
- When relevant, include links/URLs from the knowledge base
- If a question is about something not in your knowledge base, say so honestly and suggest where to find the answer
- For academic advice, always recommend also consulting with their college advisor for personalized guidance
- For health/mental health concerns, always mention CAPS (858-534-3755) as a resource
- Keep answers focused and concise, but thorough enough to actually help

## Interactive UI Blocks
Use these special code blocks to make conversations more engaging:

### Quick-reply options:
```options
["Option A", "Option B", "Option C"]
```
Use for: common follow-up questions, topic selection, yes/no questions.

### Text input prompt:
```prompt
{"label": "Your question", "placeholder": "e.g., What's the best dining hall?"}
```

## Topics You Can Help With
- College GE requirements and which college is best for different majors
- Course registration, WebReg, enrollment dates, waitlists
- Housing (on-campus vs off-campus, neighborhoods, costs)
- Dining (meal plans, best food spots, Dining Dollars vs Triton Cash)
- Transportation (trolley, buses, U-Pass, parking, shuttles)
- Academic policies (P/NP, drop deadlines, academic standing, change of major)
- Student life (clubs, Greek life, traditions like Sun God Festival)
- Health & wellness (Student Health, CAPS counseling, recreation)
- Financial aid, tuition, costs
- Technology (WiFi, Canvas, printing, email)
- Campus resources (tutoring, writing center, career center, libraries)
- Study abroad programs
- And anything else about student life at UCSD

## Important Disclaimers
- For medical emergencies: Call 911 or UCSD Police (858-534-4357)
- For mental health crisis: CAPS 24/7 line (858) 534-3755, Option 2
- For official academic decisions: Always verify with your college advisor
- Information is current as of the 2025-2026 academic year"""


class CouncillorRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = "gemini"


@app.post("/api/councillor")
def councillor_chat(req: CouncillorRequest):
    """AI Councillor chat with UCSD knowledge base context."""
    # Load wiki
    wiki_content = ""
    if WIKI_PATH.exists():
        with open(WIKI_PATH, "r") as f:
            wiki_content = f.read()

    system_prompt = COUNCILLOR_SYSTEM_PROMPT
    if wiki_content:
        system_prompt += f"\n\n## UCSD KNOWLEDGE BASE\n{wiki_content}"

    conversation = _format_conversation(req.messages)

    if req.model == "gemini":
        return StreamingResponse(_stream_gemini(system_prompt, conversation), media_type="text/event-stream")

    return StreamingResponse(_stream_claude(system_prompt, conversation, req.model), media_type="text/event-stream")


# ── Campus Events & Academic Calendar ────────────────────────────────────────

# In-memory cache with TTL
_events_cache: dict = {"data": None, "ts": 0}
_calendar_cache: dict = {"data": None, "ts": 0}
EVENTS_TTL = 3600  # 1 hour


@app.get("/api/events")
def campus_events(days: int = Query(default=14), pp: int = Query(default=30)):
    """Fetch upcoming campus events from UCSD Localist API. Cached 1 hour."""
    now = time.time()
    cache_key = f"{days}-{pp}"
    if _events_cache["data"] and (now - _events_cache["ts"]) < EVENTS_TTL and _events_cache.get("key") == cache_key:
        return _events_cache["data"]

    try:
        import requests as req_lib
        resp = req_lib.get(
            "https://calendar.ucsd.edu/api/2/events",
            params={"days": days, "pp": pp},
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (compatible; UCSDCourseBrowser/1.0)"},
        )
        if resp.status_code != 200:
            return JSONResponse({"error": "Events API unavailable"}, status_code=502)

        raw = resp.json()
        events = []
        for item in raw.get("events", []):
            evt = item.get("event", {})
            instances = evt.get("event_instances", [])
            start = instances[0]["event_instance"]["start"] if instances else None
            end = instances[0]["event_instance"]["end"] if instances and instances[0]["event_instance"].get("end") else None

            events.append({
                "id": evt.get("id"),
                "title": evt.get("title", ""),
                "description": (evt.get("description_text") or "")[:300],
                "url": evt.get("localist_url", ""),
                "start": start,
                "end": end,
                "location": evt.get("location_name", ""),
                "venue": evt.get("venue", {}).get("name", "") if evt.get("venue") else "",
                "photo_url": evt.get("photo_url", ""),
                "tags": [f.get("name", "") for f in evt.get("filters", {}).get("event_types", [])],
            })

        result = {"events": events, "count": len(events)}
        _events_cache.update({"data": result, "ts": now, "key": cache_key})
        return result
    except Exception as e:
        logger.error("Events fetch error: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/calendar")
def academic_calendar():
    """Fetch academic calendar dates from UCSD ICS files. Cached 1 hour."""
    now = time.time()
    if _calendar_cache["data"] and (now - _calendar_cache["ts"]) < EVENTS_TTL:
        return _calendar_cache["data"]

    try:
        import requests as req_lib
        from icalendar import Calendar as iCalendar
        from datetime import date as date_type, datetime as datetime_type

        dates = []
        for year_range in ["2025-2026", "2026-2027"]:
            url = f"https://blink.ucsd.edu/_files/SCI-tab/{year_range}-academic-calendar.ics"
            resp = req_lib.get(url, timeout=15, headers={
                "User-Agent": "Mozilla/5.0 (compatible; UCSDCourseBrowser/1.0)"
            })
            if resp.status_code != 200:
                continue

            cal = iCalendar.from_ical(resp.content)
            for component in cal.walk():
                if component.name != "VEVENT":
                    continue
                dtstart = component.get("dtstart")
                dtend = component.get("dtend")
                summary = str(component.get("summary", ""))

                start_val = dtstart.dt if dtstart else None
                end_val = dtend.dt if dtend else None

                # Convert to ISO string
                def to_iso(val):
                    if val is None:
                        return None
                    if isinstance(val, datetime_type):
                        return val.isoformat()
                    if isinstance(val, date_type):
                        return val.isoformat()
                    return str(val)

                # Categorize the event
                category = "academic"
                lower = summary.lower()
                if any(w in lower for w in ["holiday", "cesar chavez", "veterans", "thanksgiving", "mlk", "memorial", "juneteenth", "independence", "labor day"]):
                    category = "holiday"
                elif any(w in lower for w in ["final", "exam"]):
                    category = "finals"
                elif any(w in lower for w in ["instruction begin", "instruction end", "classes begin"]):
                    category = "instruction"
                elif "commencement" in lower:
                    category = "commencement"
                elif any(w in lower for w in ["enrollment", "registration"]):
                    category = "enrollment"

                dates.append({
                    "summary": summary,
                    "start": to_iso(start_val),
                    "end": to_iso(end_val),
                    "category": category,
                    "year_range": year_range,
                })

        # Sort by start date
        dates.sort(key=lambda d: d.get("start") or "")

        # Add hardcoded registration dates (no API exists)
        reg_dates = [
            {"summary": "Fall 2025 Enrollment Begins", "start": "2025-05-23", "end": None, "category": "enrollment", "year_range": "2025-2026"},
            {"summary": "Fall 2025 Drop w/o W Deadline", "start": "2025-10-24", "end": None, "category": "enrollment", "year_range": "2025-2026"},
            {"summary": "Fall 2025 Drop w/ W Deadline", "start": "2025-11-07", "end": None, "category": "enrollment", "year_range": "2025-2026"},
            {"summary": "Winter 2026 Enrollment Begins", "start": "2025-11-10", "end": None, "category": "enrollment", "year_range": "2025-2026"},
            {"summary": "Winter 2026 Drop w/o W Deadline", "start": "2026-01-30", "end": None, "category": "enrollment", "year_range": "2025-2026"},
            {"summary": "Winter 2026 Drop w/ W Deadline", "start": "2026-02-13", "end": None, "category": "enrollment", "year_range": "2025-2026"},
            {"summary": "Spring 2026 Enrollment Begins", "start": "2026-02-14", "end": None, "category": "enrollment", "year_range": "2025-2026"},
            {"summary": "Spring 2026 Drop w/o W Deadline", "start": "2026-04-24", "end": None, "category": "enrollment", "year_range": "2025-2026"},
            {"summary": "Spring 2026 Drop w/ W Deadline", "start": "2026-05-08", "end": None, "category": "enrollment", "year_range": "2025-2026"},
            {"summary": "Summer 2026 Enrollment Begins", "start": "2026-04-13", "end": None, "category": "enrollment", "year_range": "2025-2026"},
        ]

        all_dates = dates + reg_dates
        all_dates.sort(key=lambda d: d.get("start") or "")

        result = {"dates": all_dates, "count": len(all_dates)}
        _calendar_cache.update({"data": result, "ts": now})
        return result
    except Exception as e:
        logger.error("Calendar fetch error: %s", e)
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
    import os as _main_os
    port = int(_main_os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
