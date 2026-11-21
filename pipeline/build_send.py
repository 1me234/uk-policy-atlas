"""Special educational needs: EHC plans (DfE, Explore Education Statistics API). Writes public/data/send.json."""
import csv, gzip, json, os, urllib.request
from collections import defaultdict
API = "https://api.education.gov.uk/statistics/v1/data-sets/{}/csv"
PLANS, TIME = "01a0aa37-1008-7183-9271-35e3bcbb26c8", "01a0aa36-b680-76f8-8e62-55b216223feb"
os.makedirs("raw/send", exist_ok=True)
def rows(i):
    p = f"raw/send/{i}.csv"
    if not os.path.exists(p): urllib.request.urlretrieve(API.format(i), p)
    return csv.DictReader(gzip.open(p, "rt"))
def n(x):
    try: return float(x)
    except: return None
SET = {"Total": "total", "Mainstream total": "mainstream", "Special total": "special", "Special independent": "special_independent", "Special non-maintained": "special_nonmaintained", "Total further Education": "fe", "Elective home education": "ehe", "AP PRU total": "ap"}
nat = defaultdict(dict); la = defaultdict(lambda: defaultdict(dict)); names = {}
for r in rows(PLANS):
    if r["breakdown_topic"] != "All EHC plans" or r["setting_type"] not in SET: continue
    y = r["time_period"][:4] + "/" + r["time_period"][4:]; k = SET[r["setting_type"]]
    if r["geographic_level"] == "National": nat[y][k] = n(r["ehc_plan_count"])
    elif r["geographic_level"] == "Local authority":
        la[r["new_la_code"]][y][k] = n(r["ehc_plan_count"]); names[r["new_la_code"]] = r["la_name"]
tnat = {}; tla = defaultdict(dict)
for r in rows(TIME):
    if r["breakdown_topic"] != "All EHC plans" or r["exemptions_flag"] != "Excluding exemptions" or r["timeliness"] != "Plans issued within 20 weeks": continue
    if r["geographic_level"] == "National": tnat[r["time_period"]] = n(r["ehc_plan_percent"])
    elif r["geographic_level"] == "Local authority": tla[r["new_la_code"]][r["time_period"]] = n(r["ehc_plan_percent"])
years = sorted(nat); ty = sorted(tnat)
out = {"source": {"name": "DfE, Education, health and care plans (Explore Education Statistics), January 2019 to January 2026", "url": "https://explore-education-statistics.service.gov.uk/find-statistics/education-health-and-care-plans", "file": API.format(PLANS)},
       "years": years, "national": [dict(year=y, **nat[y]) for y in years],
       "timeliness_years": ty, "national_within20_pct": [tnat[y] for y in ty],
       "la": {c: {"name": names[c], "plans": {y: v.get("total") for y, v in d.items()}, "special_independent": d.get(years[-1], {}).get("special_independent"), "within20_pct": tla.get(c, {}).get(ty[-1])} for c, d in la.items()}}
json.dump(out, open("public/data/send.json", "w"))
print(out["national"][0], out["national"][-1], list(zip(ty, out["national_within20_pct"])), len(out["la"]))
