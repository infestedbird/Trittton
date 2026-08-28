# Trittton

> An AI-powered course planning and campus utility platform for UC San Diego — built end-to-end in a single repo.

Browse 7,000+ UCSD courses, chat with an LLM to assemble a quarter schedule, watch sections for seat openings, check your graduation progress, find a study room, see the next bus — all behind one login.

Built by [Joshua DeNeveu](https://github.com/Joshua-de-neveu), co-founder of [GAMECHANGERSai](https://gamechangersai.org).

---

## What's inside

**Course planning**

- **Course Browser** — search/filter TSS-era modules and events with live seats, waitlist availability, prerequisites, and inline RateMyProfessor ratings (★/difficulty/would-take-again).
- **AI Schedule Planner** — chat panel that proposes a full quarter schedule rendered as a weekly calendar. Backed by either Gemini 2.5 Flash or the Claude CLI (Sonnet/Opus), selectable in the header.
- **Auto Scheduler** — non-chat alternative that generates schedules from constraints (no-conflict, time-of-day, instructor preference).
- **My Schedule** — pick individual sections, see Mon–Fri conflicts on a calendar, export to `.ics` for Google Calendar.
- **4-Year Plan** — drag courses across quarters; checks prereq chains.
- **Graduation Progress** — Warren College GE + major requirement tracking (CS, CE, EE, Physics, Math, Data Science, Cog Sci) with progress bars.
- **Completed Courses** — log what you've taken; the AI uses it for prereq checks and recommendations.
- **Professor Compare** — side-by-side RMP stats for instructors teaching the same course.
- **Prereq Chains** — visualize the dependency graph behind any course.
- **Schedule Report** — export the proposed schedule as a standalone HTML file.

**Active monitoring**

- **Seat + Waitlist Watch** — background polling against TSS-era data alerts when a seat or waitlist spot opens.
- **TSS Booking Assistant** — validates exact event IDs, opens each official course page in one reusable side-by-side TSS window, and tracks Book/Join Waitlist confirmations without handling UCSD credentials.

**Campus utilities**

- **Room Finder** — find an open study room right now.
- **Library Status**, **Dining**, **Parking**, **Transit** — live status for spots students actually check between classes.
- **Events Calendar** — campus events.
- **Textbooks**, **Internships**, **Advising / Councillor** — supplementary modules.

**Account & sync**

- Login-gated app (server-side credential hash).
- Optional Google sign-in for calendar export and cloud-sync of your schedule, completed courses, and watch list across devices.

---

## Tech stack

| Layer       | Stack                                                                 |
|-------------|-----------------------------------------------------------------------|
| Frontend    | React 19 · TypeScript · Vite 8 · Tailwind 4 · Leaflet (campus map) · react-window (virtualized lists) |
| Backend     | FastAPI · Uvicorn · Python 3.12                                        |
| AI          | Google Gemini 2.5 Flash *and* Claude CLI (Sonnet 4.6 / Opus 4.6) — chosen per-request |
| Course data | UCSD Class Planner's public TSS-era catalog API, with legacy SoC fallback |
| Data        | TSS events/seats/waitlists · RateMyProfessor GraphQL · UCSD Catalog (prereqs) |
| Auth / sync | Server-side hash login · Firebase + Google OAuth for cloud sync       |
| Calendar    | `icalendar` for `.ics` export                                          |
| Deploy      | Dockerfile · `render.yaml` for Render                                  |
| Testing     | Playwright (E2E)                                                       |

---

## Architecture

```
            ┌──────────────────────────────────────────────────────┐
            │  React + Vite frontend                               │
            │  Browse · AI Plan · My Schedule · Grad · Utilities   │
            └────────────────────────┬─────────────────────────────┘
                                     │  /api/*
            ┌────────────────────────┴─────────────────────────────┐
            │  FastAPI                                              │
            │  ┌───────────┬──────────┬──────────┬──────────────┐  │
            │  │ auth      │ courses  │ chat     │ rmp / prereqs│  │
            │  │ /scrape   │ /watch   │ (Gem|Cl) │              │  │
            │  └───────────┴──────────┴──────────┴──────────────┘  │
            │  background: term poller · seat-watch loop            │
            └──┬──────────┬─────────────┬───────────┬───────────────┘
               │          │             │           │
        UCSD SoC   Claude CLI /   RateMyProf    UCSD Catalog
        (scrape)   Gemini API     (GraphQL)     (prereqs)
```

Fall 2026 and later are loaded from UCSD's public TSS-backed Class Planner catalog and cached briefly in memory. `all_courses.json` remains the fallback for Summer 2026 and earlier transition terms. Server-side GitHub persistence is disabled unless both `ENABLE_GITHUB_PERSIST=true` and `GITHUB_TOKEN` are set.

---

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.10+ (3.12 recommended)
- For Claude-backed chat: [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) on `PATH`
- For Gemini-backed chat: a `GEMINI_API_KEY`

### Quick start

```bash
git clone https://github.com/Joshua-de-neveu/Trittton.git
cd Trittton

# Python
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Run both
./start.sh
# → backend on :8000, Vite dev server on :5173, browser opens automatically
```

`start.sh` auto-creates the venv, installs deps if missing, and tails both processes. Ctrl-C kills both.

### Environment

Set what you need before launch (a `.env` works if you `source` it):

| Variable         | Purpose                                                   | Required when                       |
|------------------|-----------------------------------------------------------|--------------------------------------|
| `GEMINI_API_KEY` | Gemini chat backend                                       | Using the Gemini model in the UI    |
| `AUTH_EMAIL`     | Login email                                               | Always (login-gated app)            |
| `AUTH_HASH`      | bcrypt-style hash of the login password                   | Always                              |
| `GITHUB_TOKEN`   | Persist legacy scraped JSON when explicitly enabled       | Optional                            |
| `ENABLE_GITHUB_PERSIST` | Opt in to server-authored catalog commits (`true`) | Optional; defaults to disabled      |

### Production / Docker

```bash
# Build the frontend, package as a single container
docker build -t trittton .
docker run -p 8000:8000 \
  -e GEMINI_API_KEY=... -e AUTH_EMAIL=... -e AUTH_HASH=... \
  trittton
```

`render.yaml` is wired for a one-click Render deploy of the same image.

### Tests

```bash
cd frontend
npx playwright install chromium
npx playwright test --config=e2e/playwright.config.ts
```

---

## Project layout

```
Trittton/
├── server.py             # FastAPI app — auth, scrape, chat (Gemini+Claude),
│                         # RMP proxy, prereqs, seat-watch loop, term poller
├── app.py                # Standalone scraper (writes all_courses.json)
├── htmllls.py             # Debug: dump raw SoC HTML for a single dept
├── start.sh              # One-command dev launcher
├── Dockerfile · render.yaml
├── requirements.txt
├── all_courses.json      # Scraped course data (auto-generated)
├── ucsd_wiki.md          # Notes the AI uses as campus context
└── frontend/
    ├── src/
    │   ├── App.tsx                # Root view router
    │   ├── components/            # 40+ React components (see What's inside)
    │   ├── hooks/                 # useChat, useScraper, useSeatWatch,
    │   │                           # useCloudSync, useGoogleAuth, …
    │   └── lib/                   # schedule math, requirements data, link builders
    └── e2e/                       # Playwright suite
```

---

## Data sources

| Source                                                       | Used for                          | Auth   |
|--------------------------------------------------------------|-----------------------------------|--------|
| [UCSD Class Planner](https://classplanner.apps.ucsd.edu/)          | TSS modules, events, seats, waitlists, booking links | none |
| [UCSD Schedule of Classes](https://act.ucsd.edu/scheduleOfClasses/) | Legacy terms through Summer 2026 | none   |
| [RateMyProfessors](https://www.ratemyprofessors.com/)        | Instructor ratings                | none   |
| [UCSD Catalog](https://catalog.ucsd.edu/)                    | Prerequisites, descriptions       | none   |
| [TSS](https://sis.ucsd.edu/)                                 | Final booking and waitlist action | UCSD   |
| [CAPEs](https://cape.ucsd.edu/)                              | Course evaluations                | UCSD   |

Scraping respects a configurable `DELAY` (default 1.0s) between requests.

---

## Contributing

Issues and PRs welcome — especially:

- Requirement definitions for the other six colleges (Muir, Revelle, Marshall, Sixth, Seventh, Eighth) and additional majors.
- More robust prereq parsing for irregular catalog entries.
- iOS/Android companion.
- Visualizations on top of the existing prereq-chain graph data.

---

## License

Open source. Built with caffeine, Dino nuggets, and the UCSD Schedule of Classes' surprisingly parseable HTML.

<p align="center">
  <a href="https://gamechangersai.org">GAMECHANGERSai</a> · planning your UCSD schedule shouldn't take a PhD.
</p>
