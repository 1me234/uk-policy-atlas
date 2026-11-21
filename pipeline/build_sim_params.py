"""HMRC 'Direct effects of illustrative tax changes' (the tax ready reckoner) for the policy simulator.
Writes public/data/sim_params.json: £m yield of each illustrative change for the three years HMRC publishes.
HMRC's costings include behavioural responses where they are material (see the bulletin's methodology notes)."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import govuk
import openpyxl

PAGE = "/government/statistics/direct-effects-of-illustrative-tax-changes"
c, atts = govuk.attachments(PAGE)
ods = next(a["url"] for a in atts if a["url"] and a["url"].lower().endswith(".ods"))
path = govuk.download(ods)
xlsx = path[:-4] + ".xlsx"
if not os.path.exists(xlsx):
    subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", os.path.dirname(path), path], check=True, capture_output=True)
ws = openpyxl.load_workbook(xlsx, data_only=True).worksheets[0]
rows = [[c for c in r if c is not None] for r in ws.iter_rows(values_only=True)]
header = next(r for r in rows if len(r) >= 4 and "financial year" in str(r[1]))
years = [str(h).split("financial year ")[1].split(",")[0].replace(" to ", "-").replace("20", "", 1) for h in header[1:4]]
years = [y[:4] + "-" + y[-2:] for y in [str(h).split("financial year ")[1].split(",")[0] for h in header[1:4]]]
num = lambda v: 0.0 if str(v).lower() == "neg" else float(v)
section, lines = None, []
for r in rows[rows.index(header) + 1:]:
    if len(r) == 1:
        section = str(r[0]); continue
    if len(r) >= 4:
        lines.append({"section": section, "label": str(r[0]).strip(), "m": [num(v) for v in r[1:4]]})
out = {"source": {"name": f"HMRC, Direct effects of illustrative tax changes ({c.get('public_updated_at','')[:7]})",
                  "url": "https://www.gov.uk" + PAGE, "file": ods,
                  "note": "Yield of each illustrative change in £ million (positive = more revenue for a rise). Later years in the simulator grow these in line with nominal GDP."},
       "years": years, "lines": lines}
json.dump(out, open("public/data/sim_params.json", "w"), indent=1)
print(len(lines), "lines", years)
