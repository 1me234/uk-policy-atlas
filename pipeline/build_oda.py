"""UK aid (ODA) spending 2017-2024 from FCDO 'Data underlying Statistics on International Development'.
Writes public/data/oda.json. Amounts in £ thousands are converted to £ million (net = extended - received)."""
import json, os, subprocess, urllib.request
from collections import defaultdict
import openpyxl

URL = "https://assets.publishing.service.gov.uk/media/68d677144e830dd22fa1ceb2/Data-underlying-SID-2017-2024.ods"
os.makedirs("raw/oda", exist_ok=True)
if not os.path.exists("raw/oda/sid.xlsx"):
    urllib.request.urlretrieve(URL, "raw/oda/sid.ods")
    subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", "raw/oda", "raw/oda/sid.ods"], check=True)
ws = openpyxl.load_workbook("raw/oda/sid.xlsx", read_only=True)["Data"]
rows = ws.iter_rows(values_only=True)
H = list(next(rows)); ix = {h: i for i, h in enumerate(H)}
agg = {k: defaultdict(lambda: defaultdict(float)) for k in ["dept", "country", "region", "sector", "income", "channel", "bimulti"]}
total = defaultdict(float); proj = defaultdict(lambda: {"v": 0.0})
def clean(s): return (str(s).strip() if s not in (None, "") else "Unspecified")
for r in rows:
    if r[0] is None: continue
    y = int(r[0]); v = ((r[ix["AmountsExtended(£thousands)"]] or 0) - (r[ix["AmountsReceived(£thousands)"]] or 0)) / 1000
    total[y] += v
    dept = clean(r[ix["ExtendingAgencyText"]])
    for k, col in [("country", "RecipientCountryText"), ("region", "RegionText"), ("sector", "BroadSectorText"), ("income", "IncomeGroup"), ("channel", "ChannelofDelivery"), ("bimulti", "BiMultiBreakdown")]:
        agg[k][clean(r[ix[col]])][y] += v
    agg["dept"][dept][y] += v
    if y == max(2024, y):
        p = proj[(clean(r[ix["ActivityIdentifier"]]), dept)]
        p["v"] += v; p["title"] = clean(r[ix["ProjectTitle"]]); p["country"] = clean(r[ix["RecipientCountryText"]]); p["sector"] = clean(r[ix["SpecificSectorText"]])
years = sorted(total)
def table(d, top=None):
    items = sorted(d.items(), key=lambda kv: -kv[1].get(years[-1], 0))
    return [{"label": k, "values": [round(v.get(y, 0), 2) for y in years]} for k, v in items[:top]]
out = {"source": {"name": "FCDO, Statistics on International Development: final UK ODA spend 2024 (data underlying the publication, 2017-2024)",
                  "url": "https://www.gov.uk/government/statistics/statistics-on-international-development-final-uk-oda-spend-2024", "file": URL,
                  "note": "£ million, cash, net of amounts received. Calendar years."},
       "years": years, "total": [round(total[y], 1) for y in years],
       "by_department": table(agg["dept"]), "by_country": table(agg["country"], 80), "by_region": table(agg["region"]),
       "by_sector": table(agg["sector"]), "by_income": table(agg["income"]), "by_channel": table(agg["channel"], 40), "bi_multi": table(agg["bimulti"]),
       "top_projects": sorted([{"id": k[0].strip(), "department": k[1], "value_m": round(p["v"], 2), "title": p["title"], "country": p["country"], "sector": p["sector"]} for k, p in proj.items()], key=lambda p: -p["value_m"])[:150]}
import re
PDF = "https://assets.publishing.service.gov.uk/media/68cae5911eabc899da7084f2/Statistics_on_International_Development_final_UK_ODA_spend_2024.pdf"
if not os.path.exists("raw/oda/sid.pdf"): urllib.request.urlretrieve(PDF, "raw/oda/sid.pdf")
t = re.sub(r"\s+", " ", subprocess.run(["pdftotext", "raw/oda/sid.pdf", "-"], capture_output=True, text=True).stdout)
out["headline"] = {"year": 2024, "total_m": float(re.search(r"UK ODA spend was £([\d,]+) million", t).group(1).replace(",", "")),
                   "bilateral_m": float(re.search(r"bilateral ODA spend was £([\d,]+) million", t).group(1).replace(",", "")),
                   "gni_pct": 0.5, "file": PDF}
json.dump(out, open("public/data/oda.json", "w"))
print(years, out["total"]); print([(d["label"], d["values"][-1]) for d in out["by_department"][:8]]); print([(d["label"], d["values"][-1]) for d in out["by_sector"][:10]])
