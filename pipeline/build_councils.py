"""MHCLG Revenue Outturn Summary (RS) 2025-26 for every English local authority, £ thousand."""
import json, sys, os, subprocess, openpyxl
sys.path.insert(0, "pipeline"); from govuk import download
PAGE = "https://www.gov.uk/government/statistics/local-authority-revenue-expenditure-and-financing-england-2025-to-2026-individual-local-authority-data-outturn"
URL = "https://assets.publishing.service.gov.uk/media/6ab26f5dfe72ed1e2b02ee72/RS_LA_Data_2025-26_data_by_LA.ods"
f = download(URL); x = f.replace(".ods", ".xlsx")
if not os.path.exists(x): subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", "raw", f], check=True, capture_output=True)
ws = openpyxl.load_workbook(x, read_only=True, data_only=True)["RS_LA_Data_202526"]
rows = [list(r) for r in ws.iter_rows(min_row=7, values_only=True)]
hdr = [str(h).strip() if h else "" for h in rows[0]]
cols = [i for i in range(7, len(hdr)) if hdr[i]]
las = []
for r in rows[1:]:
    if not r[1] or not str(r[1]).startswith("E"): continue
    vals = [round(r[i], 1) if isinstance(r[i], (int, float)) else None for i in cols]
    las.append({"ecode": r[0], "code": r[1], "name": r[2], "class": r[4], "detailed_class": r[5], "values": vals})
json.dump({"source": {"name": "MHCLG, Local authority revenue expenditure and financing England: 2025 to 2026 outturn (RS), £ thousand", "url": PAGE, "file": URL},
           "columns": [hdr[i] for i in cols], "authorities": las}, open("public/data/councils.json", "w"), separators=(",", ":"))
print(len(las), len(cols)); from collections import Counter; print(Counter(l["class"] for l in las))
