"""Charity Commission for England and Wales register extract: registered charities with income >= £1m,
government contract/grant income, staff, reserves and classification; plus totals by cause for all charities."""
import csv, json, sys
from collections import defaultdict
csv.field_size_limit(10**9)
BASE = "https://ccewuksprdoneregsadata1.blob.core.windows.net/data/txt/publicextract.{}.zip"
def rd(name):
    return csv.DictReader(open(f"raw/publicextract.{name}.txt", encoding="utf-8-sig", errors="replace"), delimiter="\t", quoting=csv.QUOTE_NONE)
def f(s):
    try: return float(s)
    except (TypeError, ValueError): return None
ch = {}
for r in rd("charity"):
    if r["charity_registration_status"] != "Registered" or r["linked_charity_number"] not in ("0", ""): continue
    ch[r["organisation_number"]] = {"num": int(r["registered_charity_number"]), "name": r["charity_name"].title(), "income": f(r["latest_income"]),
        "spend": f(r["latest_expenditure"]), "postcode": r["charity_contact_postcode"] or None, "web": r["charity_contact_web"] or None,
        "registered": r["date_of_registration"][:10], "activities": (r["charity_activities"] or "")[:280], "type": r["charity_type"], "causes": []}
cls = defaultdict(list)
for r in rd("charity_classification"):
    if r["classification_type"] == "What" and r["organisation_number"] in ch: ch[r["organisation_number"]]["causes"].append(r["classification_description"])
for r in rd("charity_annual_return_parta"):
    c = ch.get(r["organisation_number"])
    if c and r["latest_fin_period_submitted_ind"] == "True":
        c["gov_contracts"] = f(r["income_from_government_contracts"]); c["gov_grants"] = f(r["income_from_government_grants"])
        c["staff_over_60k"] = r["employees_salary_over_60k"] == "True"; c["volunteers"] = f(r["count_volunteers"])
for r in rd("charity_annual_return_partb"):
    c = ch.get(r["organisation_number"])
    if c and r["latest_fin_period_submitted_ind"] == "True":
        c["employees"] = f(r["count_employees"]); c["reserves"] = f(r["reserves"]); c["assets"] = f(r["assets_total_assets_and_liabilities"])
by_cause = defaultdict(lambda: {"n": 0, "income": 0.0, "gov": 0.0})
for c in ch.values():
    for k in c["causes"] or ["Unclassified"]:
        b = by_cause[k]; b["n"] += 1; b["income"] += c["income"] or 0; b["gov"] += (c.get("gov_contracts") or 0) + (c.get("gov_grants") or 0)
big = sorted((c for c in ch.values() if (c["income"] or 0) >= 1_000_000), key=lambda c: -(c["income"] or 0))
tot = {"registered": len(ch), "income": sum(c["income"] or 0 for c in ch.values()),
       "gov_income": sum((c.get("gov_contracts") or 0) + (c.get("gov_grants") or 0) for c in ch.values()),
       "income_bands": {b: sum(1 for c in ch.values() if lo <= (c["income"] or 0) < hi) for b, lo, hi in
                        [("<£10k", 0, 1e4), ("£10k–100k", 1e4, 1e5), ("£100k–1m", 1e5, 1e6), ("£1m–10m", 1e6, 1e7), ("£10m–100m", 1e7, 1e8), ("£100m+", 1e8, 1e13)]}}
json.dump({"source": {"name": "Charity Commission for England and Wales, register of charities data extract, 20 November 2026 (main charities, not linked subsidiaries)",
                      "url": "https://register-of-charities.charitycommission.gov.uk/en/register/full-register-download", "files": [BASE.format(n) for n in ("charity", "charity_classification", "charity_annual_return_parta", "charity_annual_return_partb")]},
           "totals": tot, "by_cause": by_cause, "charities": big}, open("public/data/charities.json", "w"), separators=(",", ":"))
print(tot, len(big))
