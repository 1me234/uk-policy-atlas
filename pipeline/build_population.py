"""ONS mid-2025 population estimates for every UK geography (all ages, under 18, 65+)."""
import json, openpyxl, urllib.request, os
URL = "https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland/mid2025/mye25tablesuk.xlsx"
f = "raw/mye25tablesuk.xlsx"
if not os.path.exists(f): open(f, "wb").write(urllib.request.urlopen(URL).read())
ws = openpyxl.load_workbook(f, read_only=True, data_only=True)["MYE2 - Persons"]
out = {}
for r in ws.iter_rows(min_row=9, values_only=True):
    if not r[0]: continue
    ages = [int(v) if v is not None else 0 for v in r[4:95]]
    out[r[0]] = {"name": r[1], "geography": r[2], "all": int(r[3]), "u18": sum(ages[:18]), "o65": sum(ages[65:])}
json.dump({"source": {"name": "ONS, Population estimates for the UK, mid-2025", "url": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland", "file": URL},
           "areas": out}, open("public/data/population.json", "w"), separators=(",", ":"))
print(len(out), out["E06000001"])
