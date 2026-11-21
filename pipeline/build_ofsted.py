"""Merge Ofsted's latest inspection outcomes into public/data/schools.json (run after build_ks4.py).
Status: concern / weak / good / strong, from the new report cards (Nov 2025 onward) where a school has one,
otherwise the latest graded (OEIF) judgement as confirmed or updated by any later ungraded inspection."""
import csv, json, os, urllib.request
URL = "https://assets.publishing.service.gov.uk/media/6af2dfeb8b63641b15a5c8ba/Management_information_-_state-funded_schools_-_latest_inspections_as_at_31_October_2026.csv"
P = "raw/ofsted/latest.csv"
os.makedirs("raw/ofsted", exist_ok=True)
if not os.path.exists(P): urllib.request.urlretrieve(URL, P)
AREAS = ["Inclusion", "Curriculum and teaching", "Achievement", "Attendance and behaviour", "Personal development and wellbeing", "Leadership and governance"]
UP = {"School remains Outstanding": 1, "Improved significantly": None, "School remains Good": 2, "Standards maintained": None}
def status(r):
    if (r["Most recent category of concern"] or "").strip() in ("SM", "SWK", "RSI"): return "concern", "Category of concern: " + r["Most recent category of concern"]
    g = [r[a] for a in AREAS if r[a] not in ("NULL", "")]
    if g:
        txt = "; ".join(f"{a}: {r[a]}" for a in AREAS if r[a] not in ("NULL", ""))
        if "Urgent improvement" in g or r["Safeguarding standards"] == "Not met": return "concern", txt
        if "Needs attention" in g: return "weak", txt
        if sum(x in ("Strong standard", "Exceptional") for x in g) >= 3: return "strong", txt
        return "good", txt
    oe = r["Latest OEIF overall effectiveness"]; un = r["Ungraded inspection overall outcome"]
    lab = {"1": "Outstanding", "2": "Good", "3": "Requires improvement", "4": "Inadequate"}
    if oe in lab:
        t = lab[oe] + (f" (later: {un})" if un not in ("NULL", "") else "")
        if un.startswith("Improved significantly") and oe == "3": return "good", t
        return {"1": "strong", "2": "good", "3": "weak", "4": "concern"}[oe], t
    if un.startswith("School remains Outstanding"): return "strong", un
    if un.startswith("School remains Good") or un == "Standards maintained": return "good", un
    if un == "Some aspects not as strong": return "weak", un
    return None, None
by = {}
for r in csv.DictReader(open(P, encoding="utf-8-sig")):
    st, txt = status(r)
    date = next((r[k] for k in ["Publication date", "Ungraded inspection publication date", "Publication date of latest OEIF graded inspection"] if r[k] not in ("NULL", "")), None)
    by[r["URN"]] = (st, txt, date)
s = json.load(open("public/data/schools.json"))
if "ofsted" in s["fields"]:
    k = s["fields"].index("ofsted"); s["fields"] = s["fields"][:k]; s["schools"] = [r[:k] for r in s["schools"]]
s["fields"] += ["ofsted", "ofsted_detail", "ofsted_date"]
ui = s["fields"].index("urn"); hit = 0
for row in s["schools"]:
    b = by.get(str(row[ui])); hit += bool(b and b[0])
    row += list(b) if b else [None] * 3
s["source_ofsted"] = {"name": "Ofsted, State-funded school inspections and outcomes: management information, latest inspections as at 31 October 2026", "url": "https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-school-inspections-outcomes", "file": URL,
                      "note": "Ofsted replaced single-word judgements with report cards from November 2025; schools are grouped here into four bands for mapping."}
json.dump(s, open("public/data/schools.json", "w"))
from collections import Counter
print(hit, Counter(v[0] for v in by.values()))
