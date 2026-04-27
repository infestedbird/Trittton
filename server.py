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


GITHUB_TOKEN = _os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO = _os.environ.get("GITHUB_REPO", "infestedbird/Trittton")


def _persist_to_github(file_path: str, content: str, message: str):
    """Commit a file to GitHub to persist data across deploys."""
    if not GITHUB_TOKEN:
        logger.info("No GITHUB_TOKEN set — skipping GitHub persist")
        return
    import requests as req_lib
    try:
        # Get current file SHA (needed for updates)
        headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{file_path}"
        existing = req_lib.get(url, headers=headers, timeout=10)
        sha = existing.json().get("sha", "") if existing.status_code == 200 else ""

        import base64
        encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
        payload = {"message": message, "content": encoded, "branch": "main"}
        if sha:
            payload["sha"] = sha

        resp = req_lib.put(url, headers=headers, json=payload, timeout=30)
        if resp.status_code in (200, 201):
            logger.info("Persisted %s to GitHub (%d bytes)", file_path, len(content))
        else:
            logger.error("GitHub persist failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.error("GitHub persist error: %s", e)


def _run_scrape(term: str):
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import requests as req_lib

    total = len(ALL_SUBJECTS)
    results: dict[int, list] = {}  # index -> courses
    completed_count = 0
    courses_found = 0
    errors: list[str] = []

    WORKERS = 12  # concurrent HTTP connections

    def _fetch_one(idx: int, subject: str) -> tuple[int, str, list | None]:
        """Fetch + parse a single department. Returns (idx, subject, courses_or_None)."""
        session = req_lib.Session()
        html = fetch_subject(session, term, subject)
        if html is None:
            return (idx, subject, None)
        return (idx, subject, parse_html(html, subject))

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {
            pool.submit(_fetch_one, i, subj): (i, subj)
            for i, subj in enumerate(ALL_SUBJECTS)
        }

        for future in as_completed(futures):
            idx, subject, courses = future.result()
            completed_count += 1

            if courses is None:
                err = f"Failed to fetch {subject}"
                errors.append(err)
                with scrape_lock:
                    scrape_state["errors"].append(err)
                _push_event({"error": err})
            else:
                results[idx] = courses
                courses_found += sum(len(c.get("sections", [])) >= 0 and 1 or 0 for c in courses)
                courses_found = sum(len(r) for r in results.values())

            with scrape_lock:
                scrape_state["current"] = completed_count
                scrape_state["currentSubject"] = subject
                scrape_state["coursesFound"] = courses_found

            _push_event({
                "current": completed_count,
                "total": total,
                "currentSubject": subject,
                "coursesFound": courses_found,
                "status": "running",
            })

    # Reassemble in original department order
    all_courses = []
    for i in range(total):
        all_courses.extend(results.get(i, []))

    course_json = json.dumps(all_courses, indent=2, ensure_ascii=False)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(course_json)

    # Persist to GitHub so data survives container restarts
    _persist_to_github("all_courses.json", course_json, f"Update course data ({term}, {len(all_courses)} courses)")

    with scrape_lock:
        scrape_state["status"] = "done"
        scrape_state["coursesFound"] = len(all_courses)

    _push_event({
        "status": "done",
        "current": total,
        "total": total,
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
    gemini_api_key: Optional[str] = None

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


def _stream_gemini(system_prompt: str, conversation: str, client_api_key: str | None = None):
    """Stream a response from Gemini 2.5 Flash."""
    import os as _os
    api_key = client_api_key or _os.environ.get("GEMINI_API_KEY", "")
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
        return StreamingResponse(_stream_gemini(system_prompt, conversation, req.gemini_api_key), media_type="text/event-stream")

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


# ── Seat Watch ────────────────────────────────────────────────────────────────

_seat_watches: dict = {}  # key: section_id -> {course_code, section, term, last_available, watchers: int}
_seat_watch_lock = threading.Lock()
_seat_alerts: list = []  # [{section_id, course_code, section, available, timestamp}]
_seat_watch_thread = None


class SeatWatchRequest(BaseModel):
    section_id: str
    course_code: str
    section: str
    term: str = "SP26"


@app.post("/api/watch/add")
def add_seat_watch(req: SeatWatchRequest):
    """Add a section to the seat watch list."""
    with _seat_watch_lock:
        if req.section_id in _seat_watches:
            _seat_watches[req.section_id]["watchers"] += 1
        else:
            _seat_watches[req.section_id] = {
                "course_code": req.course_code,
                "section": req.section,
                "term": req.term,
                "last_available": 0,
                "watchers": 1,
            }
    _ensure_watch_thread()
    return {"watching": True, "total_watched": len(_seat_watches)}


@app.post("/api/watch/remove")
def remove_seat_watch(req: SeatWatchRequest):
    """Remove a section from the seat watch list."""
    with _seat_watch_lock:
        if req.section_id in _seat_watches:
            _seat_watches[req.section_id]["watchers"] -= 1
            if _seat_watches[req.section_id]["watchers"] <= 0:
                del _seat_watches[req.section_id]
    return {"watching": False, "total_watched": len(_seat_watches)}


@app.get("/api/watch/list")
def list_seat_watches():
    """List all watched sections and their current status."""
    with _seat_watch_lock:
        return {"watches": dict(_seat_watches)}


@app.get("/api/watch/alerts")
def get_seat_alerts():
    """Get recent seat availability alerts (clears after reading)."""
    with _seat_watch_lock:
        alerts = list(_seat_alerts)
        _seat_alerts.clear()
    return {"alerts": alerts}


def _ensure_watch_thread():
    """Start the background watch thread if not already running."""
    global _seat_watch_thread
    if _seat_watch_thread and _seat_watch_thread.is_alive():
        return
    _seat_watch_thread = threading.Thread(target=_seat_watch_loop, daemon=True)
    _seat_watch_thread.start()
    logger.info("Seat watch thread started")


def _seat_watch_loop():
    """Background thread that polls watched sections for seat changes."""
    import requests as req_lib
    from app import fetch_subject, parse_html

    while True:
        with _seat_watch_lock:
            watches = dict(_seat_watches)

        if not watches:
            time.sleep(10)
            continue

        # Group by subject for efficient fetching
        subjects: dict = {}
        for sid, info in watches.items():
            subj = info["course_code"].split()[0] if " " in info["course_code"] else info["course_code"]
            if subj not in subjects:
                subjects[subj] = []
            subjects[subj].append((sid, info))

        session = req_lib.Session()
        for subj, section_list in subjects.items():
            term = section_list[0][1]["term"]
            try:
                html = fetch_subject(session, term, subj)
                if not html:
                    continue
                courses = parse_html(html, subj)

                # Build section_id -> available lookup
                avail_map: dict = {}
                for course in courses:
                    for sec in course["sections"]:
                        if sec["section_id"]:
                            avail_map[sec["section_id"]] = int(sec["available"]) if sec["available"].isdigit() else 0

                # Check each watched section
                for sid, info in section_list:
                    new_avail = avail_map.get(sid, 0)
                    old_avail = info.get("last_available", 0)

                    with _seat_watch_lock:
                        if sid in _seat_watches:
                            _seat_watches[sid]["last_available"] = new_avail

                    # Alert if seats just opened
                    if new_avail > 0 and old_avail == 0:
                        alert = {
                            "section_id": sid,
                            "course_code": info["course_code"],
                            "section": info["section"],
                            "available": new_avail,
                            "timestamp": time.time(),
                        }
                        with _seat_watch_lock:
                            _seat_alerts.append(alert)
                        logger.info("SEAT ALERT: %s %s now has %d seats!", info["course_code"], info["section"], new_avail)

            except Exception as e:
                logger.error("Seat watch error for %s: %s", subj, e)

            time.sleep(0.3)  # small delay between departments

        time.sleep(45)  # poll every 45 seconds


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


# Schedule-of-Classes subject → catalog URL slug (only where they differ)
_CATALOG_SLUG = {
    "AAS": "AASM", "ANAR": "ANTH", "ANBI": "ANTH", "ANSC": "ANTH",
    "BIBC": "BIOL", "BICD": "BIOL", "BILD": "BIOL", "BIMM": "BIOL",
    "BIPN": "BIOL", "BISP": "BIOL", "FILM": "VIS", "TDGE": "THEA",
    "TDHT": "THEA", "TDMV": "THEA", "TDPR": "THEA", "TDTR": "THEA",
    "WCWP": "WARR", "GLBH": "GLBH", "LTAF": "LIT", "LTAM": "LIT",
    "LTCH": "LIT", "LTCS": "LIT", "LTEA": "LIT", "LTEN": "LIT",
    "LTEU": "LIT", "LTFR": "LIT", "LTGM": "LIT", "LTGK": "LIT",
    "LTIT": "LIT", "LTKO": "LIT", "LTLA": "LIT", "LTRU": "LIT",
    "LTSP": "LIT", "LTTH": "LIT", "LTWL": "LIT", "LTWR": "LIT",
}

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

        # Try catalog slug mapping first, then raw subject code
        slug = _CATALOG_SLUG.get(subject, subject)
        url = f"https://catalog.ucsd.edu/courses/{slug}.html"
        resp = req_lib.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; UCSDCourseBrowser/1.0)"
        })

        # If mapped slug failed, try the raw subject code as fallback
        if resp.status_code != 200 and slug != subject:
            url = f"https://catalog.ucsd.edu/courses/{subject}.html"
            resp = req_lib.get(url, timeout=15, headers={
                "User-Agent": "Mozilla/5.0 (compatible; UCSDCourseBrowser/1.0)"
            })

        if resp.status_code != 200:
            # Cache the miss so we don't re-fetch on every card expand
            result = {"course": cache_key, "prerequisites": "none", "description": ""}
            cache[cache_key] = result
            _save_prereq_cache(cache)
            return result

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
    gemini_api_key: Optional[str] = None


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

        # Use Pacific Time offset instead of UTC — otherwise events shift a day
        # because "2026-04-05T00:00:00Z" is still April 4th in Pacific Time
        start_iso = start_date + "T00:00:00-07:00" if "T" not in start_date else start_date
        end_iso = end_date + "T23:59:59-07:00" if "T" not in end_date else end_date

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
        api_key = req.gemini_api_key or _os.environ.get("GEMINI_API_KEY", "")
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
    gemini_api_key: Optional[str] = None


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
        return StreamingResponse(_stream_gemini(system, conversation, req.gemini_api_key), media_type="text/event-stream")
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
    gemini_api_key: Optional[str] = None


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
        return StreamingResponse(_stream_gemini(system_prompt, conversation, req.gemini_api_key), media_type="text/event-stream")

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

                from datetime import timedelta as _td

                # ICS all-day events use exclusive end dates (DTEND is day AFTER last day)
                # Convert to inclusive end dates for display
                if end_val is not None and isinstance(end_val, date_type) and not isinstance(end_val, datetime_type):
                    end_val = end_val - _td(days=1)
                    if start_val is not None and end_val == start_val:
                        end_val = None

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


# ── Room Finder ──────────────────────────────────────────────────────────────

import re as _re
from datetime import datetime as _dt

# Day code mapping: schedule format → weekday numbers (Mon=0)
_DAY_MAP = {"M": 0, "Tu": 1, "W": 2, "Th": 3, "F": 4, "Sa": 5, "Su": 6}
_DAY_PATTERN = _re.compile(r"(Tu|Th|Sa|Su|M|W|F)")


def _parse_days(day_str: str) -> list[int]:
    """Parse 'MWF' or 'TuTh' into weekday ints."""
    return [_DAY_MAP[m] for m in _DAY_PATTERN.findall(day_str)]


def _parse_time(t: str) -> int:
    """Parse '3:30p' into minutes since midnight (e.g., 930)."""
    t = t.strip().lower()
    if not t:
        return -1
    is_pm = t.endswith("p")
    t = t.rstrip("ap")
    parts = t.split(":")
    h = int(parts[0])
    m = int(parts[1]) if len(parts) > 1 else 0
    if is_pm and h != 12:
        h += 12
    elif not is_pm and h == 12:
        h = 0
    return h * 60 + m


def _parse_time_range(time_str: str) -> tuple[int, int]:
    """Parse '3:30p-4:50p' into (start_min, end_min)."""
    if "-" not in time_str:
        return (-1, -1)
    parts = time_str.split("-")
    return (_parse_time(parts[0]), _parse_time(parts[1]))


def _build_room_schedule() -> dict:
    """Build schedule from all_courses.json.
    Returns: {(building, room): [(weekday, start_min, end_min, course_code, section_type), ...]}
    """
    if not OUTPUT.exists():
        return {}
    try:
        with open(OUTPUT, "r", encoding="utf-8") as f:
            courses = json.load(f)
    except Exception:
        return {}

    schedule: dict[tuple, list] = {}
    for course in courses:
        code = course.get("course_code", "")
        for sec in course.get("sections", []):
            bldg = sec.get("building", "").strip()
            room = sec.get("room", "").strip()
            days_str = sec.get("days", "").strip()
            time_str = sec.get("time", "").strip()
            sec_type = sec.get("type", "")

            if not bldg or not room or bldg == "TBA" or room == "TBA" or not days_str or not time_str:
                continue

            weekdays = _parse_days(days_str)
            start, end = _parse_time_range(time_str)
            if start < 0 or end < 0:
                continue

            key = (bldg, room)
            if key not in schedule:
                schedule[key] = []
            for wd in weekdays:
                schedule[key].append((wd, start, end, code, sec_type))

    return schedule


_room_schedule_cache: dict = {"data": None, "ts": 0}
_ROOM_CACHE_TTL = 300  # 5 min


def _get_room_schedule() -> dict:
    now = time.time()
    if _room_schedule_cache["data"] is None or (now - _room_schedule_cache["ts"]) > _ROOM_CACHE_TTL:
        _room_schedule_cache["data"] = _build_room_schedule()
        _room_schedule_cache["ts"] = now
    return _room_schedule_cache["data"]


@app.get("/api/rooms/available")
def rooms_available(
    day: Optional[int] = Query(default=None, description="Weekday 0=Mon..6=Sun, default=today"),
    time_str: Optional[str] = Query(default=None, alias="time", description="Time like '14:30' or '2:30p', default=now"),
):
    """Find all empty classrooms right now (or at a given day/time)."""
    schedule = _get_room_schedule()
    if not schedule:
        return {"error": "No course data loaded. Run scraper first.", "buildings": [], "rooms": []}

    now = _dt.now()
    check_day = day if day is not None else now.weekday()

    if time_str:
        check_min = _parse_time(time_str)
        if check_min < 0:
            check_min = now.hour * 60 + now.minute
    else:
        check_min = now.hour * 60 + now.minute

    buildings: dict[str, list] = {}

    for (bldg, room), slots in schedule.items():
        # Get today's schedule for this room
        today_slots = sorted(
            [(s, e, code, st) for (wd, s, e, code, st) in slots if wd == check_day],
            key=lambda x: x[0],
        )

        # Is it occupied right now?
        occupied = False
        current_class = None
        for s, e, code, st in today_slots:
            if s <= check_min < e:
                occupied = True
                current_class = {"course": code, "type": st, "end": f"{e // 60}:{e % 60:02d}"}
                break

        # Find next class
        next_class = None
        for s, e, code, st in today_slots:
            if s > check_min:
                next_class = {"course": code, "type": st, "start": f"{s // 60}:{s % 60:02d}", "end": f"{e // 60}:{e % 60:02d}"}
                free_until = s
                break
        else:
            free_until = 23 * 60  # Free rest of day

        free_minutes = free_until - check_min if not occupied else 0

        if bldg not in buildings:
            buildings[bldg] = []

        buildings[bldg].append({
            "room": room,
            "available": not occupied,
            "free_minutes": max(0, free_minutes),
            "free_until": f"{free_until // 60}:{free_until % 60:02d}" if not occupied else None,
            "current_class": current_class,
            "next_class": next_class,
            "total_classes_today": len(today_slots),
        })

    # Sort: available rooms first, then by free_minutes desc
    for bldg in buildings:
        buildings[bldg].sort(key=lambda r: (not r["available"], -r["free_minutes"]))

    # Summary
    total_rooms = sum(len(rooms) for rooms in buildings.values())
    available_rooms = sum(1 for rooms in buildings.values() for r in rooms if r["available"])

    return {
        "check_day": check_day,
        "check_time": f"{check_min // 60}:{check_min % 60:02d}",
        "total_rooms": total_rooms,
        "available_rooms": available_rooms,
        "buildings": dict(sorted(buildings.items())),
    }


@app.get("/api/rooms/building/{building}")
def rooms_building_schedule(building: str):
    """Get the full day schedule for all rooms in a building."""
    schedule = _get_room_schedule()
    if not schedule:
        return {"error": "No course data loaded.", "rooms": []}

    now = _dt.now()
    today = now.weekday()

    rooms: dict[str, list] = {}
    for (bldg, room), slots in schedule.items():
        if bldg.upper() != building.upper():
            continue
        today_slots = sorted(
            [{"start": s, "end": e, "course": code, "type": st}
             for (wd, s, e, code, st) in slots if wd == today],
            key=lambda x: x["start"],
        )
        # Format times
        for slot in today_slots:
            sm, em = slot["start"], slot["end"]
            slot["start_str"] = f"{sm // 60}:{sm % 60:02d}"
            slot["end_str"] = f"{em // 60}:{em % 60:02d}"
        rooms[room] = today_slots

    return {
        "building": building.upper(),
        "day": today,
        "rooms": dict(sorted(rooms.items())),
    }


