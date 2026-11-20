"""DfE Get Information about Schools (GIAS): every open school in England with location, capacity, pupils, FSM %."""
import csv, json, io
from pyproj import Transformer
SRC = "https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata20261120.csv"
tr = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
rows = csv.DictReader(io.open("raw/edubase.csv", encoding="latin1"))
fields = ["urn", "name", "phase", "type", "lat", "lon", "capacity", "pupils", "fsm_pct", "trust", "lad", "opened"]
out = []
f = lambda s: float(s) if s not in ("", None) else None
for r in rows:
    if r["EstablishmentStatus (name)"] != "Open" or not r["Easting"]: continue
    if r["EstablishmentTypeGroup (name)"] in ("Online provider",): continue
    lon, lat = tr.transform(float(r["Easting"]), float(r["Northing"]))
    out.append([int(r["URN"]), r["EstablishmentName"], r["PhaseOfEducation (name)"], r["EstablishmentTypeGroup (name)"],
                round(lat, 5), round(lon, 5), f(r["SchoolCapacity"]), f(r["NumberOfPupils"]), f(r["PercentageFSM"]),
                r["Trusts (name)"] or None, r["DistrictAdministrative (code)"], r["OpenDate"][-4:] if r["OpenDate"] else None])
json.dump({"source": {"name": "DfE, Get Information about Schools (GIAS) all-establishment extract, 20 November 2026", "url": "https://get-information-schools.service.gov.uk/Downloads", "file": SRC},
           "fields": fields, "schools": out}, open("public/data/schools.json", "w"), separators=(",", ":"))
from collections import Counter
print(len(out), Counter(x[3] for x in out).most_common(8))
