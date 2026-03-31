"""
Run this once to dump the raw HTML from UCSD.
Paste the output back so the parser can be fixed.

    python debug_html.py
"""
import requests
from bs4 import BeautifulSoup
import re

SOC_URL = "https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm"
HEADERS = {
    "User-Agent":   "Mozilla/5.0 (compatible; UCSDCourseScraper/2.0)",
    "Referer":      "https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudent.htm",
    "Content-Type": "application/x-www-form-urlencoded",
}
payload = {
    "selectedTerm":      "SP26",
    "selectedSubjects":  "ECE",
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

print("Fetching ECE from UCSD...")
r = requests.post(SOC_URL, data=payload, headers=HEADERS, timeout=25)
print(f"Status: {r.status_code}")

# Save full HTML to file
with open("ece_raw.html", "w", encoding="utf-8") as f:
    f.write(r.text)
print("Full HTML saved to ece_raw.html")

# Also print the first 30 <tr> rows with their classes/attrs so we can see the structure
print("\n── First 30 <tr> rows ──────────────────────────────────────────")
soup = BeautifulSoup(r.text, "lxml")
for i, tr in enumerate(soup.find_all("tr")[:30]):
    tds = tr.find_all("td", recursive=False)
    if not tds:
        continue
    first = tds[0]
    classes = first.get("class", [])
    colspan = first.get("colspan", "")
    bgcolor = first.get("bgcolor", "")
    text = re.sub(r"\s+", " ", first.get_text()).strip()[:80]
    print(f"  tr[{i:2}]  td.class={classes}  colspan={colspan}  bgcolor={bgcolor}")
    print(f"          text: {text!r}")
    print()