# ── Dining Menus ─────────────────────────────────────────────────────────────

_dining_cache: dict = {"menus": None, "ts": 0, "scraping": False}
_nutrition_cache: dict = {}  # Cache nutrition facts: {url_key: {protein, carbs, fat, ...}}
DINING_TTL = 86400  # 24 hours — refresh menus daily

# HDH scraper config
_HDH_VENUE_URL = "https://hdh-web.ucsd.edu/dining/apps/diningservices/Restaurants/Venue_V3"
_HDH_RESTAURANTS_URL = "https://hdh-web.ucsd.edu/dining/apps/diningservices/Restaurants/Restaurants"

HDH_LOCATIONS = {
    "64-degrees":    {"locId": "64", "locDetID": "18"},
    "bistro":        {"locId": "27", "locDetID": "13"},
    "canyon-vista":  {"locId": "24", "locDetID": "11"},
    "club-med":      {"locId": "15", "locDetID": "7"},
    "foodworx":      {"locId": "11", "locDetID": "6"},
    "oceanview":     {"locId": "05", "locDetID": "4"},
    "sixth-college": {"locId": "37", "locDetID": "24"},
    "ventanas":      {"locId": "18", "locDetID": "8"},
}

_DIET_TAG_MAP = {
    "vegan": "vegan",
    "vegetarian": "vegetarian",
    "contains dairy": "dairy",
    "contains eggs": "eggs",
    "contains soy": "soy",
    "contains wheat": "wheat",
    "contains gluten": "gluten",
    "contains fish": "fish",
    "contains sesame": "sesame",
    "contains treenuts": "tree-nuts",
    "contains peanuts": "peanuts",
    "contains shellfish": "shellfish",
    "sustainability": "sustainable",
    "gluten free": "gluten-free",
}


_HDH_BASE_URL = "https://hdh-web.ucsd.edu"


def _scrape_nutrition_detail(href: str) -> dict | None:
    """Scrape real macros from an HDH Nutritionfacts2 page.

    Returns {protein, carbs, fat} in grams, or None on failure.
    HDH nutrition pages have a table with rows like:
      Protein  7.8 g  16%
      Tot. Carb.  41.0 g  15%
      Total Fat  23.0 g  29%
    """
    global _nutrition_cache
    if href in _nutrition_cache:
        return _nutrition_cache[href]

    try:
        import requests as _req
        time.sleep(0.15)  # Be respectful of HDH servers
        url = _HDH_BASE_URL + href if href.startswith("/") else href
        resp = _req.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; TritonCourses/1.0; educational)",
        })
        resp.raise_for_status()
        text = resp.text.lower()
        # Replace &nbsp; with regular space so regex can match through it
        text = text.replace("&nbsp;", " ").replace("\xa0", " ")

        # Parse macros from <td> cells in the nutrition table
        # Actual HDH format (inside <td> tags):
        #   protein 7.8 g
        #   total fat 23.0 g       (has &nbsp; between fat and number)
        #   tot. carb. 41.0 g      (abbreviated, not "total carbohydrate")
        result = {}

        protein_m = _re.search(r"protein\s+([\d.]+)\s*g", text)
        if protein_m:
            result["protein"] = round(float(protein_m.group(1)))

        # HDH uses "tot. carb." not "total carbohydrate"
        carbs_m = _re.search(r"tot(?:al|\.)\s*carb\.?\s+([\d.]+)\s*g", text)
        if carbs_m:
            result["carbs"] = round(float(carbs_m.group(1)))

        # HDH has &nbsp; (now space) between "total fat" and the number
        fat_m = _re.search(r"total\s+fat\s+([\d.]+)\s*g", text)
        if fat_m:
            result["fat"] = round(float(fat_m.group(1)))

        if result.get("protein") is not None:
            _nutrition_cache[href] = result
            return result
        else:
            logger.debug("Nutrition parse failed for %s — no protein found", href)

    except Exception as e:
        logger.debug("Nutrition fetch failed for %s: %s", href, e)

    return None


