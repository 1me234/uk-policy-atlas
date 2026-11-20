"""NISTA (formerly IPA) Government Major Projects Portfolio, annual report 2025-26 data."""
import json, sys, csv, io
sys.path.insert(0, "pipeline"); from govuk import download
URL = "https://assets.publishing.service.gov.uk/media/6a4fb28da6586e258d371bfd/NISTA_Major_Projects_Annual_Report_2025-2026_Data.csv"
f = download(URL)
txt = open(f, "rb").read().decode("utf-8-sig", errors="replace")
rows = list(csv.DictReader(io.StringIO(txt)))
def col(r, start):
    k = next(k for k in r if k.startswith(start)); return (r[k] or "").strip()
def num(s):
    try: return float(s.replace(",", ""))
    except: return None
out = []
for r in rows:
    out.append({
        "id": col(r, "Major Projects ID"), "name": col(r, "Project Name"), "department": col(r, "Department"),
        "category": col(r, "Annual Report Category"), "description": col(r, "Project Description"),
        "dca_nista": col(r, "IPA Delivery") or None, "dca_sro": col(r, "SRO Delivery") or None,
        "dca_commentary": col(r, "Departmental Commentary"),
        "start": col(r, "Start Date"), "end": col(r, "End Date"), "schedule_narrative": col(r, "Schedule Narrative"),
        "fy_baseline_m": num(col(r, "Financial Year Baseline")), "fy_forecast_m": num(col(r, "Financial Year Forecast")),
        "fy_variance_pct": num(col(r, "Financial Year Variance")), "variance_narrative": col(r, "In Year Variance"),
        "whole_life_cost_m": num(col(r, "Whole Life Cost")), "costs_narrative": col(r, "Costs Narrative"),
        "benefits_m": num(col(r, "Benefits (")), "benefits_narrative": col(r, "Benefits Narrative"),
        "evaluation": col(r, "Evaluation Plan"), "sro": col(r, "Senior Responsible Owner"),
    })
json.dump({"source": {"name": "NISTA Major Projects Annual Report 2025-26 (Government Major Projects Portfolio), data at 31 March 2026, £m in 2024-25 real prices",
                      "url": "https://www.gov.uk/government/publications/nista-major-projects-annual-report-2025-26", "file": URL},
           "projects": out}, open("public/data/major_projects.json", "w"), separators=(",", ":"))
from collections import Counter
print(len(out), Counter(p["dca_nista"] or p["dca_sro"] for p in out), Counter(p["category"] for p in out))
print(sum(p["whole_life_cost_m"] or 0 for p in out)/1000, "£bn WLC")
