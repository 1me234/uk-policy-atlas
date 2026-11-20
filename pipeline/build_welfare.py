"""DWP Benefit expenditure and caseload tables, Spring Forecast 2026: outturn since 1948/49 and forecasts, by benefit."""
import json, sys, re, openpyxl
sys.path.insert(0, "pipeline"); from govuk import download
PAGE = "https://www.gov.uk/government/publications/benefit-expenditure-and-caseload-tables-2026"
URL = "https://assets.publishing.service.gov.uk/media/69dcdc8c6b695d635c34dcc4/outturn-and-forecast-tables-spring-forecast-2026.xlsx"
wb = openpyxl.load_workbook(download(URL), read_only=True, data_only=True)
YR = re.compile(r"^(19|20)\d\d/\d\d$")
sheets = {}
for ws in wb.worksheets:
    if ws.title in ("Contents", "Notes"): continue
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    hi = next((i for i, r in enumerate(rows) if sum(1 for c in r if c and YR.match(str(c).strip())) > 3), None)
    if hi is None: continue
    ycols = [(j, str(c).strip()) for j, c in enumerate(rows[hi]) if c and YR.match(str(c).strip())]
    status = {y: str(rows[hi+1][j]).strip() if rows[hi+1][j] else "" for j, y in ycols}
    title = str(rows[hi][1] or "").strip()
    section, series = title, []
    for r in rows[hi+2:]:
        lab = next((str(c).strip() for c in r[1:ycols[0][0]] if c and str(c).strip()), None)
        if not lab: continue
        vals = [round(r[j], 4) if isinstance(r[j], (int, float)) else None for j, _ in ycols]
        if all(v is None for v in vals):
            if len(lab) > 25: section = lab
            continue
        series.append({"section": section, "label": lab, "values": vals})
    sheets[ws.title.strip()] = {"title": title, "years": [y for _, y in ycols], "status": [status[y] for _, y in ycols], "series": series}
    print(ws.title.strip(), len(series), ycols[0][1], ycols[-1][1])
json.dump({"source": {"name": "DWP, Benefit expenditure and caseload tables 2026 (Spring Forecast 2026)", "url": PAGE, "file": URL,
                      "note": "Expenditure in £ billion nominal and real terms, caseloads in thousands; years after the latest outturn are DWP/OBR forecasts."},
           "sheets": sheets}, open("public/data/welfare.json", "w"), separators=(",", ":"))
