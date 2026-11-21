"""UK legislation from legislation.gov.uk and current bills from the Parliament Bills API.
Writes public/data/legislation.json:
  acts: every UK Public General Act from 1945 (title, year, chapter, enacted date, long title, policy areas)
  volume: count per year of Acts, statutory instruments and devolved Acts (from the site's search facets)
  bills: bills in the current parliamentary session with their stage
Policy areas are assigned by keyword rules on the short and long titles (see AREAS), so treat them as a first cut."""
import pathlib
from concurrent.futures import ThreadPoolExecutor
import csv, io, json, re, time, urllib.request, sys
UA = {"User-Agent": "uk-policy-atlas/0.1 (open data research)"}
def get(url, tries=4):
    for i in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(3 * (i + 1))
AREAS = {
  "Health and care": r"\b(health|NHS|medic|hospital|care act|mental|social care|pharmac|nurs|tobacco|vaping|abortion|disabilit)",
  "Education and skills": r"\b(education|school|universit|higher education|further education|skills|apprentic|student|teach|child ?care|childcare)",
  "Social security and pensions": r"\b(social security|welfare reform|welfare benefits|pension|universal credit|benefit|tax credit|national insurance|child support|jobseeker)",
  "Tax and public finance": r"\b(finance act|finance \(no|taxation|tax\b|duty|duties|appropriation|supply and appropriation|national loans|budget responsibility|consolidated fund|public spending|rating|revenue)",
  "Local government and devolution": r"\b(local government|council|localism|devolution|mayor|combined authorit|greater london|scotland act|wales act|northern ireland|levelling-up)",
  "Housing and planning": r"\b(housing|planning|building safety|leasehold|renters|tenant|landlord|homeless|compulsory purchase|new towns|land registration|town and country)",
  "Transport and infrastructure": r"\b(transport|railway|rail\b|road|highway|aviation|airport|shipping|harbour|bus |buses|vehicle|crossrail|high speed|infrastructure|channel tunnel)",
  "Energy and environment": r"\b(energy|electricity|gas\b|nuclear|climate|environment|water|flood|net zero|wildlife|agricultur|fisheries|countryside|pollution|clean air|reservoir)",
  "Justice, policing and security": r"\b(crime|criminal|police|policing|justice|court|sentenc|prison|terroris|counter-terror|investigatory|security|fraud|knife|offender|legal aid|victims)",
  "Immigration and borders": r"\b(immigration|asylum|nationality|border|illegal migration|rwanda|refugee)",
  "Defence and foreign affairs": r"\b(armed forces|defence|military|international development|treaty|european union|EU\b|withdrawal|sanctions|foreign)",
  "Employment and business": r"\b(employment|trade union|minimum wage|compan|insolvency|competition|consumer|enterprise|business|trade act|financial services|bank|subsidy|procurement|investment)",
  "Constitution and government": r"\b(parliament|elections?|electoral|house of lords|constitution|civil service|ministers|freedom of information|data protection|human rights|referendum|recall|succession|fixed-term|representation of the people)",
  "Culture, media and digital": r"\b(online safety|broadcasting|media|communications|digital|telecommunications|copyright|sport|gambling|lotter|museum|arts)",
}
DEPT = {"Health and care": "Health and Social Care", "Education and skills": "Education", "Social security and pensions": "Work and Pensions", "Tax and public finance": "HM Treasury / HMRC",
  "Local government and devolution": "MHCLG", "Housing and planning": "MHCLG", "Transport and infrastructure": "Transport", "Energy and environment": "DESNZ / Defra",
  "Justice, policing and security": "Justice / Home Office", "Immigration and borders": "Home Office", "Defence and foreign affairs": "Defence / FCDO", "Employment and business": "Business and Trade",
  "Constitution and government": "Cabinet Office", "Culture, media and digital": "DCMS / DSIT"}
def areas(t):
    return [a for a, rx in AREAS.items() if re.search(rx, t, re.I)]
