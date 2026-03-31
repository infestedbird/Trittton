"""
tritonlink_scraper.py
=====================
Scrapes the UCSD Schedule of Classes (public, no login needed).

Outputs per course:
  - course_code  e.g. "ECE 15"
  - title        e.g. "Eng Computation: Prgrm in C"
  - units        e.g. "4"
  - restrictions e.g. "FR JR SO"
  - sections:
      section_id, type (LE/DI/LA), section (A01), days, time,
      building, room, instructor, available seats, limit, waitlisted

Install deps:
    pip3 install requests beautifulsoup4 lxml

Just hit Play — scrapes all departments automatically.
"""

import json
import re
import time
import logging

import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────

SOC_URL = "https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm"
TERM    = "SP26"            # Change if needed: WI26, FA25, S126, S226
OUTPUT  = "all_courses.json"
DELAY   = 1.0               # seconds between requests

HEADERS = {
    "User-Agent":   "Mozilla/5.0 (compatible; UCSDCourseScraper/3.0; personal/educational)",
    "Referer":      "https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudent.htm",
    "Content-Type": "application/x-www-form-urlencoded",
}

ALL_SUBJECTS = [
    "AAS","AESE","AFR","AIP","ANBI","ANSC","ANTH","ANAR","ANAT","ANPH","ANES",
    "BENG","BIBC","BILD","BIMD","BIMM","BISP","BGGN","BGSE","BGRD",
    "CHEM","CHIN","CLAS","CLIN","CLRE","COGS","COMM","COMP","CGS","CSE","CSS","CAT",
    "DERM","DSC","DSE","DSGN","DOC","EDS","ECE","ECON","ERC","ESYS","ETHN","ENVR",
    "FILM","FMPH","FPMU","FLTS","FREN",
    "GLBH","GPPA","GPEC","GPOL","GPPS","GPIM","GPCO",
    "HISC","HIST","HDP","HITO","HIUS","HIEU","HIAF","HIEA","HILA","HINE","HUM",
    "INASL","INTL","JAPN","JWSP",
    "LIGN","LIHL","LISL","LISP","LTCS","LTEU","LTFR","LTEN","LTGM",
    "LTCO","LTIT","LTKO","LTLA","LTRU","LTSP","LTTH","LTWR",
    "MAE","MGTP","MGT","MGTA","MGTF","MGTH","MGTC","MGTB","MBC","MATS",
    "MATH","MED","MDE","MSED","MMW","MUSC",
    "NANO","NENG","NEUR","OBG","OPTH",
    "PATH","PEDS","PHAR","PHCO","PHIL","PHYS","POLI","PSYC","PSYT",
    "RADI","RELI","REV","RGST","SOCG","SOCI","SIO","SXTH","SURG",
    "TDAC","TDDE","TDDR","TDGE","TDHT","TDMV","TDPW","TDPR","TDPF","TMC",
    "USP","VIS","WARR","WCWP",
]

VALID_TYPES = {"LE", "DI", "LA", "SE", "IN", "TA", "TU", "CL", "ST"}

# ── Fetch ─────────────────────────────────────────────────────────────────────

def fetch_subject(session, term, subject):
    payload = {
        "selectedTerm":      term,
        "selectedSubjects":  subject,
        "schedOption1":      "true",
        "schedOption2":      "true",
        "courses":           "",
        "sections":          "",
        "instructorType":    "begin",
        "instructor":        "",
        "titleType":         "contain",
        "title":             "",
        "_selectedSubjects": "1",
        "dropDownValue":     "MWF",
        "schedOption1Grad":  "true",
        "schedOption2Grad":  "true",
    }
    try:
        r = session.post(SOC_URL, data=payload, headers=HEADERS, timeout=25)
        r.raise_for_status()
        return r.text
    except requests.RequestException as e:
        logging.error("Error fetching %s: %s", subject, e)
        return None

# ── Parse ─────────────────────────────────────────────────────────────────────

def clean(text):
    return re.sub(r"\s+", " ", text or "").strip()

