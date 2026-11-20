"""Civil Service Statistics 2025 (Cabinet Office): headcount, grade mix, region and median pay per organisation."""
import json, sys, subprocess, os, openpyxl
sys.path.insert(0, "pipeline"); from govuk import download
URL = "https://assets.publishing.service.gov.uk/media/696f6cdc7e827090d02d4219/Statistical_tables_-_Civil_Service_Statistics_2025.ods"
f = download(URL); x = f.replace(".ods", ".xlsx")
if not os.path.exists(x): subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", "raw", f], check=True, capture_output=True)
wb = openpyxl.load_workbook(x, read_only=True, data_only=True)
def n(v):
    return float(v) if isinstance(v, (int, float)) else None
def sheet(name):
    rows = [list(r) for r in wb[name].iter_rows(values_only=True)]
    hi = next(i for i, r in enumerate(rows) if r and r[0] and str(r[0]).startswith("Civil Service parent"))
    hdr = [str(h).replace("\n", " ") if h else "" for h in rows[hi]]
    data = [r for r in rows[hi+1:] if r and r[0] and r[1]]
    return hdr, data
orgs = {}
def short(h):
    for k in ["Senior Civil Service", "Grades 6 and 7", "Senior and Higher Executive", "Executive Officer", "Administrative", "unknown", "Unknown"]:
        if k.lower() in h.lower(): return k
    return h[-40:]
hdr, data = sheet("table_20")
grades = ["SCS", "Grade 6/7", "SEO/HEO", "EO", "AO/AA", "Unknown"]; assert len(hdr[2:-1]) == 6
for r in data:
    key = (r[0], r[1])
    orgs[key] = {"parent": r[0], "name": r[1], "is_total": r[0] == r[1] or str(r[1]).startswith(str(r[0])) and "total" in str(r[1]).lower(),
                 "headcount": n(r[-1]), "by_grade": dict(zip(grades, [n(v) for v in r[2:-1]]))}
hdr, data = sheet("table_12")
regions = [h.split(" in ")[-1].strip().removeprefix("the ") for h in hdr[2:-1]]
regions = [("Overseas" if "overseas" in r else "Unknown" if "unreported" in r else r) for r in regions]
for r in data:
    o = orgs.setdefault((r[0], r[1]), {"parent": r[0], "name": r[1]})
    o["by_region"] = dict(zip(regions, [n(v) for v in r[2:-1]]))
hdr, data = sheet("table_25")
for r in data:
    o = orgs.setdefault((r[0], r[1]), {"parent": r[0], "name": r[1]})
    o["median_salary"] = n(r[-1])
out = {"source": {"name": "Cabinet Office, Civil Service Statistics 2025 (snapshot at 31 March 2025)",
                  "url": "https://www.gov.uk/government/statistics/civil-service-statistics-2025", "file": URL},
       "grades": grades, "regions": regions, "organisations": list(orgs.values())}
json.dump(out, open("public/data/civil_service.json", "w"), separators=(",", ":"))
print(len(orgs), grades, regions[:16])
# Flag the departmental-group total row (the largest row per parent group).
from collections import defaultdict
g = defaultdict(list)
for o in out["organisations"]: g[o["parent"]].append(o)
for p, lst in g.items():
    top = max(lst, key=lambda o: o.get("headcount") or 0)
    for o in lst: o["is_total"] = o is top and len(lst) > 1 or (len(lst) == 1)
json.dump(out, open("public/data/civil_service.json", "w"), separators=(",", ":"))
print([ (o["name"], o["headcount"]) for o in out["organisations"] if o["is_total"]][:50])