FIRST, LAST = int(sys.argv[1]) if len(sys.argv) > 1 else 1945, 2026
CACHE = pathlib.Path("raw/legislation"); CACHE.mkdir(parents=True, exist_ok=True)
def year_acts(y):
    f = CACHE / f"{y}.json"
    if f.exists() and y < LAST - 1: return json.loads(f.read_text())
    out, page = [], 1
    while True:
        raw = get(f"https://www.legislation.gov.uk/ukpga/{y}/data.csv?page={page}").decode("utf-8", "replace")
        if raw.lstrip().startswith("<"): break  # past the last page the site returns an HTML error page
        rows = list(csv.DictReader(io.StringIO(raw)))
        for r in rows:
            if r.get("DocumentMainType") != "UnitedKingdomPublicGeneralAct": continue
            title, summ = r["TITLE"], (r.get("SUMMARY") or "").strip()
            a = areas(title) or [x for x in areas(summ) if x != "Local government and devolution"]
            out.append({"u": r["ID"].split("/id/", 1)[-1] if r.get("ID") else None, "t": title, "y": int(r["YEAR"]), "n": int(r["NUMBER"]) if r["NUMBER"].isdigit() else r["NUMBER"], "d": r.get("CreationDate") or None,
                        "s": summ[:600], "a": a})
        if len(rows) < 20 or page >= 40: break
        page += 1; time.sleep(0.4)
    f.write_text(json.dumps(out)); print(y, len(out), flush=True)
    return out
# Four years at a time; each year is cached in raw/legislation so a rerun only fetches what is missing.
with ThreadPoolExecutor(4) as ex: acts = [a for ys in ex.map(year_acts, range(FIRST, LAST + 1)) for a in ys]
seen = set(); acts = [a for a in acts if (k := (a["y"], a["n"], a["t"])) not in seen and not seen.add(k)]  # some pages repeat rows
# Volume of legislation per year from search facets
def facet_years(path):
    x = get(f"https://www.legislation.gov.uk/{path}/data.feed").decode()
    return {int(m.group(1)): int(m.group(2)) for m in re.finditer(r'<leg:facetYear year="(\d{4})"[^>]*total="(\d+)"', x)}
volume = {k: facet_years(k) for k in ["ukpga", "uksi", "asp", "asc", "nia", "ssi", "wsi"]}
# Current bills
bills, skip = [], 0
while True:
    j = json.loads(get(f"https://bills-api.parliament.uk/api/v1/Bills?CurrentHouse=All&SortOrder=DateUpdatedDescending&IsDefeated=false&IsWithdrawn=false&Take=100&Skip={skip}"))
    for b in j["items"]:
        if b.get("isAct"): continue
        st = b.get("currentStage") or {}
        bills.append({"id": b["billId"], "t": b["shortTitle"], "house": b.get("currentHouse"), "stage": st.get("description"), "updated": (b.get("lastUpdate") or "")[:10],
                      "type": b.get("billTypeId"), "sessions": b.get("includedSessionIds"), "a": areas(b["shortTitle"])})
    skip += 100
    if skip >= j["totalResults"] or skip >= 600: break
latest = max(s for b in bills for s in (b["sessions"] or [0]))
bills = [b for b in bills if latest in (b["sessions"] or [])]
types = {1: "Government", 2: "Private Members' (ballot)", 3: "Private Members' (Ten Minute Rule)", 4: "Private Members' (presentation)", 5: "Private", 6: "Hybrid", 7: "Private Members' (Lords)", 8: "Private Members' (Lords)"}
for b in bills: b["type"] = types.get(b["type"], "Other"); del b["sessions"]
out = {"source": {"name": "legislation.gov.uk (The National Archives) and UK Parliament Bills API", "url": "https://www.legislation.gov.uk/ukpga", "file": "https://bills-api.parliament.uk/index.html",
       "note": "Acts listed with their long titles. Policy areas are assigned by keyword rules, not by the official subject index, so a few will be misfiled."},
       "areas": list(AREAS), "departments": DEPT, "acts": acts, "volume": volume, "bills": bills}
json.dump(out, open("public/data/legislation.json", "w"), separators=(",", ":"))
print(len(acts), "acts,", len(bills), "bills")
