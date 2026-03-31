# Trittton — UCSD Course Browser & AI Schedule Planner

> An intelligent course planning platform for UC San Diego students. Browse courses, check professor ratings, plan your schedule with AI, and track graduation progress — all in one place.

**Built with AI** by Joshua, board member and co-founder of [GAMECHANGERSai](https://gamechangersai.org), using [Claude Code](https://claude.ai/code) (Anthropic).

---

## What It Does

| Feature | Description |
|---------|-------------|
| **Course Browser** | Search, filter, and explore 7,000+ UCSD courses with real-time seat availability |
| **AI Schedule Planner** | Chat with Claude to build your ideal quarterly schedule with visual weekly calendar |
| **RateMyProfessor Ratings** | Inline professor ratings (★ score, difficulty, would-take-again %) on every course card |
| **My Schedule** | Build a mock schedule by picking individual sections, see conflicts on a weekly calendar |
| **Graduation Progress** | Track Warren College GE + major requirements with visual progress bars |
| **Course History** | Log completed courses so the AI knows your background and checks prerequisites |
| **Prerequisite Warnings** | Red border + warning on courses where you haven't completed prereqs |
| **WebReg Enrollment** | One-click "Enroll →" buttons that deep-link to UCSD's WebReg with section pre-filled |
| **HTML Reports** | Export your proposed schedule as a standalone dark-themed HTML file |

---

## Screenshots

### Browse Courses
- Dark theme with department sidebar, search, type/availability filters
- Inline RMP ratings (★4.2 | 3.1 diff) on every course card
- Per-section "+" buttons to add individual sections to your schedule
- Expand cards for prerequisites, section details, and enroll links

### AI Schedule Planner
- Full-width chat powered by Claude CLI running locally
- Clickable quick-reply options and text prompts for guided flow
- Visual weekly calendar with color-coded course blocks and conflict detection
- Course info cards with live RateMyProfessor data
- "Add to My Schedule" picker to select which proposed courses to keep

### Graduation Progress
- Select your major (CS, CE, EE, Physics, Math, Data Science, Cog Sci)
- Warren College GE requirements tracked automatically
- Green checkmarks on completed courses, red badges on what's missing
- Overall percentage progress bar

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| **Backend** | FastAPI, Uvicorn, Python 3 |
| **AI** | Claude CLI (local) — Sonnet 4.6 or Opus 4.6, selectable in-app |
| **Scraper** | requests + BeautifulSoup (lxml) against UCSD Schedule of Classes |
| **Data** | RateMyProfessor GraphQL API, UCSD Catalog (prereqs), all cached locally |
| **Testing** | Playwright (22 E2E tests), TypeScript strict mode |
| **Persistence** | localStorage (schedule, chat, completed courses, settings), JSON file caching |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Vite + TypeScript + Tailwind)          │
│  ┌──────────┬──────────┬──────────┬──────────┬────────┐ │
│  │ Browse   │ AI Plan  │ Schedule │ History  │ Grad   │ │
│  │ Courses  │ ner      │ Builder  │ (Done)   │ Prog   │ │
│  └──────────┴──────────┴──────────┴──────────┴────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ /api/*
┌────────────────────────┴────────────────────────────────┐
│  FastAPI Backend                                         │
│  ┌──────────┬──────────┬──────────┬──────────┐          │
│  │ /courses │ /chat    │ /rmp     │ /prereqs │          │
│  │ (scrape) │ (Claude) │ (RMP)   │ (catalog)│          │
│  └──────────┴──────────┴──────────┴──────────┘          │
└────┬─────────────┬──────────┬──────────┬────────────────┘
     │             │          │          │
  UCSD SoC    Claude CLI   RMP API   UCSD Catalog
  (scraper)   (local)     (GraphQL)  (prereqs)
```

**Data Flow:**
1. Scraper POSTs to UCSD Schedule of Classes for each of 141 departments
2. Parses HTML tables → `all_courses.json` (7,000+ courses with sections, times, availability)
3. Frontend auto-loads on startup; if no data, auto-scrapes
4. AI chat sends conversation + full course catalog to Claude CLI as context
5. RMP ratings batch-fetched from GraphQL API, cached in `rmp_cache.json`
6. Prerequisites fetched from UCSD catalog pages on demand, cached in `prereq_cache.json`

---

## Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.10+
- **Claude CLI** installed ([claude.ai/code](https://claude.ai/code))

### Quick Start

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/Trittton.git
cd Trittton

# Python setup
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn requests beautifulsoup4 lxml

# Frontend setup
cd frontend && npm install && cd ..

# Start everything
./start.sh
# → Opens browser at http://localhost:5173
# → Backend on :8000, frontend on :5173
# → Auto-scrapes UCSD courses if no data exists
```

### Or manually:
```bash
# Terminal 1: Backend
source .venv/bin/activate && python server.py

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3 (optional): Run scraper standalone
source .venv/bin/activate && python3 app.py
```

### Run Tests
```bash
cd frontend
npx playwright install chromium
npx playwright test --config=e2e/playwright.config.ts
# → 22 tests passing
```

---

## Project Structure

```
Trittton/
├── app.py                    # UCSD Schedule of Classes scraper
├── server.py                 # FastAPI backend (chat, scrape, RMP, prereqs)
├── start.sh                  # One-command launcher
├── all_courses.json          # Scraped course data (auto-generated)
├── rmp_cache.json            # RateMyProfessor ratings cache
├── prereq_cache.json         # Prerequisites cache
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Root — 6 views, state management
│   │   ├── components/       # 15 React components
│   │   │   ├── Header.tsx        # Tab navigation + term/model selectors
│   │   │   ├── CourseCard.tsx     # Expandable card with prereqs, RMP, enroll
│   │   │   ├── ChatPanel.tsx      # Full-width AI chat with interactive blocks
│   │   │   ├── WeeklyCalendar.tsx # Visual Mon-Fri calendar grid
│   │   │   ├── MySchedule.tsx     # Persistent schedule builder
│   │   │   ├── GradProgress.tsx   # Graduation requirement tracker
│   │   │   ├── CompletedCourses.tsx # Course history manager
│   │   │   └── ...
│   │   ├── hooks/            # 6 custom React hooks
│   │   │   ├── useChat.ts        # AI streaming with thinking phases
│   │   │   ├── useMySchedule.ts   # Persistent schedule (localStorage)
│   │   │   ├── useRmpRatings.ts   # Batch RMP fetcher
│   │   │   └── ...
│   │   └── lib/              # Utilities
│   │       ├── schedule.ts       # Time parsing, conflict detection, calendar
│   │       ├── requirements.ts   # Warren College + major requirements data
│   │       ├── links.ts          # URL builders (SoC, RMP, CAPEs, WebReg)
│   │       └── chat-blocks.ts    # Interactive AI block parsers
│   └── e2e/                  # 22 Playwright tests
├── index.html                # Original single-file app (archived)
└── CLAUDE.md                 # AI development instructions
```

---

## Key Configuration

| Setting | Location | Default | Description |
|---------|----------|---------|-------------|
| Term | Header dropdown | SP26 | Academic term to scrape/browse |
| AI Model | Header dropdown | Sonnet 4.6 | Claude model for chat |
| Major | Grad Progress tab | — | Your intended major |
| Scrape Delay | `app.py` DELAY | 1.0s | Seconds between requests to UCSD |

---

## Built With AI

This entire application — **5,600+ lines of TypeScript/React, Python, and test code** — was built collaboratively with [Claude Code](https://claude.ai/code) (Anthropic's Claude Opus 4.6) in a single extended session.

**What the human did:** Vision, requirements, UX feedback, testing, iteration direction

**What AI did:** Architecture, all code generation, component design, API integration, test writing, debugging

This is a real-world example of AI-augmented development — not a toy demo, but a functional tool that a UCSD student can use today to plan their courses, check professor ratings, and track graduation progress.

---

## About GAMECHANGERSai

<a href="https://gamechangersai.org"><img src="https://img.shields.io/badge/GAMECHANGERSai-501(c)(3)-blue?style=for-the-badge" alt="GAMECHANGERSai"></a>

**[GAMECHANGERSai](https://gamechangersai.org)** is a 501(c)(3) nonprofit dedicated to hands-on, AI-powered learning adventures that combine playful experimentation with responsible AI education.

This project was created by **Joshua**, a board member and co-founder of GAMECHANGERSai, as a demonstration of how AI tools like Claude Code can empower students and creators to build production-quality software. It reflects the organization's core belief: that AI should be a collaborative partner in learning, not a replacement for human creativity and judgment.

> *"Curiosity, inclusion, and responsible AI"* — the principles behind everything we build at GAMECHANGERSai.

Learn more at **[gamechangersai.org](https://gamechangersai.org)** | See more AI-built projects at **[github.com/lnxgod](https://github.com/lnxgod)**

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Ideas for contributions:**
- Additional college support (Muir, Revelle, Marshall, Sixth, Seventh, Eighth)
- More major requirement definitions
- iOS companion app
- Course prerequisite graph visualization
- Integration with UCSD's degree audit system
- Social features — share schedules with friends

---

## Data Sources

| Source | Usage | Auth Required |
|--------|-------|---------------|
| [UCSD Schedule of Classes](https://act.ucsd.edu/scheduleOfClasses/) | Course data, sections, availability | No |
| [RateMyProfessors](https://www.ratemyprofessors.com/) | Professor ratings, difficulty | No (GraphQL API) |
| [UCSD Course Catalog](https://catalog.ucsd.edu/) | Prerequisites, descriptions | No |
| [UCSD WebReg](https://act.ucsd.edu/webreg2/) | Enrollment deep links | UCSD login |
| [CAPEs](https://cape.ucsd.edu/) | Course evaluations | UCSD login |

---

## License

This project is open source. Built with love, caffeine, and Claude.

---

<p align="center">
  <b>Trittton</b> — Because planning your UCSD schedule shouldn't require a PhD.<br>
  <a href="https://gamechangersai.org">gamechangersai.org</a> · Built with <a href="https://claude.ai/code">Claude Code</a>
</p>
