import json, sys
sys.path.insert(0, "pipeline")
from xltable import table
from govuk import download
PAGE = "https://www.gov.uk/government/statistics/public-expenditure-statistical-analyses-2025"
F = {
 "ch1": "https://assets.publishing.service.gov.uk/media/6874fa8f92691289bdb7d394/PESA_2025_CP_Chapter_1_tables.xlsx",
 "ch4": "https://assets.publishing.service.gov.uk/media/6874fe33b1b4ebc2c2e46574/PESA_2025_CP_Chapter_4_tables.xlsx",
 "ch5": "https://assets.publishing.service.gov.uk/media/6874fe4582370235232f9343/PESA_2025_CP_Chapter_5_tables.xlsx",
 "nhs": "https://assets.publishing.service.gov.uk/media/6874fee8730a1bf28e2f9330/PESA_2025_CP_Annex_G_Table_NHS.xlsx",
}
p = {k: download(u) for k, u in F.items()}
out = {"source": {"name": "HM Treasury, Public Expenditure Statistical Analyses (PESA) 2025", "url": PAGE, "files": F},
       "tables": {}}
for key, (f, s) in {
    "tme_by_department": ("ch1", "Table_1_12"),
    "tme_by_department_real": ("ch1", "Table_1_13"),
    "rdel_plans": ("ch1", "Table_1_16"),
    "cdel_plans": ("ch1", "Table_1_17"),
    "admin_budgets": ("ch1", "Table_1_7"),
    "aggregates_long_run": ("ch4", "4_1"),
    "by_function": ("ch4", "4_2"),
    "by_function_real": ("ch4", "4_3"),
    "by_function_pct_gdp": ("ch4", "4_4"),
    "by_subfunction": ("ch5", "5_2"),
    "by_economic_category": ("ch5", "5_3"),
    "procurement_by_function": ("ch5", "5_5"),
    "nhs_england_del": ("nhs", "Sheet1"),
}.items():
    t = table(p[f], s)
    if t: out["tables"][key] = t; print(key, len(t["rows"]), t["years"][:1], t["years"][-1:])
    else: print("FAILED", key)
json.dump(out, open("public/data/spending.json", "w"), separators=(",", ":"))
# Long-run aggregates (Table 4.1) has a two-level header: parse explicitly.
import openpyxl
ws = openpyxl.load_workbook(p["ch4"], read_only=True, data_only=True)["4_1"]
lr = []
for r in ws.iter_rows(values_only=True):
    r = list(r)
    if len(r) > 14 and r[1] and str(r[1]).strip()[:2] in ("19", "20") and "-" in str(r[1]):
        f = lambda x: float(x) if isinstance(x, (int, float)) else None
        lr.append({"year": str(r[1]).strip(), "psce_nominal": f(r[2]), "psce_real": f(r[3]), "psce_pct_gdp": f(r[4]),
                   "depreciation": f(r[6]), "psni_nominal": f(r[8]), "psni_real": f(r[9]), "psni_pct_gdp": f(r[10]),
                   "tme_nominal": f(r[12]), "tme_real": f(r[13]), "tme_pct_gdp": f(r[14])})
out["tables"]["aggregates_long_run"] = {"title": "Table 4.1 Public expenditure aggregates, 1982-83 to 2025-26", "unit": "£ billion / % GDP", "series": lr}
print("aggregates", len(lr), lr[0]["year"], lr[-1]["year"])
json.dump(out, open("public/data/spending.json", "w"), separators=(",", ":"))
