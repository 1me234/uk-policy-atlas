"""DfE Key stage 4 performance (EES public API): per-school Attainment 8, Progress 8, % grade 5+ English & maths, merged into schools.json."""
import csv, gzip, io, json
SRC = "https://api.education.gov.uk/statistics/v1/data-sets/19e39901-a96c-be76-b9c2-6af54ae076d2/csv"
best = {}
for r in csv.DictReader(io.TextIOWrapper(gzip.open("raw/ks4_schools.csv"), encoding="utf-8")):
    if r["breakdown_topic"] != "Total" or r["sex"] != "Total" or r["disadvantage_status"] != "Total": continue
    urn = r["school_urn"]
    tp = r["time_period"]
    if urn in best and best[urn]["tp"] >= tp: continue
    num = lambda k: float(r[k]) if r.get(k) not in ("", "z", "c", "x", "u", "low", None) and r[k].replace(".", "", 1).replace("-", "", 1).isdigit() else None
    best[urn] = {"tp": tp, "a8": num("attainment8_average"), "p8": num("progress8_average"), "em95": num("engmath_95_percent"), "pupils": num("pupil_count")}
s = json.load(open("public/data/schools.json"))
if "ks4_year" in s["fields"]:  # already merged: strip and re-merge
    k = s["fields"].index("ks4_year"); s["fields"] = s["fields"][:k]; s["schools"] = [r[:k] for r in s["schools"]]
s["fields"] += ["ks4_year", "attainment8", "progress8", "engmath_5plus_pct"]
hit = 0
for row in s["schools"]:
    b = best.get(str(row[0]))
    row += [b["tp"], b["a8"], b["p8"], b["em95"]] if b else [None] * 4
    hit += bool(b)
s["source_ks4"] = {"name": "DfE, Key stage 4 performance: performance tables schools data (latest year per school)", "url": "https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance", "file": SRC}
json.dump(s, open("public/data/schools.json", "w"), separators=(",", ":"))
print(len(best), "schools with KS4;", hit, "matched; periods", sorted({b['tp'] for b in best.values()}))