def _batch_fetch_nutrition(hrefs: list[str]) -> dict[str, dict]:
    """Fetch nutrition details for multiple items concurrently.

    Uses ThreadPoolExecutor with 10 workers to fetch ~170 nutrition pages
    in ~30s instead of ~50s sequentially. Returns {href: {protein, carbs, fat}}.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    # Filter out already-cached hrefs
    uncached = [h for h in hrefs if h not in _nutrition_cache]
    results: dict[str, dict] = {}

    # Return cached results immediately
    for h in hrefs:
        if h in _nutrition_cache:
            results[h] = _nutrition_cache[h]

    if not uncached:
        return results

    logger.info("Fetching nutrition for %d items (%d cached)...", len(uncached), len(hrefs) - len(uncached))

    def fetch_one(href: str) -> tuple[str, dict | None]:
        return href, _scrape_nutrition_detail(href)

    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(fetch_one, h): h for h in uncached}
        done_count = 0
        for future in as_completed(futures):
            try:
                href, macros = future.result()
                if macros:
                    results[href] = macros
                done_count += 1
            except Exception:
                done_count += 1

    logger.info("Nutrition fetch complete: %d/%d items got real macros", len(results), len(hrefs))
    return results


def _scrape_hdh_venue(session, loc_id: str, loc_config: dict) -> dict | None:
    """Scrape a single HDH dining venue for today's menu.

    Two-phase approach:
    1. Parse the menu page to get all items + their nutrition page hrefs
    2. Batch-fetch all nutrition pages concurrently for real macros

    HDH page structure:
      <div class="meal-category">
        <h2>Breakfast Menu</h2>
        <div class="menu-category-section">
          <h3>StationName</h3>
          <div class="menU-item-row row">
            <a class="sublocsitem" href="/dining/.../Nutritionfacts2?id=X&recId=Y">ItemName</a>
            <span class="cals">313 Cals</span>
            <span class="item-price">$3.50</span>
            <img alt="Vegan Icon"/>
          </div>
        </div>
      </div>
    """
    from bs4 import BeautifulSoup
    try:
        url = f"{_HDH_VENUE_URL}?locId={loc_config['locId']}&locDetID={loc_config['locDetID']}&dayNum=0"
        resp = session.get(url, timeout=30, headers={
            "User-Agent": "Mozilla/5.0 (compatible; TritonCourses/1.0; educational)",
        })
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        # ── Phase 1: Parse all items from menu page ──
        # Collect raw item data + nutrition hrefs for batch fetching
        raw_items: list[dict] = []
        all_nutrition_hrefs: list[str] = []
        meals_structure: dict[str, list[int]] = {}  # meal_name → [indices into raw_items]
        seen_items: dict[str, set] = {}

        meal_divs = soup.find_all("div", class_="meal-category")

        for meal_div in meal_divs:
            h2 = meal_div.find("h2")
            if not h2:
                continue
            h2_text = h2.get_text(strip=True)
            meal_name = h2_text.replace(" Menu", "").strip()
            if meal_name not in ("Breakfast", "Lunch", "Dinner", "Brunch", "Late Night", "Lunch Dinner"):
                continue

            if meal_name not in meals_structure:
                meals_structure[meal_name] = []
                seen_items[meal_name] = set()

            stations = meal_div.find_all("div", class_="menu-category-section")

            for station_div in stations:
                h3 = station_div.find("h3")
                station_name = h3.get_text(strip=True) if h3 else ""

                item_rows = station_div.find_all("div", class_="menU-item-row")

                for row in item_rows:
                    name_link = row.find("a", class_="sublocsitem")
                    if not name_link:
                        continue
                    item_name = name_link.get_text(strip=True)
                    if not item_name:
                        continue

                    dedup_key = f"{station_name}:{item_name}"
                    if dedup_key in seen_items[meal_name]:
                        continue
                    seen_items[meal_name].add(dedup_key)

                    calories = 0
                    cal_span = row.find("span", class_="cals")
                    if cal_span:
                        cal_match = _re.search(r"(\d+)", cal_span.get_text())
                        if cal_match:
                            calories = int(cal_match.group(1))

                    price = 0.0
                    price_span = row.find("span", class_="item-price")
                    if price_span:
                        price_match = _re.search(r"\$(\d+\.?\d*)", price_span.get_text())
                        if price_match:
                            price = float(price_match.group(1))

                    tags = []
                    for img in row.find_all("img"):
                        alt = (img.get("alt", "") or "").lower().replace(" icon", "").strip()
                        if alt in _DIET_TAG_MAP:
                            tags.append(_DIET_TAG_MAP[alt])

                    nutrition_href = name_link.get("href", "")
                    has_nutrition_link = bool(nutrition_href and "Nutrition" in nutrition_href)

                    idx = len(raw_items)
                    raw_items.append({
                        "name": item_name,
                        "calories": calories,
                        "price": price,
                        "tags": tags,
                        "station": station_name,
                        "nutrition_href": nutrition_href if has_nutrition_link else "",
                    })
                    meals_structure[meal_name].append(idx)

                    if has_nutrition_link and nutrition_href not in all_nutrition_hrefs:
                        all_nutrition_hrefs.append(nutrition_href)

        if not raw_items:
            return None

        # ── Phase 2: Batch-fetch all nutrition pages concurrently ──
        nutrition_results = _batch_fetch_nutrition(all_nutrition_hrefs)

        # ── Phase 3: Assemble final menu items with real or estimated macros ──
        meals: dict[str, list] = {}
        for meal_name, item_indices in meals_structure.items():
            meals[meal_name] = []
            for idx in item_indices:
                item = raw_items[idx]
                tags = list(item["tags"])  # copy to avoid mutation

                real_macros = nutrition_results.get(item["nutrition_href"]) if item["nutrition_href"] else None

                if real_macros:
                    protein = real_macros.get("protein", 0)
                    carbs = real_macros.get("carbs", 0)
                    fat = real_macros.get("fat", 0)
                    # Recalculate calories from macros for consistency
                    item["calories"] = protein * 4 + carbs * 4 + fat * 9
                    nutrition_source = "hdh"
                else:
                    # Fallback: estimate macros from calories
                    calories = item["calories"]
                    protein = 0
                    carbs = 0
                    fat = 0
                    if calories > 0:
                        if "vegan" in tags:
                            protein = round(calories * 0.12 / 4)
                            carbs = round(calories * 0.55 / 4)
                            fat = round(calories * 0.33 / 9)
                        else:
                            protein = round(calories * 0.20 / 4)
                            carbs = round(calories * 0.45 / 4)
                            fat = round(calories * 0.35 / 9)
                    nutrition_source = "estimated"

                if protein >= 20 and "high-protein" not in tags:
                    tags.append("high-protein")

                meals[meal_name].append({
                    "name": item["name"],
                    "protein": protein,
                    "carbs": carbs,
                    "fat": fat,
                    "calories": item["calories"],
                    "price": item["price"],
                    "tags": tags,
                    "station": item["station"],
                    "nutrition_source": nutrition_source,
                })

        # Normalize meal keys
        normalized: dict[str, list] = {}
        for meal_key, items in meals.items():
            if meal_key == "Brunch":
                normalized.setdefault("Breakfast", []).extend(items)
            elif meal_key == "Late Night":
                normalized.setdefault("Dinner", []).extend(items)
            elif meal_key == "Lunch Dinner":
                normalized.setdefault("Lunch", []).extend(items)
                normalized.setdefault("Dinner", []).extend(items)
            else:
                normalized.setdefault(meal_key, []).extend(items)

        for cat in ("Breakfast", "Lunch", "Dinner", "Sides", "Desserts"):
            if cat not in normalized:
                normalized[cat] = []

        return normalized

    except Exception as e:
        logger.warning("Failed to scrape HDH venue %s: %s", loc_id, e)
        return None


def _scrape_all_hdh_menus() -> dict:
    """Scrape all HDH dining venues. Returns {loc_id: {meals: {...}, info: {...}}}."""
    import requests as req_lib
    session = req_lib.Session()
    result = {}

    for loc_id, loc_config in HDH_LOCATIONS.items():
        meals = _scrape_hdh_venue(session, loc_id, loc_config)
        if meals:
            loc_info = UCSD_DINING_LOCATIONS.get(loc_id, {})
            result[loc_id] = {
                "info": {**loc_info, "hours_str": _get_hours_string(loc_info.get("hours", {}))},
                "meals": meals,
                "scraped": True,
            }
            logger.info("Scraped HDH menu: %s — %d items", loc_id,
                        sum(len(v) for v in meals.values()))
        else:
            # Fall back to sample data
            if loc_id in SAMPLE_MENUS:
                loc_info = UCSD_DINING_LOCATIONS.get(loc_id, {})
                result[loc_id] = {
                    "info": {**loc_info, "hours_str": _get_hours_string(loc_info.get("hours", {}))},
                    "meals": SAMPLE_MENUS[loc_id],
                    "scraped": False,
                }
                logger.info("Using sample data for %s (scrape failed)", loc_id)

    return result


def _refresh_dining_cache():
    """Refresh dining cache if stale. Called from endpoints and background thread."""
    now = time.time()
    if _dining_cache["menus"] and (now - _dining_cache["ts"]) < DINING_TTL:
        return  # Cache is fresh
    if _dining_cache["scraping"]:
        return  # Already scraping

    _dining_cache["scraping"] = True
    try:
        logger.info("Refreshing dining menus from HDH...")
        result = _scrape_all_hdh_menus()
        if result:
            _dining_cache["menus"] = result
            _dining_cache["ts"] = time.time()
            logger.info("Dining cache refreshed: %d locations", len(result))
        else:
            # If scrape totally failed and we have no cache, use sample data
            if not _dining_cache["menus"]:
                logger.warning("HDH scrape failed, loading sample data")
                _dining_cache["menus"] = _build_sample_menu_response()
                _dining_cache["ts"] = time.time()
    finally:
        _dining_cache["scraping"] = False


def _build_sample_menu_response() -> dict:
    """Build response from hardcoded SAMPLE_MENUS as fallback.
    Marks all items with nutrition_source='sample' so the frontend knows."""
    result = {}
    for loc_id, meals in SAMPLE_MENUS.items():
        loc_info = UCSD_DINING_LOCATIONS.get(loc_id, {})
        # Tag every item so frontend can show it's sample data
        tagged_meals = {}
        for meal_name, items in meals.items():
            tagged_meals[meal_name] = [
                {**item, "nutrition_source": "sample"} for item in items
            ]
        result[loc_id] = {
            "info": {**loc_info, "hours_str": _get_hours_string(loc_info.get("hours", {}))},
            "meals": tagged_meals,
            "scraped": False,
        }
    return result


def _dining_refresh_loop():
    """Background thread: refresh dining data on startup, then every 24h."""
    time.sleep(3)  # Wait for server to start
    while True:
        try:
            _refresh_dining_cache()
        except Exception as e:
            logger.error("Dining refresh error: %s", e)
        time.sleep(DINING_TTL)


# Start background dining refresh thread
_dining_thread = threading.Thread(target=_dining_refresh_loop, daemon=True)
_dining_thread.start()


# Real UCSD HDH dining locations with accurate info from hdh-web.ucsd.edu
UCSD_DINING_LOCATIONS = {
    "64-degrees": {
        "name": "64 Degrees",
        "college": "Revelle",
        "hours": {"Mon-Thu": "7am-11pm", "Fri": "7am-8pm", "Sat": "10am-8pm", "Sun": "10am-11pm"},
        "stations": ["Triton Grill", "Wok This Way", "Taqueria", "Garden Bar", "al Dente", "UMI Sushi Bar"],
        "description": "Good mood food — burritos, sushi, burgers and milkshakes",
    },
    "bistro": {
        "name": "Bistro",
        "college": "Marshall",
        "hours": {"Mon-Fri": "11am-9pm", "Sat-Sun": "Closed"},
        "stations": ["Sushi Bar", "Open Kitchen", "Pacific Rim"],
        "description": "Modern eatery with sushi bar and Pacific Rim-inspired menu",
    },
    "canyon-vista": {
        "name": "Canyon Vista",
        "college": "Warren",
        "hours": {"Mon-Fri": "7am-11pm", "Sat": "9am-11pm", "Sun": "10am-8pm"},
        "stations": ["Fusion Grill", "Fresh", "Three-Sixty", "Earl's Coffee House"],
        "description": "Largest halal-certified residential dining facility in the nation",
    },
    "club-med": {
        "name": "Club Med",
        "college": "School of Medicine",
        "hours": {"Mon-Fri": "7am-2pm", "Sat-Sun": "Closed"},
        "stations": ["Grill", "Deli", "Salad Bar"],
        "description": "Made-to-order breakfast burritos, pizzas, sandwiches, salads and soups",
    },
    "foodworx": {
        "name": "Foodworx",
        "college": "ERC",
        "hours": {"Mon-Fri": "9am-8pm", "Sat-Sun": "Closed"},
        "stations": ["Pizza", "Sandwich Bar", "Patio Grill", "Salad Bar"],
        "description": "Personal pizzas made to order, fresh salads, and sandwich bar",
    },
    "oceanview": {
        "name": "OceanView",
        "college": "Marshall",
        "hours": {"Mon-Thu": "8am-9pm", "Fri": "8am-4pm", "Sat-Sun": "Closed"},
        "stations": ["Mediterranean", "Pizza Oven", "Pasta", "Sandwich"],
        "description": "Fifth-floor restaurant with Mediterranean specialties and ocean views",
    },
    "sixth-college": {
        "name": "Restaurants at Sixth",
        "college": "Sixth",
        "hours": {"Mon-Thu": "8am-11pm", "Fri": "8am-8pm", "Sat": "10am-8pm", "Sun": "10am-11pm"},
        "stations": ["Plant-Based", "Poke", "Noodle Bar", "Street Food", "BBQ"],
        "description": "Five platforms: plant-based, poke bowls, noodles, street food, BBQ + largest market",
    },
    "ventanas": {
        "name": "Ventanas",
        "college": "Muir",
        "hours": {"Mon-Thu": "7am-11pm", "Fri": "7am-8pm", "Sat": "10am-8pm", "Sun": "10am-11pm"},
        "stations": ["Vibe (Caribbean)", "Journey (African)", "Soul", "Hapi (Hand Pies)", "Tandoor (Indian)", "Kaldi Coffee"],
        "description": "African Diaspora cuisine — Caribbean, African, Soul, Indian and hand pies",
    },
}

# Menu items with full macros: protein, carbs, fat, calories, price
# Each item: {name, protein, carbs, fat, calories, price, tags[], station}
SAMPLE_MENUS = {
    "64-degrees": {
        "Breakfast": [
            {"name": "Scrambled Eggs", "protein": 12, "carbs": 2, "fat": 10, "calories": 180, "price": 4.50, "tags": ["vegetarian", "gluten-free"], "station": "Triton Grill"},
            {"name": "Turkey Sausage Links", "protein": 14, "carbs": 1, "fat": 8, "calories": 160, "price": 3.75, "tags": ["high-protein", "gluten-free"], "station": "Triton Grill"},
            {"name": "Oatmeal Bar", "protein": 5, "carbs": 38, "fat": 4, "calories": 220, "price": 3.25, "tags": ["vegetarian", "vegan"], "station": "Garden Bar"},
            {"name": "Greek Yogurt Parfait", "protein": 15, "carbs": 28, "fat": 5, "calories": 250, "price": 5.50, "tags": ["vegetarian", "high-protein"], "station": "Garden Bar"},
            {"name": "Breakfast Burrito", "protein": 22, "carbs": 42, "fat": 18, "calories": 450, "price": 7.95, "tags": ["high-protein"], "station": "Taqueria"},
            {"name": "Egg & Cheese Bagel", "protein": 16, "carbs": 44, "fat": 12, "calories": 380, "price": 5.75, "tags": [], "station": "Triton Grill"},
        ],
        "Lunch": [
            {"name": "Grilled Chicken Breast", "protein": 35, "carbs": 0, "fat": 6, "calories": 280, "price": 9.50, "tags": ["high-protein", "gluten-free"], "station": "Triton Grill"},
            {"name": "Quinoa Power Bowl", "protein": 12, "carbs": 48, "fat": 8, "calories": 340, "price": 8.75, "tags": ["vegan"], "station": "Garden Bar"},
            {"name": "Caesar Salad w/ Chicken", "protein": 28, "carbs": 18, "fat": 16, "calories": 380, "price": 9.25, "tags": ["high-protein"], "station": "Garden Bar"},
            {"name": "Spicy Tuna Poke Bowl", "protein": 25, "carbs": 52, "fat": 8, "calories": 390, "price": 11.95, "tags": ["high-protein"], "station": "UMI Sushi Bar"},
            {"name": "Chicken Teriyaki Wok", "protein": 30, "carbs": 55, "fat": 10, "calories": 440, "price": 10.50, "tags": ["high-protein"], "station": "Wok This Way"},
            {"name": "Black Bean Burger", "protein": 18, "carbs": 48, "fat": 12, "calories": 420, "price": 8.50, "tags": ["vegetarian"], "station": "Triton Grill"},
        ],
        "Dinner": [
            {"name": "Salmon Fillet", "protein": 34, "carbs": 0, "fat": 18, "calories": 350, "price": 13.50, "tags": ["high-protein", "gluten-free"], "station": "Triton Grill"},
            {"name": "Steak Tips", "protein": 32, "carbs": 4, "fat": 20, "calories": 400, "price": 14.25, "tags": ["high-protein", "gluten-free"], "station": "Triton Grill"},
            {"name": "Tofu Stir-Fry", "protein": 16, "carbs": 28, "fat": 14, "calories": 310, "price": 9.75, "tags": ["vegan"], "station": "Wok This Way"},
            {"name": "Rotisserie Chicken", "protein": 38, "carbs": 0, "fat": 14, "calories": 320, "price": 11.50, "tags": ["high-protein", "gluten-free"], "station": "Triton Grill"},
            {"name": "California Roll Combo", "protein": 18, "carbs": 60, "fat": 6, "calories": 380, "price": 12.95, "tags": [], "station": "UMI Sushi Bar"},
            {"name": "Carne Asada Burrito", "protein": 28, "carbs": 52, "fat": 20, "calories": 520, "price": 10.95, "tags": ["high-protein"], "station": "Taqueria"},
        ],
        "Sides": [
            {"name": "French Fries", "protein": 3, "carbs": 38, "fat": 14, "calories": 320, "price": 3.50, "tags": ["vegan", "gluten-free"], "station": "Triton Grill"},
            {"name": "Side Salad", "protein": 2, "carbs": 8, "fat": 5, "calories": 80, "price": 3.25, "tags": ["vegan", "gluten-free"], "station": "Garden Bar"},
            {"name": "Miso Soup", "protein": 4, "carbs": 6, "fat": 2, "calories": 60, "price": 2.95, "tags": ["vegan"], "station": "UMI Sushi Bar"},
            {"name": "Steamed Rice", "protein": 3, "carbs": 44, "fat": 0, "calories": 200, "price": 2.00, "tags": ["vegan", "gluten-free"], "station": "Wok This Way"},
            {"name": "Edamame", "protein": 11, "carbs": 8, "fat": 5, "calories": 120, "price": 3.50, "tags": ["vegan", "gluten-free", "high-protein"], "station": "UMI Sushi Bar"},
        ],
        "Desserts": [
            {"name": "Chocolate Milkshake", "protein": 8, "carbs": 62, "fat": 14, "calories": 440, "price": 5.95, "tags": ["vegetarian"], "station": "Triton Grill"},
            {"name": "Cookies (2)", "protein": 3, "carbs": 36, "fat": 12, "calories": 280, "price": 3.50, "tags": ["vegetarian"], "station": "Garden Bar"},
            {"name": "Fruit Cup", "protein": 1, "carbs": 22, "fat": 0, "calories": 90, "price": 3.95, "tags": ["vegan", "gluten-free"], "station": "Garden Bar"},
        ],
    },
    "bistro": {
        "Breakfast": [],
        "Lunch": [
            {"name": "Salmon Sashimi Plate", "protein": 30, "carbs": 42, "fat": 12, "calories": 380, "price": 14.50, "tags": ["high-protein", "gluten-free"], "station": "Sushi Bar"},
            {"name": "Spicy Tuna Roll", "protein": 20, "carbs": 48, "fat": 8, "calories": 340, "price": 11.95, "tags": ["high-protein"], "station": "Sushi Bar"},
            {"name": "Teriyaki Chicken Bowl", "protein": 32, "carbs": 58, "fat": 10, "calories": 460, "price": 12.50, "tags": ["high-protein"], "station": "Open Kitchen"},
            {"name": "Pad Thai", "protein": 18, "carbs": 52, "fat": 14, "calories": 420, "price": 11.25, "tags": [], "station": "Pacific Rim"},
            {"name": "Miso Glazed Cod", "protein": 28, "carbs": 14, "fat": 8, "calories": 260, "price": 15.95, "tags": ["high-protein", "gluten-free"], "station": "Open Kitchen"},
            {"name": "Vegetable Tempura", "protein": 6, "carbs": 38, "fat": 16, "calories": 340, "price": 9.50, "tags": ["vegetarian", "vegan"], "station": "Pacific Rim"},
        ],
        "Dinner": [
            {"name": "Dragon Roll", "protein": 22, "carbs": 50, "fat": 14, "calories": 420, "price": 15.50, "tags": ["high-protein"], "station": "Sushi Bar"},
            {"name": "Korean BBQ Short Ribs", "protein": 30, "carbs": 12, "fat": 22, "calories": 420, "price": 16.95, "tags": ["high-protein", "gluten-free"], "station": "Open Kitchen"},
            {"name": "Ramen (Tonkotsu)", "protein": 24, "carbs": 62, "fat": 18, "calories": 520, "price": 13.50, "tags": ["high-protein"], "station": "Pacific Rim"},
            {"name": "Ahi Tuna Poke", "protein": 28, "carbs": 48, "fat": 10, "calories": 400, "price": 14.25, "tags": ["high-protein"], "station": "Sushi Bar"},
            {"name": "Tofu Bibimbap", "protein": 16, "carbs": 58, "fat": 10, "calories": 380, "price": 11.50, "tags": ["vegetarian"], "station": "Pacific Rim"},
        ],
        "Sides": [
            {"name": "Seaweed Salad", "protein": 2, "carbs": 8, "fat": 4, "calories": 70, "price": 4.50, "tags": ["vegan", "gluten-free"], "station": "Sushi Bar"},
            {"name": "Gyoza (6pc)", "protein": 8, "carbs": 24, "fat": 8, "calories": 220, "price": 5.95, "tags": [], "station": "Pacific Rim"},
            {"name": "Miso Soup", "protein": 4, "carbs": 6, "fat": 2, "calories": 60, "price": 3.50, "tags": ["vegan"], "station": "Pacific Rim"},
        ],
        "Desserts": [
            {"name": "Mochi Ice Cream (3pc)", "protein": 3, "carbs": 30, "fat": 6, "calories": 180, "price": 5.50, "tags": ["vegetarian"], "station": "Sushi Bar"},
            {"name": "Green Tea Cheesecake", "protein": 5, "carbs": 34, "fat": 16, "calories": 310, "price": 6.95, "tags": ["vegetarian"], "station": "Pacific Rim"},
        ],
    },
    "canyon-vista": {
        "Breakfast": [
            {"name": "Egg White Omelet", "protein": 18, "carbs": 2, "fat": 4, "calories": 200, "price": 5.25, "tags": ["high-protein", "gluten-free"], "station": "Fusion Grill"},
            {"name": "Pancake Stack", "protein": 6, "carbs": 58, "fat": 8, "calories": 350, "price": 4.50, "tags": ["vegetarian"], "station": "Fusion Grill"},
            {"name": "Turkey Bacon", "protein": 10, "carbs": 0, "fat": 8, "calories": 180, "price": 3.50, "tags": ["high-protein", "gluten-free"], "station": "Fusion Grill"},
            {"name": "Smoothie Bowl (Acai)", "protein": 8, "carbs": 42, "fat": 6, "calories": 280, "price": 6.95, "tags": ["vegan"], "station": "Fresh"},
            {"name": "Halal Chicken Sausage", "protein": 16, "carbs": 2, "fat": 8, "calories": 170, "price": 4.25, "tags": ["high-protein", "gluten-free"], "station": "Fusion Grill"},
        ],
        "Lunch": [
            {"name": "Halal Chicken Shawarma", "protein": 32, "carbs": 35, "fat": 14, "calories": 420, "price": 10.95, "tags": ["high-protein"], "station": "Three-Sixty"},
            {"name": "BBQ Chicken Pizza", "protein": 22, "carbs": 48, "fat": 14, "calories": 480, "price": 7.50, "tags": ["high-protein"], "station": "Fusion Grill"},
            {"name": "Garden Salad Bar", "protein": 5, "carbs": 18, "fat": 4, "calories": 150, "price": 6.25, "tags": ["vegan", "gluten-free"], "station": "Fresh"},
            {"name": "Chicken Teriyaki Bowl", "protein": 30, "carbs": 55, "fat": 10, "calories": 420, "price": 10.50, "tags": ["high-protein"], "station": "Three-Sixty"},
            {"name": "Falafel Wrap", "protein": 14, "carbs": 42, "fat": 16, "calories": 400, "price": 8.95, "tags": ["vegetarian", "vegan"], "station": "Three-Sixty"},
        ],
        "Dinner": [
            {"name": "Grilled Tilapia", "protein": 28, "carbs": 4, "fat": 8, "calories": 260, "price": 12.50, "tags": ["high-protein", "gluten-free"], "station": "Fusion Grill"},
            {"name": "Beef Kofta", "protein": 26, "carbs": 8, "fat": 18, "calories": 380, "price": 11.95, "tags": ["high-protein", "gluten-free"], "station": "Three-Sixty"},
            {"name": "Chicken Parmesan", "protein": 32, "carbs": 38, "fat": 18, "calories": 520, "price": 11.75, "tags": ["high-protein"], "station": "Fusion Grill"},
            {"name": "Mushroom Risotto", "protein": 8, "carbs": 52, "fat": 12, "calories": 380, "price": 10.25, "tags": ["vegetarian"], "station": "Fusion Grill"},
            {"name": "Lamb Shawarma Plate", "protein": 30, "carbs": 40, "fat": 20, "calories": 480, "price": 13.50, "tags": ["high-protein"], "station": "Three-Sixty"},
        ],
        "Sides": [
            {"name": "Hummus & Pita", "protein": 6, "carbs": 28, "fat": 8, "calories": 220, "price": 4.50, "tags": ["vegan"], "station": "Three-Sixty"},
            {"name": "Tabbouleh", "protein": 3, "carbs": 18, "fat": 6, "calories": 140, "price": 3.95, "tags": ["vegan"], "station": "Three-Sixty"},
            {"name": "Sweet Potato Fries", "protein": 2, "carbs": 34, "fat": 10, "calories": 260, "price": 4.25, "tags": ["vegan", "gluten-free"], "station": "Fusion Grill"},
            {"name": "Jasmine Rice", "protein": 3, "carbs": 44, "fat": 0, "calories": 200, "price": 2.00, "tags": ["vegan", "gluten-free"], "station": "Three-Sixty"},
        ],
        "Desserts": [
            {"name": "Baklava", "protein": 4, "carbs": 38, "fat": 14, "calories": 320, "price": 4.95, "tags": ["vegetarian"], "station": "Three-Sixty"},
            {"name": "Chocolate Brownie", "protein": 3, "carbs": 40, "fat": 14, "calories": 310, "price": 3.75, "tags": ["vegetarian"], "station": "Earl's Coffee House"},
            {"name": "Fresh Fruit Bowl", "protein": 1, "carbs": 26, "fat": 0, "calories": 100, "price": 4.50, "tags": ["vegan", "gluten-free"], "station": "Fresh"},
        ],
    },
    "club-med": {
        "Breakfast": [
            {"name": "Breakfast Burrito", "protein": 20, "carbs": 38, "fat": 16, "calories": 420, "price": 7.25, "tags": ["high-protein"], "station": "Grill"},
            {"name": "Bagel w/ Cream Cheese", "protein": 10, "carbs": 52, "fat": 10, "calories": 360, "price": 4.50, "tags": ["vegetarian"], "station": "Deli"},
            {"name": "Fruit & Granola", "protein": 6, "carbs": 48, "fat": 8, "calories": 300, "price": 5.50, "tags": ["vegetarian"], "station": "Salad Bar"},
        ],
        "Lunch": [
            {"name": "Turkey & Avocado Sandwich", "protein": 26, "carbs": 34, "fat": 14, "calories": 420, "price": 9.50, "tags": ["high-protein"], "station": "Deli"},
            {"name": "Margherita Pizza (Personal)", "protein": 14, "carbs": 42, "fat": 12, "calories": 380, "price": 7.95, "tags": ["vegetarian"], "station": "Grill"},
            {"name": "Chicken Caesar Wrap", "protein": 28, "carbs": 30, "fat": 14, "calories": 400, "price": 9.25, "tags": ["high-protein"], "station": "Deli"},
            {"name": "Soup of the Day", "protein": 8, "carbs": 18, "fat": 6, "calories": 180, "price": 5.50, "tags": [], "station": "Salad Bar"},
            {"name": "Cobb Salad", "protein": 24, "carbs": 12, "fat": 18, "calories": 340, "price": 10.25, "tags": ["high-protein", "gluten-free"], "station": "Salad Bar"},
        ],
        "Dinner": [],
        "Sides": [
            {"name": "Chips", "protein": 2, "carbs": 28, "fat": 10, "calories": 220, "price": 2.50, "tags": ["vegan", "gluten-free"], "station": "Deli"},
            {"name": "Side Caesar Salad", "protein": 4, "carbs": 10, "fat": 8, "calories": 130, "price": 3.75, "tags": ["vegetarian"], "station": "Salad Bar"},
        ],
        "Desserts": [
            {"name": "Cookie", "protein": 2, "carbs": 22, "fat": 8, "calories": 180, "price": 2.50, "tags": ["vegetarian"], "station": "Deli"},
        ],
    },
    "foodworx": {
        "Breakfast": [],
        "Lunch": [
            {"name": "Build-Your-Own Pizza", "protein": 16, "carbs": 48, "fat": 14, "calories": 420, "price": 8.95, "tags": [], "station": "Pizza"},
            {"name": "Grilled Chicken Sandwich", "protein": 30, "carbs": 36, "fat": 12, "calories": 400, "price": 9.50, "tags": ["high-protein"], "station": "Patio Grill"},
            {"name": "Southwest Salad", "protein": 22, "carbs": 20, "fat": 14, "calories": 320, "price": 9.25, "tags": ["high-protein", "gluten-free"], "station": "Salad Bar"},
            {"name": "Italian Sub", "protein": 24, "carbs": 42, "fat": 16, "calories": 440, "price": 8.75, "tags": ["high-protein"], "station": "Sandwich Bar"},
            {"name": "Veggie Pizza", "protein": 12, "carbs": 46, "fat": 10, "calories": 340, "price": 7.95, "tags": ["vegetarian"], "station": "Pizza"},
        ],
        "Dinner": [
            {"name": "Patio Burger", "protein": 28, "carbs": 40, "fat": 22, "calories": 520, "price": 10.95, "tags": ["high-protein"], "station": "Patio Grill"},
            {"name": "Pepperoni Pizza", "protein": 18, "carbs": 46, "fat": 16, "calories": 440, "price": 8.50, "tags": [], "station": "Pizza"},
            {"name": "Garden Veggie Wrap", "protein": 10, "carbs": 38, "fat": 8, "calories": 280, "price": 7.50, "tags": ["vegetarian", "vegan"], "station": "Sandwich Bar"},
            {"name": "BBQ Chicken Pizza", "protein": 24, "carbs": 48, "fat": 14, "calories": 460, "price": 9.50, "tags": ["high-protein"], "station": "Pizza"},
        ],
        "Sides": [
            {"name": "Garlic Breadsticks", "protein": 4, "carbs": 32, "fat": 8, "calories": 240, "price": 3.50, "tags": ["vegetarian"], "station": "Pizza"},
            {"name": "Side Salad", "protein": 2, "carbs": 8, "fat": 5, "calories": 80, "price": 3.25, "tags": ["vegan", "gluten-free"], "station": "Salad Bar"},
        ],
        "Desserts": [
            {"name": "Brownie", "protein": 3, "carbs": 38, "fat": 14, "calories": 300, "price": 3.50, "tags": ["vegetarian"], "station": "Sandwich Bar"},
            {"name": "Ice Cream Scoop", "protein": 3, "carbs": 22, "fat": 8, "calories": 180, "price": 3.95, "tags": ["vegetarian", "gluten-free"], "station": "Patio Grill"},
        ],
    },
    "oceanview": {
        "Breakfast": [
            {"name": "Mediterranean Omelet", "protein": 20, "carbs": 6, "fat": 14, "calories": 260, "price": 6.50, "tags": ["high-protein", "gluten-free"], "station": "Mediterranean"},
            {"name": "Avocado Toast", "protein": 8, "carbs": 32, "fat": 14, "calories": 300, "price": 6.95, "tags": ["vegetarian", "vegan"], "station": "Mediterranean"},
            {"name": "Egg & Cheese Croissant", "protein": 14, "carbs": 28, "fat": 18, "calories": 360, "price": 5.75, "tags": ["vegetarian"], "station": "Sandwich"},
        ],
        "Lunch": [
            {"name": "Chicken Pesto Panini", "protein": 30, "carbs": 38, "fat": 16, "calories": 440, "price": 10.50, "tags": ["high-protein"], "station": "Sandwich"},
            {"name": "Stone-Fired Margherita", "protein": 14, "carbs": 44, "fat": 12, "calories": 360, "price": 9.95, "tags": ["vegetarian"], "station": "Pizza Oven"},
            {"name": "Greek Salad w/ Grilled Chicken", "protein": 32, "carbs": 14, "fat": 16, "calories": 360, "price": 11.50, "tags": ["high-protein", "gluten-free"], "station": "Mediterranean"},
            {"name": "Pasta Bolognese", "protein": 22, "carbs": 58, "fat": 14, "calories": 460, "price": 10.95, "tags": ["high-protein"], "station": "Pasta"},
            {"name": "Falafel Plate", "protein": 14, "carbs": 44, "fat": 16, "calories": 400, "price": 9.50, "tags": ["vegetarian", "vegan"], "station": "Mediterranean"},
        ],
        "Dinner": [
            {"name": "Grilled Lamb Chops", "protein": 34, "carbs": 4, "fat": 22, "calories": 420, "price": 16.50, "tags": ["high-protein", "gluten-free"], "station": "Mediterranean"},
            {"name": "Shrimp Scampi Pasta", "protein": 26, "carbs": 52, "fat": 14, "calories": 460, "price": 14.25, "tags": ["high-protein"], "station": "Pasta"},
            {"name": "Eggplant Parmesan", "protein": 12, "carbs": 38, "fat": 16, "calories": 380, "price": 10.50, "tags": ["vegetarian"], "station": "Mediterranean"},
            {"name": "Seared Ahi Tuna", "protein": 36, "carbs": 8, "fat": 10, "calories": 300, "price": 15.95, "tags": ["high-protein", "gluten-free"], "station": "Mediterranean"},
        ],
        "Sides": [
            {"name": "Roasted Vegetables", "protein": 3, "carbs": 14, "fat": 6, "calories": 120, "price": 4.25, "tags": ["vegan", "gluten-free"], "station": "Mediterranean"},
            {"name": "Garlic Bread", "protein": 4, "carbs": 28, "fat": 8, "calories": 220, "price": 3.50, "tags": ["vegetarian"], "station": "Pizza Oven"},
            {"name": "Soup of the Day", "protein": 6, "carbs": 16, "fat": 4, "calories": 140, "price": 4.95, "tags": [], "station": "Mediterranean"},
        ],
        "Desserts": [
            {"name": "Tiramisu", "protein": 4, "carbs": 32, "fat": 14, "calories": 290, "price": 6.50, "tags": ["vegetarian"], "station": "Pasta"},
            {"name": "Cannoli", "protein": 5, "carbs": 28, "fat": 12, "calories": 260, "price": 5.25, "tags": ["vegetarian"], "station": "Pasta"},
        ],
    },
    "sixth-college": {
        "Breakfast": [
            {"name": "Protein Pancakes", "protein": 20, "carbs": 36, "fat": 8, "calories": 320, "price": 6.50, "tags": ["high-protein", "vegetarian"], "station": "BBQ"},
            {"name": "Hard Boiled Eggs (3)", "protein": 18, "carbs": 1, "fat": 10, "calories": 210, "price": 3.25, "tags": ["high-protein", "gluten-free"], "station": "BBQ"},
            {"name": "Açaí Bowl", "protein": 6, "carbs": 48, "fat": 8, "calories": 310, "price": 8.95, "tags": ["vegan"], "station": "Plant-Based"},
            {"name": "Breakfast Poke Bowl", "protein": 16, "carbs": 42, "fat": 10, "calories": 340, "price": 9.50, "tags": ["high-protein"], "station": "Poke"},
        ],
        "Lunch": [
            {"name": "Double Chicken Burrito", "protein": 42, "carbs": 52, "fat": 18, "calories": 580, "price": 10.95, "tags": ["high-protein"], "station": "Street Food"},
            {"name": "Protein Power Bowl", "protein": 38, "carbs": 40, "fat": 12, "calories": 450, "price": 11.50, "tags": ["high-protein", "gluten-free"], "station": "BBQ"},
            {"name": "Spicy Poke Bowl", "protein": 28, "carbs": 50, "fat": 10, "calories": 410, "price": 12.50, "tags": ["high-protein"], "station": "Poke"},
            {"name": "Dan Dan Noodles", "protein": 18, "carbs": 52, "fat": 14, "calories": 420, "price": 9.75, "tags": [], "station": "Noodle Bar"},
            {"name": "Plant-Based Burger", "protein": 20, "carbs": 42, "fat": 14, "calories": 400, "price": 10.50, "tags": ["vegan"], "station": "Plant-Based"},
            {"name": "Korean BBQ Plate", "protein": 34, "carbs": 48, "fat": 16, "calories": 490, "price": 12.95, "tags": ["high-protein"], "station": "BBQ"},
        ],
        "Dinner": [
            {"name": "Herb Roasted Chicken", "protein": 36, "carbs": 4, "fat": 14, "calories": 340, "price": 11.95, "tags": ["high-protein", "gluten-free"], "station": "BBQ"},
            {"name": "Shoyu Ramen", "protein": 22, "carbs": 58, "fat": 14, "calories": 460, "price": 11.50, "tags": [], "station": "Noodle Bar"},
            {"name": "Vegan Chili Bowl", "protein": 16, "carbs": 38, "fat": 8, "calories": 290, "price": 8.50, "tags": ["vegan", "gluten-free"], "station": "Plant-Based"},
            {"name": "Smoked Brisket Plate", "protein": 36, "carbs": 12, "fat": 24, "calories": 440, "price": 14.50, "tags": ["high-protein", "gluten-free"], "station": "BBQ"},
            {"name": "Pad See Ew", "protein": 20, "carbs": 52, "fat": 12, "calories": 400, "price": 10.25, "tags": [], "station": "Noodle Bar"},
        ],
        "Sides": [
            {"name": "Mac & Cheese", "protein": 10, "carbs": 36, "fat": 14, "calories": 320, "price": 4.95, "tags": ["vegetarian"], "station": "BBQ"},
            {"name": "Coleslaw", "protein": 1, "carbs": 14, "fat": 8, "calories": 140, "price": 2.95, "tags": ["vegetarian", "gluten-free"], "station": "BBQ"},
            {"name": "Kimchi", "protein": 1, "carbs": 4, "fat": 0, "calories": 20, "price": 2.50, "tags": ["vegan", "gluten-free"], "station": "Noodle Bar"},
            {"name": "Cornbread", "protein": 4, "carbs": 28, "fat": 8, "calories": 210, "price": 3.25, "tags": ["vegetarian"], "station": "BBQ"},
        ],
        "Desserts": [
            {"name": "Banana Pudding", "protein": 4, "carbs": 38, "fat": 10, "calories": 270, "price": 4.50, "tags": ["vegetarian"], "station": "BBQ"},
            {"name": "Vegan Brownie", "protein": 3, "carbs": 36, "fat": 12, "calories": 280, "price": 4.25, "tags": ["vegan"], "station": "Plant-Based"},
        ],
    },
    "ventanas": {
        "Breakfast": [
            {"name": "Jerk Chicken & Eggs", "protein": 28, "carbs": 4, "fat": 14, "calories": 310, "price": 7.50, "tags": ["high-protein", "gluten-free"], "station": "Vibe (Caribbean)"},
            {"name": "Tandoori Egg Wrap", "protein": 18, "carbs": 32, "fat": 12, "calories": 340, "price": 6.95, "tags": ["high-protein"], "station": "Tandoor (Indian)"},
            {"name": "Plantain & Egg Plate", "protein": 14, "carbs": 38, "fat": 10, "calories": 320, "price": 6.50, "tags": ["gluten-free"], "station": "Journey (African)"},
            {"name": "Chai Oatmeal", "protein": 6, "carbs": 42, "fat": 4, "calories": 240, "price": 4.50, "tags": ["vegan"], "station": "Kaldi Coffee"},
        ],
        "Lunch": [
            {"name": "Jerk Chicken Plate", "protein": 34, "carbs": 42, "fat": 14, "calories": 440, "price": 11.50, "tags": ["high-protein", "gluten-free"], "station": "Vibe (Caribbean)"},
            {"name": "Chicken Tikka Masala", "protein": 30, "carbs": 48, "fat": 16, "calories": 470, "price": 11.95, "tags": ["high-protein"], "station": "Tandoor (Indian)"},
            {"name": "Lamb Hand Pie", "protein": 20, "carbs": 34, "fat": 16, "calories": 380, "price": 8.95, "tags": ["high-protein"], "station": "Hapi (Hand Pies)"},
            {"name": "Jollof Rice w/ Chicken", "protein": 28, "carbs": 54, "fat": 12, "calories": 450, "price": 10.95, "tags": ["high-protein", "gluten-free"], "station": "Journey (African)"},
            {"name": "Vegetable Samosa (3)", "protein": 6, "carbs": 36, "fat": 12, "calories": 280, "price": 6.50, "tags": ["vegetarian", "vegan"], "station": "Tandoor (Indian)"},
            {"name": "Curry Goat", "protein": 26, "carbs": 18, "fat": 16, "calories": 360, "price": 13.50, "tags": ["high-protein", "gluten-free"], "station": "Vibe (Caribbean)"},
        ],
        "Dinner": [
            {"name": "Oxtail Stew", "protein": 32, "carbs": 22, "fat": 20, "calories": 420, "price": 14.95, "tags": ["high-protein", "gluten-free"], "station": "Vibe (Caribbean)"},
            {"name": "Butter Chicken", "protein": 28, "carbs": 18, "fat": 18, "calories": 380, "price": 12.50, "tags": ["high-protein", "gluten-free"], "station": "Tandoor (Indian)"},
            {"name": "Suya Beef Skewers", "protein": 30, "carbs": 6, "fat": 16, "calories": 330, "price": 13.25, "tags": ["high-protein", "gluten-free"], "station": "Journey (African)"},
            {"name": "Veggie Curry", "protein": 10, "carbs": 38, "fat": 10, "calories": 300, "price": 9.50, "tags": ["vegan", "gluten-free"], "station": "Tandoor (Indian)"},
            {"name": "Soul Food Plate (Fried Chicken)", "protein": 32, "carbs": 28, "fat": 22, "calories": 480, "price": 12.95, "tags": ["high-protein"], "station": "Soul"},
        ],
        "Sides": [
            {"name": "Rice & Peas", "protein": 5, "carbs": 42, "fat": 2, "calories": 210, "price": 3.50, "tags": ["vegan", "gluten-free"], "station": "Vibe (Caribbean)"},
            {"name": "Naan Bread", "protein": 4, "carbs": 32, "fat": 4, "calories": 190, "price": 2.50, "tags": ["vegetarian"], "station": "Tandoor (Indian)"},
            {"name": "Fried Plantains", "protein": 1, "carbs": 32, "fat": 8, "calories": 210, "price": 3.75, "tags": ["vegan", "gluten-free"], "station": "Journey (African)"},
            {"name": "Collard Greens", "protein": 3, "carbs": 8, "fat": 4, "calories": 80, "price": 3.25, "tags": ["vegan", "gluten-free"], "station": "Soul"},
        ],
        "Desserts": [
            {"name": "Rum Cake", "protein": 3, "carbs": 42, "fat": 14, "calories": 320, "price": 5.50, "tags": ["vegetarian"], "station": "Vibe (Caribbean)"},
            {"name": "Gulab Jamun (3pc)", "protein": 3, "carbs": 36, "fat": 8, "calories": 240, "price": 4.95, "tags": ["vegetarian"], "station": "Tandoor (Indian)"},
            {"name": "Chin Chin", "protein": 2, "carbs": 28, "fat": 10, "calories": 220, "price": 3.75, "tags": ["vegetarian"], "station": "Journey (African)"},
        ],
    },
}


def _get_hours_string(hours_dict: dict) -> str:
    """Convert hours dict to a single-line string."""
    parts = []
    for days, hrs in hours_dict.items():
        parts.append(f"{days}: {hrs}")
    return " | ".join(parts)


@app.get("/api/dining/locations")
def dining_locations():
    """List all dining locations with hours."""
    return {"locations": UCSD_DINING_LOCATIONS}


@app.get("/api/dining/menus")
def dining_menus(location: str = Query(default=""), refresh: bool = Query(default=False)):
    """Get menus for a specific location or all locations.
    Live-scraped from HDH daily, with sample data fallback."""
    # Force refresh if requested
    if refresh:
        _dining_cache["ts"] = 0

    # Ensure cache is populated
    if not _dining_cache["menus"]:
        _refresh_dining_cache()

    # Still no data? Use sample fallback immediately
    cached = _dining_cache["menus"] or _build_sample_menu_response()
    last_updated = _dining_cache["ts"]

    if location and location in cached:
        return {
            "location": location,
            **cached[location],
            "last_updated": last_updated,
        }

    return {
        "menus": cached,
        "last_updated": last_updated,
    }


@app.post("/api/dining/refresh")
def dining_refresh():
    """Force refresh dining menus from HDH."""
    _dining_cache["ts"] = 0
    _refresh_dining_cache()
    count = len(_dining_cache["menus"] or {})
    return {"status": "refreshed", "locations": count, "ts": _dining_cache["ts"]}


# ── Dining AI Chat ───────────────────────────────────────────────────────────

DINING_SYSTEM_PROMPT = """You are a UCSD dining assistant. You help students find food on campus based on their dietary preferences, macros, and cravings.

