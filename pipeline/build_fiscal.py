"""OBR Public finances databank (October 2026 EFO): receipts, spending, borrowing, debt since 1900 and receipts by tax."""
import json, re, os, urllib.request, openpyxl
URL = "https://obr.uk/download/public-finances-databank-october-2026-efo/"
f = "raw/obr_databank.xlsx"
if not os.path.exists(f): open(f, "wb").write(urllib.request.urlopen(URL).read())
wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
YR = re.compile(r"^(19|20)\d\d-\d\d$")
num = lambda x: round(float(x), 3) if isinstance(x, (int, float)) else None
def grid(name, label_rows, ycol):
    rows = [list(r) for r in wb[name].iter_rows(values_only=True)]
    data = [r for r in rows if len(r) > ycol and r[ycol] and YR.match(str(r[ycol]).strip())]
    hdr = rows[label_rows]
    cols = [(j, str(h).replace("\n", " ").strip()) for j, h in enumerate(hdr) if h and j > ycol]
    fc = next((j for j, h in enumerate(rows[label_rows]) if h == "Forecast"), None)
    return {"years": [str(r[ycol]).strip() for r in data],
            "series": {lab: [num(r[j]) for r in data] for j, lab in cols if lab != "Forecast"}}
out = {"source": {"name": "Office for Budget Responsibility, Public finances databank (October 2026 Economic and fiscal outlook)", "url": "https://obr.uk/public-finances-databank-2026-27/", "file": URL,
                  "note": "Years from 2026-27 onward are OBR forecasts."}}
out["since_1900"] = grid("Public finances since 1900", 5, 1)
out["pct_gdp"] = grid("Aggregates (per cent of GDP)", 3, 1)
out["bn"] = grid("Aggregates (£bn)", 3, 1)
out["receipts_bn"] = grid("Receipts (£bn)", 3, 1) if "Receipts (£bn)" in wb.sheetnames else None
for k in ("since_1900", "pct_gdp", "bn", "receipts_bn"):
    g = out[k]; print(k, len(g["years"]), g["years"][:1], g["years"][-1:], list(g["series"])[:6])
json.dump(out, open("public/data/fiscal.json", "w"), separators=(",", ":"))
