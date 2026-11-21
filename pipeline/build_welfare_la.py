"""DWP benefit expenditure by local authority (GB), 2024-25 by benefit, with 2010-11 and 2019-20 totals.
Writes public/data/welfare_la.json (£ million, nominal)."""
import json, os, subprocess, urllib.request
import openpyxl
URL = "https://assets.publishing.service.gov.uk/media/693ffb536a12691d48491fb3/benefit-expenditure-by-local-authority-2024-25.ods"
os.makedirs("raw/benla", exist_ok=True)
if not os.path.exists("raw/benla/la.xlsx"):
    urllib.request.urlretrieve(URL, "raw/benla/la.ods")
    subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", "raw/benla", "raw/benla/la.ods"], check=True)
wb = openpyxl.load_workbook("raw/benla/la.xlsx", read_only=True, data_only=True)
KEEP = ["Total", "State Pension", "Universal Credit", "Personal Independence Payment", "Housing Benefit", "Employment And Support Allowance", "Pension Credit", "Attendance Allowance", "Disability Living Allowance", "Carer's Allowance", "Jobseeker's Allowance"]
def sheet(name):
    rows = list(wb[name].iter_rows(values_only=True)); H = list(rows[2]); out = {}
    for r in rows[3:]:
        if r[0] and str(r[0])[:1] in "EWS" and len(str(r[0])) == 9:
            out[r[0]] = {"name": r[1], **{k: (round(r[H.index(k)], 3) if k in H and isinstance(r[H.index(k)], (int, float)) else None) for k in KEEP}}
    return out
now, y19, y10 = sheet("2024-25"), sheet("2019-20"), sheet("2010-11")
la = {c: {**v, "total_2019": y19.get(c, {}).get("Total"), "total_2010": y10.get(c, {}).get("Total")} for c, v in now.items()}
gb = next(r for r in wb["2024-25"].iter_rows(values_only=True) if r[1] == "GREAT BRITAIN")
out = {"source": {"name": "DWP, Benefit expenditure by local authority, 2002/03 to 2024/25 (Benefit expenditure and caseload tables 2025)", "url": "https://www.gov.uk/government/publications/benefit-expenditure-and-caseload-tables-2025", "file": URL, "note": "£ million, nominal. Some benefits (e.g. Child Benefit, tax credits) are not allocated to local authorities."},
       "year": "2024-25", "benefits": KEEP, "gb_total": round(gb[2], 1), "la": la}
json.dump(out, open("public/data/welfare_la.json", "w"))
print(len(la), out["gb_total"], list(la.items())[0])