def parse_html(html, subject):
    """
    Real UCSD SoC HTML structure (verified from live page):

    Course header — class='crsheader', 3-4 <td> cells:
        [0] restrictions  e.g. "FR JR SO"
        [1] course number e.g. "15"
        [2] title + units e.g. "Eng Computation: Prgrm in C ( 4 Units)"
        [3] links (ignored)

    Section row — class='brdr', 13 <td> cells:
        [0]  blank
        [1]  blank
        [2]  section ID   e.g. "90971" (blank for LE A00)
        [3]  type         e.g. "LE" "DI" "LA"
        [4]  section      e.g. "A00" "A01"
        [5]  days         e.g. "TuTh"
        [6]  time         e.g. "5:00p-6:20p"
        [7]  building     e.g. "CENTR"
        [8]  room         e.g. "109"
        [9]  instructor   e.g. "Sahay, Rajeev"
        [10] available    e.g. "9" or "FULL Waitlist(6)"
        [11] limit        e.g. "146"
        [12] blank

    Some courses have two crsheader rows for the same course number
    (one without units, one with). We merge these by reusing the last
    course object when the course number is the same.
    """
    soup = BeautifulSoup(html, "lxml")
    courses = []
    current = None

    for tr in soup.find_all("tr"):
        tds = tr.find_all("td", recursive=False)
        if not tds:
            continue

        row_class = " ".join(tds[0].get("class", []))

        # ── Course header ─────────────────────────────────────────────────
        if "crsheader" in row_class:
            texts = [clean(td.get_text(" ")) for td in tds]
            if len(texts) < 3:
                continue

            restrictions = texts[0]
            course_num   = texts[1]
            title_raw    = texts[2]

            # Must be a real course number (digits, maybe with letters like "20C")
            if not re.match(r"^\d", course_num):
                continue

            units_match = re.search(r"\(\s*(\d+\.?\d*)\s*(?:Units?)?\s*\)", title_raw, re.I)
            units = units_match.group(1) if units_match else ""
            title = re.sub(r"\s*\(\s*\d+\.?\d*\s*(?:Units?)?\s*\)", "", title_raw).strip()

            course_code = f"{subject} {course_num}"

            # Merge with previous course if same code (duplicate headers)
            if current and current["course_code"] == course_code:
                # Update units/restrictions if this row has better info
                if units and not current["units"]:
                    current["units"] = units
                if restrictions and not current["restrictions"]:
                    current["restrictions"] = restrictions
            else:
                current = {
                    "subject":      subject,
                    "course_code":  course_code,
                    "title":        title,
                    "units":        units,
                    "restrictions": restrictions,
                    "sections":     [],
                }
                courses.append(current)
            continue

        # ── Section row ───────────────────────────────────────────────────
        if current is None or "brdr" not in row_class:
            continue

        texts = [clean(td.get_text(" ")) for td in tds]
        if len(texts) < 13:
            continue

        section_type = texts[3]
        if section_type not in VALID_TYPES:
            continue

        available_raw = texts[10]
        waitlist_match = re.search(r"Waitlist\((\d+)\)", available_raw)
        if waitlist_match:
            available  = "0"
            waitlisted = waitlist_match.group(1)
        elif "FULL" in available_raw:
            available  = "0"
            waitlisted = ""
        else:
            available  = available_raw
            waitlisted = ""

        sec = {
            "section_id": texts[2],
            "type":       section_type,
            "section":    texts[4],
            "days":       texts[5],
            "time":       texts[6],
            "building":   texts[7],
            "room":       texts[8],
            "instructor": texts[9],
            "available":  available,
            "limit":      texts[11],
            "waitlisted": waitlisted,
        }
        current["sections"].append(sec)

    return courses

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    print("UCSD Schedule of Classes Scraper")
    print(f"Term: {TERM}  |  Departments: {len(ALL_SUBJECTS)}  |  Output: {OUTPUT}\n")

    session     = requests.Session()
    all_courses = []
    total       = len(ALL_SUBJECTS)

    for i, subject in enumerate(ALL_SUBJECTS, 1):
        print(f"[{i:3}/{total}] {subject:<8}", end=" ... ", flush=True)

        html = fetch_subject(session, TERM, subject)
        if html is None:
            print("FAILED")
            continue

        courses = parse_html(html, subject)
        sections = sum(len(c["sections"]) for c in courses)
        all_courses.extend(courses)
        print(f"{len(courses):3} courses, {sections:4} sections")

        if i < total:
            time.sleep(DELAY)

    print(f"\n── Done: {len(all_courses)} total courses ──")
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(all_courses, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved to {OUTPUT}")

if __name__ == "__main__":
    main()