You have access to the current menus at all UCSD dining halls. Here are the locations and their current menus:

{menu_context}

## Your capabilities:
- Find high-protein meals across all dining halls
- Rank meals by protein efficiency (protein per calorie)
- Recommend meals for specific diets (vegan, vegetarian, gluten-free, keto, etc.)
- Calculate daily meal plans within a Dining Dollar budget
- Suggest the best dining hall to visit right now based on what's available
- Compare full macros (protein, carbs, fat, calories) across locations
- Create multi-day meal plans optimized for goals (muscle gain, cut, budget, etc.)

## Dining Dollar Info:
- Plan A (Resident): $2,244/quarter = ~$32/day
- Plan B (Resident Plus): $2,784/quarter = ~$40/day
- Plan C (Premium): $3,564/quarter = ~$51/day
- Commuter Plan: $900/quarter = ~$13/day
- Breakfast items: $3-8, Lunch: $7-14, Dinner: $9-17, Sides: $2-5, Desserts: $2-7
- When calculating daily budgets, divide remaining dollars by remaining days in the quarter

## Rules:
- Always be specific: name the dining hall, the station, the meal period, and the exact dish
- Include full macros (protein/carbs/fat/cal) when recommending options
- When asked about protein efficiency, calculate protein per calorie (higher = better)
- If someone asks "where can I get X", check all locations and list the best matches
- Be conversational and friendly — you're helping a hungry college student
- Format recommendations clearly with the dining hall name bolded
- When creating meal plans, show running totals for macros and cost"""


class DiningChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = "gemini"
    gemini_api_key: Optional[str] = None


@app.post("/api/dining/chat")
def dining_chat(req: DiningChatRequest):
    """AI dining assistant chat."""
    # Build menu context from cached (scraped or sample) data
    cached = _dining_cache["menus"] or _build_sample_menu_response()
    menu_lines = []
    for loc_id, loc_data in cached.items():
        info = loc_data.get("info", {})
        hours_str = info.get("hours_str", "")
        menu_lines.append(f"\n### {info.get('name', loc_id)} ({info.get('college', '')}) — Hours: {hours_str}")
        meals = loc_data.get("meals", {})
        for meal_period, items in meals.items():
            if not items:
                continue
            menu_lines.append(f"  **{meal_period}:**")
            for item in items:
                tags = ", ".join(item.get("tags", []))
                price = item.get('price', 0)
                p = item.get('protein', 0)
                c = item.get('carbs', '?')
                f = item.get('fat', '?')
                cal = item.get('calories', 0)
                eff = round(p / cal * 100, 1) if cal > 0 else 0
                station = item.get('station', '')
                menu_lines.append(f"    - {item['name']} [{station}] — ${price:.2f} — P:{p}g C:{c}g F:{f}g {cal}cal (eff:{eff}) [{tags}]")

    menu_context = "\n".join(menu_lines)
    system = DINING_SYSTEM_PROMPT.format(menu_context=menu_context)
    conversation = _format_conversation(req.messages)

    if req.model == "gemini":
        return StreamingResponse(_stream_gemini(system, conversation, req.gemini_api_key), media_type="text/event-stream")
    return StreamingResponse(_stream_claude(system, conversation, req.model), media_type="text/event-stream")


# ── Transit Tracker ──────────────────────────────────────────────────────────

import csv
import io
import math
import zipfile
from datetime import date as _date, datetime as _datetime

_transit_cache: dict = {"data": None, "ts": 0, "loading": False}
TRANSIT_TTL = 604800  # 7 days
TRANSIT_GTFS_URL = "http://www.sdmts.com/google_transit_files/google_transit.zip"
TRANSIT_GTFS_DIR = Path("/tmp/mts_gtfs")
TRANSIT_GTFS_ZIP = Path("/tmp/mts_gtfs_cache/google_transit.zip")

UCSD_CENTER = (32.8801, -117.2340)
UCSD_RADIUS_MILES = 2.0
UCSD_ROUTE_IDS = {"201", "202", "204", "237", "41", "105", "510", "3", "985"}


def _haversine_miles(lat1, lon1, lat2, lon2):
    R = 3959
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _download_gtfs():
    """Download GTFS zip if missing or stale."""
    import requests as req_lib
    TRANSIT_GTFS_ZIP.parent.mkdir(parents=True, exist_ok=True)
    if TRANSIT_GTFS_ZIP.exists():
        age = time.time() - TRANSIT_GTFS_ZIP.stat().st_mtime
        if age < TRANSIT_TTL:
            return True  # Fresh enough
    try:
        logger.info("Downloading MTS GTFS data...")
        resp = req_lib.get(TRANSIT_GTFS_URL, timeout=30)
        resp.raise_for_status()
        TRANSIT_GTFS_ZIP.write_bytes(resp.content)
        # Extract
        TRANSIT_GTFS_DIR.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(TRANSIT_GTFS_ZIP) as zf:
            zf.extractall(TRANSIT_GTFS_DIR)
        logger.info("GTFS downloaded and extracted (%d bytes)", len(resp.content))
        return True
    except Exception as e:
        logger.warning("GTFS download failed: %s — using cached files", e)
        return TRANSIT_GTFS_DIR.exists()


def _read_csv(filename: str) -> list[dict]:
    fp = TRANSIT_GTFS_DIR / filename
    if not fp.exists():
        return []
    with open(fp, "r", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def _parse_gtfs_time(t: str) -> int:
    """Parse '05:50:00' or '25:30:00' into seconds since midnight."""
    parts = t.strip().split(":")
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])


def _is_service_active(service_id: str, check_date: _date, services: dict, exceptions: dict) -> bool:
    svc = services.get(service_id)
    if not svc:
        return False
    try:
        start = _datetime.strptime(svc["start"], "%Y%m%d").date()
        end = _datetime.strptime(svc["end"], "%Y%m%d").date()
    except (ValueError, KeyError):
        return False
    if not (start <= check_date <= end):
        return False
    date_str = check_date.strftime("%Y%m%d")
    exc = exceptions.get(service_id, {}).get(date_str)
    if exc == 2:
        return False
    if exc == 1:
        return True
    dow = check_date.weekday()  # 0=Mon..6=Sun
    return bool(svc["weekday"][dow])


def _load_gtfs_data() -> dict | None:
    """Parse GTFS into in-memory structures filtered for UCSD."""
    if not _download_gtfs():
        return None

    # 1. Routes
    routes = {}
    for row in _read_csv("routes.txt"):
        rid = row.get("route_id", "")
        if rid not in UCSD_ROUTE_IDS:
            continue
        routes[rid] = {
            "route_id": rid,
            "short_name": row.get("route_short_name", rid),
            "long_name": row.get("route_long_name", ""),
            "color": row.get("route_color", "999999"),
            "text_color": row.get("route_text_color", "FFFFFF"),
            "type": int(row.get("route_type", "3")),
        }
    logger.info("GTFS: %d routes", len(routes))

    # 2. Calendar (services)
    services = {}
    dow_keys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for row in _read_csv("calendar.txt"):
        sid = row.get("service_id", "")
        services[sid] = {
            "weekday": [int(row.get(d, "0")) for d in dow_keys],
            "start": row.get("start_date", ""),
            "end": row.get("end_date", ""),
        }

    # 3. Calendar exceptions
    exceptions: dict[str, dict] = {}
    for row in _read_csv("calendar_dates.txt"):
        sid = row.get("service_id", "")
        if sid not in exceptions:
            exceptions[sid] = {}
        exceptions[sid][row.get("date", "")] = int(row.get("exception_type", "0"))

    # 4. Trips (filtered to UCSD routes)
    trips = {}
    for row in _read_csv("trips.txt"):
        rid = row.get("route_id", "")
        if rid not in UCSD_ROUTE_IDS:
            continue
        tid = row.get("trip_id", "")
        trips[tid] = {
            "route_id": rid,
            "service_id": row.get("service_id", ""),
            "headsign": row.get("trip_headsign", ""),
            "direction": row.get("direction_id", "0"),
        }
    logger.info("GTFS: %d trips for UCSD routes", len(trips))

    # 5. Stops (filtered by radius)
    all_stops_raw = _read_csv("stops.txt")
    stops = {}
    stop_ids_set = set()
    for row in all_stops_raw:
        sid = row.get("stop_id", "")
        try:
            lat = float(row.get("stop_lat", "0"))
            lon = float(row.get("stop_lon", "0"))
        except ValueError:
            continue
        if lat == 0 or lon == 0:
            continue
        loc_type = row.get("location_type", "0")
        if loc_type == "1":
            # Station parent — keep for display but also keep child stops
            pass
        dist = _haversine_miles(UCSD_CENTER[0], UCSD_CENTER[1], lat, lon)
        if dist <= UCSD_RADIUS_MILES:
            stop_ids_set.add(sid)
            stops[sid] = {
                "stop_id": sid,
                "name": row.get("stop_name", sid),
                "lat": lat,
                "lon": lon,
                "routes": [],
                "parent": row.get("parent_station", ""),
            }
    logger.info("GTFS: %d stops within %.1f miles of UCSD", len(stops), UCSD_RADIUS_MILES)

    # 6. Stop times (the big file — stream and filter)
    stop_times: dict[str, list] = {}
    trip_stop_order: dict[str, dict[str, list]] = {}  # route_id -> {trip_id -> [stops]}
    trip_ids_set = set(trips.keys())

    st_file = TRANSIT_GTFS_DIR / "stop_times.txt"
    if st_file.exists():
        with open(st_file, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                tid = row.get("trip_id", "")
                sid = row.get("stop_id", "")
                if tid not in trip_ids_set or sid not in stop_ids_set:
                    continue
                trip_info = trips[tid]
                arr = row.get("arrival_time", "").strip()
                if not arr:
                    continue
                entry = {
                    "trip_id": tid,
                    "route_id": trip_info["route_id"],
                    "service_id": trip_info["service_id"],
                    "arrival": arr,
                    "arrival_sec": _parse_gtfs_time(arr),
                    "headsign": trip_info["headsign"],
                    "sequence": int(row.get("stop_sequence", "0")),
                }
                if sid not in stop_times:
                    stop_times[sid] = []
                stop_times[sid].append(entry)

                # Track stop order per trip for route view
                rid = trip_info["route_id"]
                if rid not in trip_stop_order:
                    trip_stop_order[rid] = {}
                if tid not in trip_stop_order[rid]:
                    trip_stop_order[rid][tid] = []
                trip_stop_order[rid][tid].append({
                    "stop_id": sid,
                    "arrival": arr,
                    "sequence": entry["sequence"],
                })
                count += 1
        logger.info("GTFS: %d stop_time entries kept", count)

    # Sort stop_times by arrival
    for sid in stop_times:
        stop_times[sid].sort(key=lambda e: e["arrival_sec"])

    # Sort trip stops by sequence
    for rid in trip_stop_order:
        for tid in trip_stop_order[rid]:
            trip_stop_order[rid][tid].sort(key=lambda s: s["sequence"])

    # Compute which routes serve each stop
    for sid, entries in stop_times.items():
        route_set = set(e["route_id"] for e in entries)
        if sid in stops:
            stops[sid]["routes"] = sorted(route_set)

    # Pick representative trip per route (longest stop list) for route view
    route_stop_lists: dict[str, list] = {}
    for rid, trip_dict in trip_stop_order.items():
        best_trip = max(trip_dict.values(), key=len, default=[])
        route_stop_lists[rid] = best_trip

    return {
        "routes": routes,
        "stops": stops,
        "services": services,
        "exceptions": exceptions,
        "stop_times": stop_times,
        "route_stop_lists": route_stop_lists,
        "trip_stop_order": trip_stop_order,
    }


def _refresh_transit_cache():
    now = time.time()
    if _transit_cache["data"] and (now - _transit_cache["ts"]) < TRANSIT_TTL:
        return
    if _transit_cache["loading"]:
        return
    _transit_cache["loading"] = True
    try:
        logger.info("Loading GTFS transit data...")
        data = _load_gtfs_data()
        if data:
            _transit_cache["data"] = data
            _transit_cache["ts"] = time.time()
            logger.info("Transit cache loaded: %d routes, %d stops",
                        len(data["routes"]), len(data["stops"]))
    finally:
        _transit_cache["loading"] = False


def _transit_refresh_loop():
    time.sleep(5)
    while True:
        try:
            _refresh_transit_cache()
        except Exception as e:
            logger.error("Transit refresh error: %s", e)
        time.sleep(TRANSIT_TTL)


_transit_thread = threading.Thread(target=_transit_refresh_loop, daemon=True)
_transit_thread.start()


# ── Transit API Endpoints ───────────────────────────────────────────────────

@app.get("/api/transit/routes")
def transit_routes():
    if not _transit_cache["data"]:
        _refresh_transit_cache()
    data = _transit_cache["data"]
    if not data:
        return {"routes": [], "error": "Transit data not loaded"}
    routes = list(data["routes"].values())
    # Super Loops first, then buses, then trolley
    routes.sort(key=lambda r: (
        0 if r["route_id"] in ("201", "202", "204") else 1 if r["type"] == 3 else 2,
        r["route_id"],
    ))
    return {"routes": routes}


@app.get("/api/transit/stops")
def transit_stops():
    if not _transit_cache["data"]:
        _refresh_transit_cache()
    data = _transit_cache["data"]
    if not data:
        return {"stops": [], "error": "Transit data not loaded"}
    stops = []
    seen_names = set()
    for sid, info in data["stops"].items():
        if not info["routes"]:
            continue
        # Deduplicate by name (many stops have 2 IDs for opposite directions)
        if info["name"] in seen_names:
            continue
        seen_names.add(info["name"])
        stops.append({
            "stop_id": sid,
            "name": info["name"],
            "lat": info["lat"],
            "lon": info["lon"],
            "routes": info["routes"],
        })
    stops.sort(key=lambda s: s["name"])
    return {"stops": stops}


@app.get("/api/transit/departures")
def transit_departures(stop_id: str = Query(...), limit: int = Query(default=25)):
    if not _transit_cache["data"]:
        _refresh_transit_cache()
    data = _transit_cache["data"]
    if not data:
        return {"departures": [], "error": "Transit data not loaded"}

    now = _datetime.now()
    today = now.date()
    current_sec = now.hour * 3600 + now.minute * 60 + now.second

    # Also check stops with same name (bidirectional stops)
    target_name = data["stops"].get(stop_id, {}).get("name", "")
    check_stop_ids = [stop_id]
    if target_name:
        for sid, info in data["stops"].items():
            if sid != stop_id and info["name"] == target_name:
                check_stop_ids.append(sid)

    departures = []
    seen = set()

    for sid in check_stop_ids:
        for entry in data["stop_times"].get(sid, []):
            if entry["arrival_sec"] < current_sec:
                continue
            if not _is_service_active(entry["service_id"], today, data["services"], data["exceptions"]):
                continue
            # Deduplicate same route+time
            dedup = f"{entry['route_id']}:{entry['arrival']}"
            if dedup in seen:
                continue
            seen.add(dedup)

            route = data["routes"].get(entry["route_id"], {})
            mins = (entry["arrival_sec"] - current_sec) // 60
            departures.append({
                "route_id": entry["route_id"],
                "route_name": route.get("short_name", entry["route_id"]),
                "route_color": route.get("color", "999999"),
                "route_type": route.get("type", 3),
                "headsign": entry["headsign"],
                "scheduled_time": entry["arrival"][:5],
                "minutes_away": mins,
                "is_late_night": entry["arrival_sec"] >= 79200,
            })

    departures.sort(key=lambda d: d["minutes_away"])
    return {
        "departures": departures[:limit],
        "stop_name": target_name or stop_id,
        "current_time": now.strftime("%H:%M"),
    }


@app.get("/api/transit/route/{route_id}/stops")
def transit_route_stops(route_id: str):
    if not _transit_cache["data"]:
        _refresh_transit_cache()
    data = _transit_cache["data"]
    if not data:
        return {"stops": [], "error": "Transit data not loaded"}

    now = _datetime.now()
    today = now.date()
    current_sec = now.hour * 3600 + now.minute * 60 + now.second

    ordered = data["route_stop_lists"].get(route_id, [])
    result = []

    for stop_entry in ordered:
        sid = stop_entry["stop_id"]
        stop_info = data["stops"].get(sid, {})
        # Find next departure for this route at this stop
        next_dep = None
        for entry in data["stop_times"].get(sid, []):
            if entry["route_id"] != route_id:
                continue
            if entry["arrival_sec"] < current_sec:
                continue
            if not _is_service_active(entry["service_id"], today, data["services"], data["exceptions"]):
                continue
            mins = (entry["arrival_sec"] - current_sec) // 60
            next_dep = {"time": entry["arrival"][:5], "minutes": mins}
            break

        result.append({
            "stop_id": sid,
            "name": stop_info.get("name", sid),
            "lat": stop_info.get("lat"),
            "lon": stop_info.get("lon"),
            "sequence": stop_entry["sequence"],
            "next_departure": next_dep,
        })

    route_info = data["routes"].get(route_id, {})
    return {
        "route": route_info,
        "stops": result,
    }


# ── Transit Directions / Trip Planner ────────────────────────────────────────

import math as _math

def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = _math.radians(lat2 - lat1)
    dLon = _math.radians(lon2 - lon1)
    a = _math.sin(dLat/2)**2 + _math.cos(_math.radians(lat1)) * _math.cos(_math.radians(lat2)) * _math.sin(dLon/2)**2
    return R * 2 * _math.atan2(_math.sqrt(a), _math.sqrt(1 - a))

def _walk_minutes(km):
    return max(1, int(_math.ceil(km / 0.083)))  # ~5 km/h

@app.get("/api/transit/directions")
def transit_directions(
    orig_lat: float = Query(32.8801),
    orig_lon: float = Query(-117.2340),
    dest_lat: float = Query(...),
    dest_lon: float = Query(...),
):
    """Find top 3 transit route options from origin to destination."""
    if not _transit_cache["data"]:
        _refresh_transit_cache()
    data = _transit_cache["data"]
    if not data:
        return {"options": [], "error": "Transit data not loaded"}

    now = _datetime.now()
    today = now.date()
    current_sec = now.hour * 3600 + now.minute * 60 + now.second

    all_stops = data["stops"]  # {stop_id: {name, lat, lon, ...}}
    stop_list = [(sid, s) for sid, s in all_stops.items() if s.get("lat") and s.get("lon")]

    # Find stops near origin (within 2 km) and destination (within 2 km)
    orig_nearby = []
    for sid, s in stop_list:
        d = _haversine(orig_lat, orig_lon, s["lat"], s["lon"])
        if d < 4.0:
            orig_nearby.append((sid, s, d))
    orig_nearby.sort(key=lambda x: x[2])

    dest_nearby = []
    for sid, s in stop_list:
        d = _haversine(dest_lat, dest_lon, s["lat"], s["lon"])
        if d < 8.0:  # 8 km radius — covers most of San Diego from any transit stop
            dest_nearby.append((sid, s, d))
    dest_nearby.sort(key=lambda x: x[2])

    if not orig_nearby:
        return {"options": [], "error": "No transit stops found near origin"}
    # dest_nearby may be empty for far destinations — that's OK, we'll estimate

    # For each route, build stop sequence with times
    route_stop_times = {}  # route_id -> [(stop_id, arrival_sec), ...]
    for sid, entries in data["stop_times"].items():
        for entry in entries:
            rid = entry["route_id"]
            svc = entry["service_id"]
            if entry["arrival_sec"] < current_sec:
                continue
            if not _is_service_active(svc, today, data["services"], data["exceptions"]):
                continue
            if rid not in route_stop_times:
                route_stop_times[rid] = []
            route_stop_times[rid].append((sid, entry["arrival_sec"], entry.get("trip_id", "")))

    # Group by trip_id to get ordered stop sequences per trip
    trip_stops = {}  # trip_id -> [(stop_id, arrival_sec)]
    for rid, entries in route_stop_times.items():
        for sid, arr_sec, trip_id in entries:
            key = f"{rid}:{trip_id}"
            if key not in trip_stops:
                trip_stops[key] = {"route_id": rid, "stops": []}
            trip_stops[key]["stops"].append((sid, arr_sec))

    # Sort each trip's stops by arrival time
    for key in trip_stops:
        trip_stops[key]["stops"].sort(key=lambda x: x[1])

    # Find route options: for each trip, check if it connects an origin stop to a dest stop
    options = []
    seen = set()  # avoid duplicate route suggestions

    for key, trip_data in trip_stops.items():
        rid = trip_data["route_id"]
        trip_stop_list = trip_data["stops"]
        trip_stop_ids = [s[0] for s in trip_stop_list]

        # Check if any origin stop and dest stop are on this trip (in order)
        for o_sid, o_info, o_dist in orig_nearby[:15]:
            if o_sid not in trip_stop_ids:
                continue
            o_idx = trip_stop_ids.index(o_sid)
            o_arr = trip_stop_list[o_idx][1]

            for d_sid, d_info, d_dist in dest_nearby[:15]:
                if d_sid not in trip_stop_ids:
                    continue
                d_idx = trip_stop_ids.index(d_sid)
                if d_idx <= o_idx:
                    continue  # must board before alighting

                d_arr = trip_stop_list[d_idx][1]
                ride_min = max(1, (d_arr - o_arr) // 60)

                walk_to = _walk_minutes(o_dist)
                wait_min = max(0, (o_arr - current_sec) // 60 - walk_to)
                walk_from = _walk_minutes(d_dist)
                total = walk_to + wait_min + ride_min + walk_from

                dedup_key = f"{rid}:{o_sid}:{d_sid}"
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                route_info = data["routes"].get(rid, {})
                o_time = f"{o_arr // 3600:02d}:{(o_arr % 3600) // 60:02d}"
                d_time = f"{d_arr // 3600:02d}:{(d_arr % 3600) // 60:02d}"

                options.append({
                    "type": "transit",
                    "total_minutes": total,
                    "route_id": rid,
                    "route_name": route_info.get("short_name", rid),
                    "route_long_name": route_info.get("long_name", ""),
                    "route_color": route_info.get("color", "999"),
                    "route_type": route_info.get("type", 3),
                    "board_stop": o_info["name"],
                    "board_stop_id": o_sid,
                    "board_lat": o_info["lat"],
                    "board_lon": o_info["lon"],
                    "board_time": o_time,
                    "alight_stop": d_info["name"],
                    "alight_stop_id": d_sid,
                    "alight_lat": d_info["lat"],
                    "alight_lon": d_info["lon"],
                    "alight_time": d_time,
                    "steps": [
                        {"mode": "walk", "description": f"Walk to {o_info['name']}", "minutes": walk_to},
                        {"mode": "wait", "description": f"Wait for {route_info.get('short_name', rid)}", "minutes": wait_min, "departs": o_time},
                        {"mode": "ride", "description": f"Ride {route_info.get('short_name', rid)} to {d_info['name']}", "minutes": ride_min, "stops": d_idx - o_idx},
                        {"mode": "walk", "description": f"Walk to destination", "minutes": walk_from},
                    ],
                })

    # Sort by total time, take top 3
    options.sort(key=lambda x: x["total_minutes"])

    walk_km = _haversine(orig_lat, orig_lon, dest_lat, dest_lon)
    walk_opt = {
        "type": "walk_only",
        "total_minutes": _walk_minutes(walk_km),
        "steps": [{"mode": "walk", "description": f"Walk {walk_km:.1f} km to destination", "minutes": _walk_minutes(walk_km)}],
    }

    result = options[:3]

    # If no exact transit match, estimate routes based on distance
    if len(result) == 0 and walk_km > 1:
        for rid, route_info in data["routes"].items():
            avg_speed = 0.58 if route_info.get("type") == 0 else 0.42  # km/min (trolley faster)
            for o_sid, o_info, o_dist in orig_nearby[:20]:
                st_entries = data["stop_times"].get(o_sid, [])
                has_route = any(
                    e["route_id"] == rid for e in st_entries
                    if isinstance(e, dict) and e.get("arrival_sec", 0) >= current_sec
                )
                if not has_route:
                    continue

                walk_to = _walk_minutes(o_dist)
                ride_min = max(5, int(walk_km / avg_speed))
                next_dep_time = ""
                wait_min = 5
                for e in st_entries:
                    if isinstance(e, dict) and e["route_id"] == rid and e["arrival_sec"] >= current_sec:
                        if _is_service_active(e["service_id"], today, data["services"], data["exceptions"]):
                            next_dep_time = e["arrival"][:5]
                            wait_min = max(0, (e["arrival_sec"] - current_sec) // 60 - walk_to)
                            break

                total = walk_to + wait_min + ride_min + 5
                result.append({
                    "type": "transit",
                    "total_minutes": total,
                    "route_id": rid,
                    "route_name": route_info.get("short_name", rid),
                    "route_long_name": route_info.get("long_name", ""),
                    "route_color": route_info.get("color", "999"),
                    "route_type": route_info.get("type", 3),
                    "board_stop": o_info["name"],
                    "board_stop_id": o_sid,
                    "board_lat": o_info["lat"],
                    "board_lon": o_info["lon"],
                    "board_time": next_dep_time,
                    "alight_stop": "Near destination",
                    "alight_stop_id": "",
                    "alight_lat": dest_lat,
                    "alight_lon": dest_lon,
                    "alight_time": "",
                    "estimated": True,
                    "steps": [
                        {"mode": "walk", "description": f"Walk to {o_info['name']}", "minutes": walk_to},
                        {"mode": "wait", "description": f"Wait for {route_info.get('short_name', rid)}", "minutes": wait_min, "departs": next_dep_time},
                        {"mode": "ride", "description": f"Ride {route_info.get('short_name', rid)} ({route_info.get('long_name', '')})", "minutes": ride_min},
                        {"mode": "walk", "description": "Walk to destination", "minutes": 5},
                    ],
                })
                break
        result.sort(key=lambda x: x["total_minutes"])
        result = result[:3]

    if len(result) < 3:
        result.append(walk_opt)

    # Enrich every option with timing context
    now_str = f"{now.hour:02d}:{now.minute:02d}"
    for opt in result:
        if opt["type"] == "walk_only":
            opt["leave_by"] = now_str
            arr_sec = current_sec + opt["total_minutes"] * 60
            opt["arrive_by"] = f"{arr_sec // 3600 % 24:02d}:{(arr_sec % 3600) // 60:02d}"
            opt["on_time"] = True
            continue

        walk_step = opt["steps"][0] if opt["steps"] else None
        wait_step = opt["steps"][1] if len(opt["steps"]) > 1 else None
        walk_min = walk_step["minutes"] if walk_step else 0
        departs = wait_step.get("departs", "") if wait_step else ""

        # When to leave: departure time minus walk time
        if departs:
            dh, dm = map(int, departs.split(":"))
            dep_sec = dh * 3600 + dm * 60
            leave_sec = max(current_sec, dep_sec - walk_min * 60)
            opt["leave_by"] = f"{leave_sec // 3600 % 24:02d}:{(leave_sec % 3600) // 60:02d}"
            # Can you make it? Leave_sec must be >= current_sec
            opt["on_time"] = leave_sec >= current_sec
            # If you can't make this departure, flag it
            if leave_sec < current_sec:
                opt["timing_note"] = "Hurry! Leave now"
            elif leave_sec - current_sec < 120:
                opt["timing_note"] = "Leave now"
            else:
                mins_until = (leave_sec - current_sec) // 60
                opt["timing_note"] = f"Leave in {mins_until} min"
        else:
            opt["leave_by"] = now_str
            opt["timing_note"] = "Leave now"
            opt["on_time"] = True

        arr_sec = current_sec + opt["total_minutes"] * 60
        opt["arrive_by"] = f"{arr_sec // 3600 % 24:02d}:{(arr_sec % 3600) // 60:02d}"

    return {"options": result, "current_time": now_str}


# ── Internship Finder ────────────────────────────────────────────────────────

_internship_cache: dict = {}  # keyed by field, {"data": [...], "ts": 0}
INTERNSHIP_TTL = 3600  # 1 hour cache per field

INTERNSHIP_FIELDS = {
    "cs": {"label": "Computer Science", "keywords": "software+engineer+intern OR computer+science+intern OR SWE+intern"},
    "data": {"label": "Data Science & AI", "keywords": "data+science+intern OR machine+learning+intern OR AI+intern"},
    "cybersecurity": {"label": "Cybersecurity", "keywords": "cybersecurity+intern OR security+analyst+intern OR information+security+intern"},
    "engineering": {"label": "Engineering", "keywords": "engineering+intern OR mechanical+engineer+intern OR electrical+engineer+intern"},
    "aerospace": {"label": "Aerospace & Defense", "keywords": "aerospace+intern OR defense+intern OR spacecraft+intern OR aviation+intern"},
    "business": {"label": "Business & Finance", "keywords": "business+intern OR finance+intern OR accounting+intern OR consulting+intern"},
    "product": {"label": "Product Management", "keywords": "product+management+intern OR product+manager+intern OR APM+intern"},
    "biology": {"label": "Biology & Biotech", "keywords": "biology+intern OR biotech+intern OR pharmaceutical+intern OR research+intern+biology"},
    "chemistry": {"label": "Chemistry", "keywords": "chemistry+intern OR chemical+engineering+intern OR materials+science+intern"},
    "healthcare": {"label": "Healthcare & Medicine", "keywords": "healthcare+intern OR medical+intern OR clinical+research+intern OR public+health+intern"},
    "design": {"label": "Design & UX", "keywords": "UX+design+intern OR graphic+design+intern OR product+design+intern OR UI+intern"},
    "marketing": {"label": "Marketing & Media", "keywords": "marketing+intern OR social+media+intern OR content+intern OR communications+intern"},
    "film": {"label": "Film & Entertainment", "keywords": "film+intern OR entertainment+intern OR media+production+intern OR video+intern"},
    "law": {"label": "Law & Legal", "keywords": "legal+intern OR law+intern OR paralegal+intern OR compliance+intern"},
    "environmental": {"label": "Environmental Science", "keywords": "environmental+intern OR sustainability+intern OR climate+intern OR ecology+intern"},
    "math": {"label": "Mathematics & Stats", "keywords": "mathematics+intern OR statistics+intern OR quantitative+analyst+intern OR actuary+intern"},
    "economics": {"label": "Economics", "keywords": "economics+intern OR economic+research+intern OR policy+analyst+intern"},
    "psychology": {"label": "Psychology", "keywords": "psychology+intern OR behavioral+research+intern OR cognitive+science+intern"},
    "education": {"label": "Education", "keywords": "education+intern OR teaching+intern OR curriculum+intern OR tutoring+intern"},
    "research": {"label": "Research", "keywords": "research+intern OR lab+intern OR research+assistant"},
    "government": {"label": "Government & Nonprofit", "keywords": "government+intern OR policy+intern OR public+affairs+intern OR nonprofit+intern"},
    "sports": {"label": "Sports & Athletics", "keywords": "sports+intern OR athletic+intern OR sports+management+intern OR fitness+intern"},
    "realestate": {"label": "Real Estate", "keywords": "real+estate+intern OR property+management+intern OR real+estate+analyst+intern"},
    "supply": {"label": "Supply Chain & Ops", "keywords": "supply+chain+intern OR operations+intern OR logistics+intern OR procurement+intern"},
    "physics": {"label": "Physics", "keywords": "physics+intern OR astrophysics+intern OR optics+intern OR quantum+intern OR physics+research"},
}


# ── Advising / Counselor Meetings ────────────────────────────────────────────

UCSD_ADVISING_OFFICES = [
    {
        "id": "revelle",
        "college": "Revelle",
        "office": "Galbraith Hall, Suite 350",
        "email": "readvising@ucsd.edu",
        "phone": "(858) 534-3492",
        "vac_url": "https://vac.ucsd.edu",
        "appointment_url": "https://ucsd.co1.qualtrics.com/jfe/form/SV_ezzjYHIsaXTnG3I",
        "website": "https://revelle.ucsd.edu/academics/",
        "hours": "Mon-Fri 8am-4:30pm",
        "drop_in": "Mon-Fri 10am-12pm, 1pm-3pm",
    },
    {
        "id": "muir",
        "college": "Muir",
        "office": "H&SS 2126",
        "email": "muiradvising@ucsd.edu",
        "phone": "(858) 534-3580",
        "vac_url": "https://vac.ucsd.edu",
        "appointment_url": "https://vac.ucsd.edu",
        "website": "https://muir.ucsd.edu/academics/",
        "hours": "Mon-Fri 8am-4:30pm",
        "drop_in": "Mon-Fri 9am-12pm, 1pm-4pm",
    },
    {
        "id": "marshall",
        "college": "Marshall",
        "office": "Administration Building",
        "email": "tmcadvising@ucsd.edu",
        "phone": "(858) 534-4390",
        "vac_url": "https://vac.ucsd.edu",
        "appointment_url": "https://vac.ucsd.edu",
        "website": "https://marshall.ucsd.edu/academics/",
        "hours": "Mon-Fri 8am-4:30pm",
        "drop_in": "Mon-Fri 10am-12pm, 1pm-3pm",
    },
    {
        "id": "warren",
        "college": "Warren",
        "office": "Bear Hall (formerly ERC Admin)",
        "email": "warrenadvising@ucsd.edu",
        "phone": "(858) 534-4731",
        "vac_url": "https://vac.ucsd.edu",
        "appointment_url": "https://vac.ucsd.edu",
        "website": "https://warren.ucsd.edu/academics/",
        "hours": "Mon-Fri 8am-4:30pm",
        "drop_in": "Mon-Thu 10am-12pm, 1pm-3pm",
    },
    {
        "id": "erc",
        "college": "ERC (Eleanor Roosevelt)",
        "office": "ERC Admin Building",
        "email": "ercadvising@ucsd.edu",
        "phone": "(858) 534-2237",
        "vac_url": "https://vac.ucsd.edu",
        "appointment_url": "https://vac.ucsd.edu",
        "website": "https://roosevelt.ucsd.edu/academics/",
        "hours": "Mon-Fri 8am-4:30pm",
        "drop_in": "Mon-Fri 9am-12pm, 1pm-3pm",
    },
    {
        "id": "sixth",
        "college": "Sixth",
        "office": "Pepper Canyon Hall, Suite 200",
        "email": "sixthadvising@ucsd.edu",
        "phone": "(858) 534-9001",
        "vac_url": "https://vac.ucsd.edu",
        "appointment_url": "https://vac.ucsd.edu",
        "website": "https://sixth.ucsd.edu/academics/",
        "hours": "Mon-Fri 8am-4:30pm",
        "drop_in": "Mon-Fri 10am-12pm, 1pm-3pm",
    },
    {
        "id": "seventh",
        "college": "Seventh",
        "office": "Pepper Canyon Hall, Suite 100",
        "email": "seventhadvising@ucsd.edu",
        "phone": "(858) 534-7517",
        "vac_url": "https://vac.ucsd.edu",
        "appointment_url": "https://vac.ucsd.edu",
        "website": "https://seventh.ucsd.edu/academics/",
        "hours": "Mon-Fri 8am-4:30pm",
        "drop_in": "Mon-Thu 10am-12pm, 1pm-3pm",
    },
    {
        "id": "eighth",
        "college": "Eighth",
        "office": "Eighth College Admin",
        "email": "eighthadvising@ucsd.edu",
        "phone": "(858) 246-1802",
        "vac_url": "https://vac.ucsd.edu",
        "appointment_url": "https://vac.ucsd.edu",
        "website": "https://eighth.ucsd.edu/academics/",
        "hours": "Mon-Fri 8am-4:30pm",
        "drop_in": "Mon-Fri 10am-12pm, 1pm-3pm",
    },
]

UCSD_ADVISING_RESOURCES = [
    {"label": "Virtual Advising Center (VAC)", "url": "https://vac.ucsd.edu", "description": "Schedule appointments with your college advisor online"},
    {"label": "Degree Planner", "url": "https://degree-planner.ucsd.edu", "description": "Plan your courses and track degree requirements"},
    {"label": "Degree Audit", "url": "https://students.ucsd.edu/academics/advising/degrees-diplomas/degree-audit.html", "description": "Check your progress toward graduation"},
    {"label": "CAPS (Counseling & Psych Services)", "url": "https://caps.ucsd.edu", "description": "Mental health counseling and crisis support"},
    {"label": "Career Center", "url": "https://career.ucsd.edu", "description": "Career advising, resume help, interview prep"},
    {"label": "OASIS", "url": "https://oasis.ucsd.edu", "description": "Academic support for underrepresented students"},
    {"label": "Teaching + Learning Commons", "url": "https://commons.ucsd.edu", "description": "Tutoring, writing, and study skills support"},
    {"label": "Study Abroad", "url": "https://studyabroad.ucsd.edu", "description": "International study advising and programs"},
    {"label": "Financial Aid Advising", "url": "https://fas.ucsd.edu", "description": "Financial aid questions and appeals"},
    {"label": "Undergraduate Research Hub", "url": "https://ugresearch.ucsd.edu", "description": "Research opportunities and mentorship"},
]


ADVISING_CALENDARS = {
    "revelle": "revelleadvising@gmail.com",
    "muir": "muir.advising@gmail.com",
    "marshall": "tmcadvising@ucsd.edu",
    "erc": "ercadvising@ucsd.edu",
    "seventh": "seventhadvising@ucsd.edu",
}
_GCAL_PUBLIC_KEY = "AIzaSyBNlYH01_9Hc5S1J9vuFmu2nUqBZJNAXxs"
_advising_slots_cache: dict = {"data": None, "ts": 0}
_ADVISING_SLOTS_TTL = 600  # 10 min


def _fetch_advising_slots() -> dict:
    """Fetch upcoming advising slots from public Google Calendars."""
    import requests as req_lib
    from datetime import datetime as dt, timedelta as td
    import urllib.parse

    now_utc = dt.utcnow().strftime("%Y-%m-%dT00:00:00Z")
    end_utc = (dt.utcnow() + td(days=14)).strftime("%Y-%m-%dT23:59:59Z")

    all_slots: dict[str, list] = {}

    for college_id, cal_id in ADVISING_CALENDARS.items():
        encoded = urllib.parse.quote(cal_id)
        url = (
            f"https://www.googleapis.com/calendar/v3/calendars/{encoded}/events"
            f"?timeMin={now_utc}&timeMax={end_utc}&singleEvents=true&orderBy=startTime"
            f"&key={_GCAL_PUBLIC_KEY}"
        )
        try:
            resp = req_lib.get(url, timeout=10)
            if resp.status_code != 200:
                continue
            data = resp.json()
            slots = []
            for item in data.get("items", []):
                start_obj = item.get("start", {})
                end_obj = item.get("end", {})
                start = start_obj.get("dateTime", start_obj.get("date", ""))
                end_dt = end_obj.get("dateTime", end_obj.get("date", ""))
                summary = item.get("summary", "")
                location = item.get("location", "")

                # Skip week labels and non-appointment entries
                if not start or "T" not in start:
                    continue

                is_remote = "remote" in summary.lower() or "vac" in location.lower()
                is_inperson = "in person" in summary.lower() or "in-person" in summary.lower() or "office" in summary.lower()
                mode = "remote" if is_remote and not is_inperson else "in-person" if is_inperson and not is_remote else "both"

                slots.append({
                    "summary": summary,
                    "start": start,
                    "end": end_dt,
                    "location": location,
                    "mode": mode,
                })
            all_slots[college_id] = slots
        except Exception as e:
            logger.warning("Advising calendar fetch failed for %s: %s", college_id, e)

    return all_slots


@app.get("/api/advising/offices")
def advising_offices():
    """List all college advising offices."""
    return {"offices": UCSD_ADVISING_OFFICES, "resources": UCSD_ADVISING_RESOURCES}


@app.get("/api/advising/slots")
def advising_slots():
    """Fetch available advising drop-in/appointment slots from Google Calendars."""
    now = time.time()
    if _advising_slots_cache["data"] and (now - _advising_slots_cache["ts"]) < _ADVISING_SLOTS_TTL:
        return {"slots": _advising_slots_cache["data"]}

    slots = _fetch_advising_slots()
    _advising_slots_cache["data"] = slots
    _advising_slots_cache["ts"] = time.time()
    total = sum(len(v) for v in slots.values())
    return {"slots": slots, "total": total}


@app.get("/api/advising/events")
def advising_events():
    """Fetch advising-related campus events."""
    import requests as req_lib
    try:
        resp = req_lib.get(
            "https://calendar.ucsd.edu/api/2/events",
            params={"days": 30, "pp": 100},
            timeout=15,
        )
        if resp.status_code != 200:
            return {"events": []}

        data = resp.json()
        events = []
        advising_keywords = [
            "advising", "advisor", "counsel", "workshop", "career fair",
            "drop-in", "office hour", "peer coach", "mentor", "tutoring",
            "academic support", "writing", "resume", "interview", "grad school",
            "study abroad", "research", "internship", "scholarship", "financial aid",
            "caps", "let's talk", "stress", "wellness",
        ]
        for e in data.get("events", []):
            evt = e.get("event", {})
            title = evt.get("title", "")
            desc = evt.get("description_text", "")
            combined = (title + " " + desc).lower()
            if not any(kw in combined for kw in advising_keywords):
                continue

            instances = evt.get("event_instances", [])
            start = instances[0].get("event_instance", {}).get("start", "") if instances else ""
            end = instances[0].get("event_instance", {}).get("end", "") if instances else ""

            events.append({
                "id": evt.get("id", 0),
                "title": title,
                "description": (evt.get("description_text", "") or "")[:300],
                "start": start,
                "end": end,
                "location": evt.get("location", ""),
                "venue": evt.get("location_name", ""),
                "url": evt.get("localist_url", ""),
                "photo_url": evt.get("photo_url", ""),
            })

        events.sort(key=lambda e: e.get("start", ""))
        return {"events": events}
    except Exception as ex:
        logger.warning("Advising events fetch failed: %s", ex)
        return {"events": []}


# ── Parking Guide ────────────────────────────────────────────────────────────

UCSD_PARKING = {
    "structures": [
        {"id": "gilman", "name": "Gilman Parking Structure", "area": "West Campus", "permits": ["S", "B", "A", "V"], "floors": 6, "approx_spots": 1400, "lat": 32.8762, "lon": -117.2350, "nearby": ["Revelle", "Geisel Library", "Price Center"], "tips": "Closest structure to Geisel and Price Center. Fills fast by 9am on weekdays."},
        {"id": "hopkins", "name": "Hopkins Parking Structure", "area": "West Campus", "permits": ["S", "B", "A", "V"], "floors": 5, "approx_spots": 1100, "lat": 32.8740, "lon": -117.2380, "nearby": ["Muir", "Center Hall", "Cognitive Science Bldg"], "tips": "Good for Muir and Center Hall classes. Upper floors usually have spots."},
        {"id": "pangea", "name": "Pangea Parking Structure", "area": "East Campus", "permits": ["S", "B", "A"], "floors": 4, "approx_spots": 900, "lat": 32.8815, "lon": -117.2330, "nearby": ["Warren", "CSE Building", "EBU3B"], "tips": "Best for Warren/CSE/Engineering. Less crowded than west campus structures."},
        {"id": "osler", "name": "Osler Parking Structure", "area": "East Campus", "permits": ["S", "B", "A", "V"], "floors": 6, "approx_spots": 1600, "lat": 32.8850, "lon": -117.2290, "nearby": ["UCSD Medical Center", "Sixth College", "Rady School"], "tips": "Largest structure on campus. Good for Sixth College and Rady."},
        {"id": "north-campus", "name": "North Campus Parking", "area": "North Campus", "permits": ["S", "B", "A"], "floors": 3, "approx_spots": 600, "lat": 32.8880, "lon": -117.2380, "nearby": ["SIO", "Scripps", "North Torrey Pines"], "tips": "Near Scripps/SIO. Usually has availability all day."},
        {"id": "keeling", "name": "Keeling Apartments Structure", "area": "South Campus", "permits": ["SR", "S", "B"], "floors": 3, "approx_spots": 500, "lat": 32.8710, "lon": -117.2250, "nearby": ["Marshall", "Seventh College"], "tips": "Primarily for residents. Student spots available on upper floors."},
    ],
    "lots": [
        {"id": "P102", "name": "Lot P102", "area": "Revelle", "permits": ["S"], "approx_spots": 80, "nearby": ["Revelle College", "York Hall"], "tips": "Small lot, fills early. Walk to Revelle classes."},
        {"id": "P104", "name": "Lot P104", "area": "Muir", "permits": ["S", "B"], "approx_spots": 120, "nearby": ["Muir College", "Mandeville Center"], "tips": "Good for Muir/Mandeville area."},
        {"id": "P208", "name": "Lot P208", "area": "Warren", "permits": ["S"], "approx_spots": 100, "nearby": ["Warren College", "EBU1"], "tips": "Close to Warren Lecture Hall and engineering buildings."},
        {"id": "P304", "name": "Lot P304", "area": "ERC", "permits": ["S", "B"], "approx_spots": 150, "nearby": ["ERC", "Foodworx", "Otterson Hall"], "tips": "Convenient for ERC and Rady area."},
        {"id": "P382", "name": "Lot P382", "area": "Sixth", "permits": ["S"], "approx_spots": 90, "nearby": ["Sixth College", "Pepper Canyon Hall"], "tips": "Near Sixth College residential area."},
        {"id": "P386", "name": "Lot P386", "area": "East Campus", "permits": ["D", "S"], "approx_spots": 200, "nearby": ["East Campus", "Trolley Station"], "tips": "Discount lot near the trolley. Cheap option if you don't mind the shuttle."},
        {"id": "P704", "name": "Lot P704", "area": "East Campus Remote", "permits": ["D", "S"], "approx_spots": 400, "nearby": ["East Campus shuttle stop"], "tips": "Remote lot with free shuttle to main campus. Almost always has spots. $4/day SuperSaver."},
        {"id": "P705", "name": "Lot P705", "area": "East Campus Remote", "permits": ["D", "S"], "approx_spots": 350, "nearby": ["East Campus shuttle stop"], "tips": "Remote lot next to P704. Free shuttle. Best budget option."},
        {"id": "P707", "name": "Lot P707", "area": "East Campus Remote", "permits": ["D", "NW"], "approx_spots": 300, "nearby": ["East Campus shuttle stop"], "tips": "Night/Weekend lot. $1/day NW permit or free after 4pm."},
    ],
    "permit_info": [
        {"type": "S", "name": "Student", "daily": "$6.35", "quarterly": "~$445", "access": "S spaces in most lots and structures", "color": "#4f8ef7"},
        {"type": "B", "name": "Staff/Grad", "daily": "$6.35", "quarterly": "~$354/mo", "access": "B and S spaces", "color": "#3dd68c"},
        {"type": "A", "name": "Faculty/Admin", "daily": "$7.75", "quarterly": "~$399/mo", "access": "A, B, and S spaces", "color": "#f5c842"},
        {"type": "V", "name": "Visitor", "daily": "$4.50/hr or $36/day", "quarterly": "N/A", "access": "V spaces and pay stations", "color": "#7c5cfc"},
        {"type": "D", "name": "Discount", "daily": "$5.25", "quarterly": "N/A", "access": "D spaces in remote lots", "color": "#f25f5c"},
        {"type": "SR", "name": "Student Resident", "daily": "$5.27", "quarterly": "~$369", "access": "SR and S spaces", "color": "#4f8ef7"},
        {"type": "NW", "name": "Night/Weekend", "daily": "$1.00", "quarterly": "N/A", "access": "After 4pm weekdays, all day weekends", "color": "#3dd68c"},
    ],
    "tips": [
        "Arrive before 8:30am for guaranteed spots in west campus structures",
        "East Campus remote lots (P704, P705) always have spots + free shuttle",
        "After 4pm, NW permits ($1/day) work in most lots",
        "ParkMobile app lets you pay by phone — no permit needed for V/D spaces",
        "Gilman and Hopkins structures fill first. Pangea and Osler are better bets after 9am",
        "Free parking on campus after 11pm and before 7am",
        "Game days and events fill the west campus fast — plan ahead",
    ],
}


@app.get("/api/parking")
def parking_guide():
    """Return campus parking info."""
    return UCSD_PARKING


# ── Textbook Finder ──────────────────────────────────────────────────────────

# Known textbooks for popular UCSD courses (manually curated, expandable)
KNOWN_TEXTBOOKS: dict[str, list] = {
    "CSE 11": [{"title": "Introduction to Java Programming", "author": "Daniel Liang", "isbn": "9780136520238", "required": True}],
    "CSE 12": [{"title": "Data Structures and Algorithms in Java", "author": "Michael T. Goodrich", "isbn": "9781118771334", "required": True}],
    "CSE 15L": [],
    "CSE 20": [{"title": "Discrete Mathematics and Its Applications", "author": "Kenneth Rosen", "isbn": "9781259676512", "required": True}],
    "CSE 30": [{"title": "Computer Systems: A Programmer's Perspective", "author": "Randal Bryant, David O'Hallaron", "isbn": "9780134092669", "required": True}],
    "CSE 100": [{"title": "Introduction to Algorithms", "author": "Thomas Cormen et al.", "isbn": "9780262046305", "required": True}],
    "CSE 110": [{"title": "No textbook required", "author": "", "isbn": "", "required": False}],
    "CSE 140": [{"title": "Digital Design", "author": "Frank Vahid", "isbn": "9780470531082", "required": True}],
    "CSE 141": [{"title": "Computer Organization and Design RISC-V Edition", "author": "David Patterson, John Hennessy", "isbn": "9780128203316", "required": True}],
    "ECE 15": [{"title": "C Programming: A Modern Approach", "author": "K. N. King", "isbn": "9780393979503", "required": True}],
    "ECE 35": [{"title": "Engineering Circuit Analysis", "author": "William Hayt", "isbn": "9780078028229", "required": True}],
    "ECE 65": [{"title": "Microelectronic Circuits", "author": "Adel Sedra, Kenneth Smith", "isbn": "9780199339136", "required": True}],
    "ECE 100": [{"title": "Signals and Systems", "author": "Alan Oppenheim", "isbn": "9780138147570", "required": True}],
    "MATH 20A": [{"title": "Calculus: Early Transcendentals", "author": "James Stewart", "isbn": "9781337613927", "required": True}],
    "MATH 20B": [{"title": "Calculus: Early Transcendentals", "author": "James Stewart", "isbn": "9781337613927", "required": True}],
    "MATH 20C": [{"title": "Calculus: Early Transcendentals", "author": "James Stewart", "isbn": "9781337613927", "required": True}],
    "MATH 20D": [{"title": "Elementary Differential Equations", "author": "William Boyce", "isbn": "9781119777687", "required": True}],
    "MATH 18": [{"title": "Linear Algebra and Its Applications", "author": "David C. Lay", "isbn": "9780135851258", "required": True}],
    "MATH 109": [{"title": "An Introduction to Mathematical Reasoning", "author": "Peter Eccles", "isbn": "9780521597180", "required": True}],
    "PHYS 2A": [{"title": "Physics for Scientists and Engineers", "author": "Raymond Serway", "isbn": "9781337553278", "required": True}],
    "PHYS 2B": [{"title": "Physics for Scientists and Engineers", "author": "Raymond Serway", "isbn": "9781337553278", "required": True}],
    "PHYS 2C": [{"title": "Physics for Scientists and Engineers", "author": "Raymond Serway", "isbn": "9781337553278", "required": True}],
    "CHEM 6A": [{"title": "Chemistry: The Central Science", "author": "Theodore Brown", "isbn": "9780134414232", "required": True}],
    "CHEM 6B": [{"title": "Chemistry: The Central Science", "author": "Theodore Brown", "isbn": "9780134414232", "required": True}],
    "BILD 1": [{"title": "Campbell Biology", "author": "Lisa Urry et al.", "isbn": "9780135188743", "required": True}],
    "BILD 2": [{"title": "Campbell Biology", "author": "Lisa Urry et al.", "isbn": "9780135188743", "required": True}],
    "BILD 3": [{"title": "Campbell Biology", "author": "Lisa Urry et al.", "isbn": "9780135188743", "required": True}],
    "ECON 1": [{"title": "Principles of Economics", "author": "N. Gregory Mankiw", "isbn": "9780357038314", "required": True}],
    "ECON 100A": [{"title": "Intermediate Microeconomics", "author": "Hal Varian", "isbn": "9780393689860", "required": True}],
    "POLI 10": [{"title": "The Logic of American Politics", "author": "Samuel Kernell", "isbn": "9781544322995", "required": True}],
    "PSYC 1": [{"title": "Psychology", "author": "David Myers", "isbn": "9781319132101", "required": True}],
    "COGS 1": [{"title": "Mind: Introduction to Cognitive Science", "author": "Paul Thagard", "isbn": "9780262539609", "required": True}],
    "DSC 10": [{"title": "No textbook required (free online notes)", "author": "", "isbn": "", "required": False}],
    "DSC 20": [{"title": "No textbook required (free online notes)", "author": "", "isbn": "", "required": False}],
    "DSC 40A": [{"title": "No textbook required (free online notes)", "author": "", "isbn": "", "required": False}],
    "LIGN 101": [{"title": "Language Files", "author": "Ohio State University", "isbn": "9780814253540", "required": True}],
}


def _find_course_title(code: str) -> str | None:
    """Look up a course title from all_courses.json."""
    if not OUTPUT.exists():
        return None
    try:
        with open(OUTPUT, "r", encoding="utf-8") as f:
            courses = json.load(f)
        code_upper = code.upper().replace(" ", "")
        for c in courses:
            if c.get("course_code", "").upper().replace(" ", "") == code_upper:
                title = c.get("title", "")
                # Clean up title: remove session info, dates, parenthetical notes
                title = _re.sub(r"\s*(Sum Sess|Fall|Winter|Spring|Quarter|Session).*$", "", title, flags=_re.IGNORECASE)
                title = _re.sub(r"\s*\d{4}[-:]\s*\w+\s*\d+.*$", "", title)  # Remove date ranges
                title = _re.sub(r"\s*\([^)]*\)\s*$", "", title)  # Remove trailing parenthetical
                return title.strip()
    except Exception:
        pass
    return None


def _get_all_course_codes() -> list[dict]:
    """Get all course codes and titles from all_courses.json."""
    if not OUTPUT.exists():
        return []
    try:
        with open(OUTPUT, "r", encoding="utf-8") as f:
            courses = json.load(f)
        return [{"code": c["course_code"], "title": c.get("title", "")} for c in courses]
    except Exception:
        return []


def _search_open_library(query: str) -> list:
    """Search OpenLibrary for a book."""
    import requests as req_lib
    try:
        resp = req_lib.get("https://openlibrary.org/search.json", params={
            "q": query, "limit": 5,
        }, timeout=10)
        if resp.status_code != 200:
            return []
        data = resp.json()
        results = []
        for doc in data.get("docs", []):
            key = doc.get("key", "")
            ebook = doc.get("ebook_access", "no_ebook")
            results.append({
                "title": doc.get("title", ""),
                "author": ", ".join(doc.get("author_name", [])[:2]),
                "year": doc.get("first_publish_year", ""),
                "isbn": (doc.get("isbn", []) or [""])[0],
                "open_library_url": f"https://openlibrary.org{key}" if key else "",
                "borrowable": ebook in ("borrowable", "public"),
                "ebook_access": ebook,
            })
        return results
    except Exception:
        return []


def _generate_free_links(title: str, author: str, isbn: str) -> list:
    """Generate links to free/cheap sources for a textbook."""
    from urllib.parse import quote_plus
    links = []
    title_q = quote_plus(title)
    author_q = quote_plus(author.split(",")[0].strip())  # First author only
    full_q = quote_plus(f"{title} {author.split(',')[0].strip()}")
    isbn_q = isbn.replace("-", "").strip()

    # ── FREE PDF SOURCES ──

    # Anna's Archive — largest working shadow library aggregator (indexes LibGen, Z-Lib, Sci-Hub)
    if isbn_q:
        links.append({"source": "Anna's Archive", "url": f"https://annas-archive.org/search?q={isbn_q}", "type": "free_pdf", "note": "Largest free book search — searches LibGen, Z-Library, and more"})
    else:
        links.append({"source": "Anna's Archive", "url": f"https://annas-archive.org/search?q={title_q}", "type": "free_pdf", "note": "Largest free book search — searches LibGen, Z-Library, and more"})

    # Google PDF search — finds PDFs on university sites, course pages, etc.
    links.append({"source": "Google PDF Search", "url": f"https://www.google.com/search?q={full_q}+pdf+free+download", "type": "free_pdf", "note": "Finds free PDFs hosted on university and course sites"})

    # Library Genesis (multiple mirrors — .li is most stable as of 2025)
    if isbn_q:
        links.append({"source": "Library Genesis", "url": f"https://libgen.li/index.php?req={isbn_q}&columns%5B%5D=i&objects%5B%5D=f&objects%5B%5D=e&objects%5B%5D=s&objects%5B%5D=a&objects%5B%5D=p&objects%5B%5D=w&topics%5B%5D=l&res=25", "type": "free_pdf", "note": "Search by ISBN on LibGen mirror"})
    else:
        links.append({"source": "Library Genesis", "url": f"https://libgen.li/index.php?req={title_q}&columns%5B%5D=t&objects%5B%5D=f&objects%5B%5D=e&objects%5B%5D=s&objects%5B%5D=a&objects%5B%5D=p&objects%5B%5D=w&topics%5B%5D=l&res=25", "type": "free_pdf", "note": "Search by title on LibGen mirror"})

    # ── BORROW / LIBRARY ──

    # Open Library — free borrow via Internet Archive
    links.append({"source": "Open Library", "url": f"https://openlibrary.org/search?q={full_q}&mode=everything", "type": "borrow", "note": "Borrow free with Internet Archive account"})

    # UCSD Library — check for physical or digital copies
    if isbn_q:
        links.append({"source": "UCSD Library", "url": f"https://ucsd.primo.exlibrisgroup.com/discovery/search?query=isbn,exact,{isbn_q}&tab=everything&search_scope=everything&vid=01UCS_SDI:UCSD", "type": "library", "note": "Check UCSD library for physical or digital copy"})
    else:
        links.append({"source": "UCSD Library", "url": f"https://ucsd.primo.exlibrisgroup.com/discovery/search?query=any,contains,{title_q}&tab=everything&search_scope=everything&vid=01UCS_SDI:UCSD", "type": "library", "note": "Check UCSD library catalog"})

    # Reddit — students share free PDF links
    links.append({"source": "Reddit", "url": f"https://www.reddit.com/search/?q={title_q}+pdf&sort=relevance", "type": "free_pdf", "note": "Students often share free textbook links"})

    # ── PREVIEW ──

    # Google search for the book
    links.append({"source": "Google Search", "url": f"https://www.google.com/search?q={full_q}+textbook", "type": "preview", "note": "Google search for this textbook"})

    # ── BUY / RENT ──

    if isbn_q:
        links.append({"source": "Amazon", "url": f"https://www.amazon.com/s?k={isbn_q}", "type": "buy", "note": "New, used, and rental options"})
        links.append({"source": "Chegg", "url": f"https://www.chegg.com/textbooks/search/{isbn_q}", "type": "rental", "note": "Textbook rental from ~$15/mo"})
    else:
        links.append({"source": "Amazon", "url": f"https://www.amazon.com/s?k={title_q}", "type": "buy", "note": "New, used, and rental options"})

    # Google Shopping for price comparison (works for any book)
    links.append({"source": "Google Shopping", "url": f"https://www.google.com/search?tbm=shop&q={full_q}", "type": "buy", "note": "Compare prices across all stores"})

    return links


@app.get("/api/textbooks/search")
def textbook_search(course: str = Query(default=""), query: str = Query(default="")):
    """Search for textbooks by course code or title."""
    if course:
        # Normalize course code
        code = course.strip().upper()
        # Try exact match
        books = KNOWN_TEXTBOOKS.get(code, None)
        if books is None:
            # Try with/without space
            for k in KNOWN_TEXTBOOKS:
                if k.replace(" ", "") == code.replace(" ", ""):
                    books = KNOWN_TEXTBOOKS[k]
                    code = k
                    break

        if books is not None:
            results = []
            for book in books:
                if not book.get("isbn") and not book.get("required"):
                    results.append({**book, "free_links": [], "open_library": [], "no_textbook": True})
                    continue
                free_links = _generate_free_links(book["title"], book["author"], book.get("isbn", ""))
                ol_results = _search_open_library(f"{book['title']} {book['author']}")
                results.append({**book, "free_links": free_links, "open_library": ol_results, "no_textbook": False})
            return {"course": code, "books": results, "source": "known"}

        # Course not in curated list — auto-search using course title from all_courses.json
        course_title = _find_course_title(code)
        if course_title:
            # Search OpenLibrary with the course title as a textbook query
            search_q = f"{course_title} textbook"
            ol_results = _search_open_library(search_q)
            if not ol_results:
                # Try without "textbook" suffix
                ol_results = _search_open_library(course_title)
            auto_books = []
            for r in ol_results[:3]:  # Top 3 matches
                free_links = _generate_free_links(r["title"], r["author"], r.get("isbn", ""))
                auto_books.append({
                    "title": r["title"],
                    "author": r["author"],
                    "isbn": r.get("isbn", ""),
                    "required": False,
                    "free_links": free_links,
                    "open_library": [r],
                    "no_textbook": False,
                })
            if auto_books:
                return {"course": code, "books": auto_books, "source": "auto",
                        "course_title": course_title,
                        "message": f"Auto-matched textbooks for \"{course_title}\". These are best guesses — check your syllabus to confirm."}
            return {"course": code, "books": [], "source": "auto",
                    "course_title": course_title,
                    "message": f"No textbooks found for \"{course_title}\". This course may not require a textbook, or uses custom materials."}
        return {"course": code, "books": [], "source": "unknown", "message": f"Course {code} not found in current schedule data."}

    elif query:
        # Search by title/author
        ol_results = _search_open_library(query)
        books = []
        for r in ol_results:
            free_links = _generate_free_links(r["title"], r["author"], r.get("isbn", ""))
            books.append({
                "title": r["title"],
                "author": r["author"],
                "isbn": r.get("isbn", ""),
                "required": True,
                "free_links": free_links,
                "open_library": [r],
                "no_textbook": False,
            })
        return {"query": query, "books": books, "source": "search"}

    return {"books": [], "error": "Provide a course code or search query"}


@app.get("/api/textbooks/courses")
def textbook_courses():
    """List ALL courses — curated ones show textbook info, others show course title."""
    all_courses = _get_all_course_codes()
    curated_codes = set(KNOWN_TEXTBOOKS.keys())

    courses = []
    seen = set()

    # Add curated courses first (with textbook data)
    for code, books in KNOWN_TEXTBOOKS.items():
        has_books = any(b.get("isbn") for b in books)
        courses.append({
            "code": code,
            "title": "",
            "book_count": len(books),
            "no_textbook": not has_books,
            "first_title": books[0]["title"] if books else "",
            "curated": True,
        })
        seen.add(code.upper().replace(" ", ""))

    # Add all other courses from schedule data
    for c in all_courses:
        normalized = c["code"].upper().replace(" ", "")
        if normalized in seen:
            continue
        seen.add(normalized)
        courses.append({
            "code": c["code"],
            "title": c["title"],
            "book_count": 0,
            "no_textbook": False,
            "first_title": c["title"],
            "curated": False,
        })

    courses.sort(key=lambda c: c["code"])
    return {"courses": courses, "total": len(courses), "curated_count": len(curated_codes)}


def _scrape_linkedin_jobs(keywords: str, location: str = "San Diego", count: int = 50) -> list:
    """Scrape LinkedIn public job listings (no auth required)."""
    import requests as req_lib
    from bs4 import BeautifulSoup

    all_jobs = []
    for start in range(0, count, 25):
        url = (
            f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
            f"?keywords={keywords}&location={location}&start={start}"
        )
        try:
            resp = req_lib.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            }, timeout=15)
            if resp.status_code != 200:
                break
            soup = BeautifulSoup(resp.text, "lxml")
            cards = soup.find_all("div", class_="base-card")
            if not cards:
                break

            for card in cards:
                title_el = card.find("h3")
                company_el = card.find("h4")
                location_el = card.find("span", class_="job-search-card__location")
                link_el = card.find("a", class_="base-card__full-link")
                date_el = card.find("time")
                logo_el = card.find("img", class_="artdeco-entity-image")

                title = title_el.get_text(strip=True) if title_el else ""
                if not title:
                    continue

                job = {
                    "title": title,
                    "company": company_el.get_text(strip=True) if company_el else "",
                    "location": location_el.get_text(strip=True) if location_el else "",
                    "url": (link_el.get("href", "").split("?")[0]) if link_el else "",
                    "date": date_el.get("datetime", "") if date_el else "",
                    "logo": (logo_el.get("data-delayed-url", "") or logo_el.get("src", "")) if logo_el else "",
                }
                all_jobs.append(job)
        except Exception as e:
            logger.warning("LinkedIn scrape page %d failed: %s", start, e)
            break

    return all_jobs


@app.get("/api/internships/fields")
def internship_fields():
    """List available internship fields."""
    return {
        "fields": [
            {"id": fid, "label": info["label"]}
            for fid, info in INTERNSHIP_FIELDS.items()
        ]
    }


@app.get("/api/internships/search")
def internship_search(
    field: str = Query(default="cs"),
    location: str = Query(default="San Diego"),
    query: str = Query(default=""),
):
    """Search internships by field. Scrapes LinkedIn, cached 1 hour."""
    # Use custom query if provided, otherwise use field keywords
    if query:
        cache_key = f"q:{query}:{location}"
        search_keywords = query.replace(" ", "+")
    elif field in INTERNSHIP_FIELDS:
        cache_key = f"f:{field}:{location}"
        search_keywords = INTERNSHIP_FIELDS[field]["keywords"]
    else:
        return {"jobs": [], "error": f"Unknown field: {field}"}

    # Check cache
    now = time.time()
    cached = _internship_cache.get(cache_key)
    if cached and (now - cached["ts"]) < INTERNSHIP_TTL:
        return {
            "jobs": cached["data"],
            "field": field,
            "field_label": INTERNSHIP_FIELDS.get(field, {}).get("label", query),
            "location": location,
            "cached": True,
        }

    # Scrape
    jobs = _scrape_linkedin_jobs(search_keywords, location, count=50)
    _internship_cache[cache_key] = {"data": jobs, "ts": now}

    return {
        "jobs": jobs,
        "field": field,
        "field_label": INTERNSHIP_FIELDS.get(field, {}).get("label", query),
        "location": location,
        "cached": False,
    }


_job_detail_cache: dict = {}
JOB_DETAIL_TTL = 86400  # 24h


@app.get("/api/internships/detail")
def internship_detail(url: str = Query(...)):
    """Scrape full job details from a LinkedIn listing URL."""
    import requests as req_lib
    from bs4 import BeautifulSoup

    # Cache check
    now = time.time()
    cached = _job_detail_cache.get(url)
    if cached and (now - cached["ts"]) < JOB_DETAIL_TTL:
        return cached["data"]

    try:
        resp = req_lib.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        }, timeout=15)
        if resp.status_code != 200:
            return {"error": "Failed to fetch job details"}

        soup = BeautifulSoup(resp.text, "lxml")

        # Description
        desc_el = soup.find("div", class_="show-more-less-html__markup")
        description = desc_el.decode_contents().strip() if desc_el else ""
        description_text = desc_el.get_text(separator="\n", strip=True) if desc_el else ""

        # Criteria
        criteria = {}
        for item in soup.find_all("li", class_="description__job-criteria-item"):
            label = item.find("h3")
            val = item.find("span")
            if label and val:
                criteria[label.get_text(strip=True).lower().replace(" ", "_")] = val.get_text(strip=True)

        # Posted time
        posted_el = soup.find("span", class_="posted-time-ago__text")
        posted = posted_el.get_text(strip=True) if posted_el else ""

        # Applicant count
        applicants_el = soup.find("span", class_="num-applicants__caption")
        applicants = applicants_el.get_text(strip=True) if applicants_el else ""

        result = {
            "url": url,
            "description_html": description,
            "description_text": description_text,
            "seniority": criteria.get("seniority_level", ""),
            "employment_type": criteria.get("employment_type", ""),
            "job_function": criteria.get("job_function", ""),
            "industries": criteria.get("industries", ""),
            "posted": posted,
            "applicants": applicants,
        }

        _job_detail_cache[url] = {"data": result, "ts": now}
        return result

    except Exception as e:
        logger.warning("Job detail scrape failed: %s", e)
        return {"error": str(e)}


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
