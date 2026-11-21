"""Rail stations: ORR estimates of station usage (table 1410 latest year, table 1415 time series) located via Wikidata CRS codes.
Writes public/data/stations.json."""
import csv, io, json, os, re, subprocess, urllib.parse, urllib.request
import openpyxl
T1410 = "https://dataportal.orr.gov.uk/media/1909/table-1410-passenger-entries-and-exits-and-interchanges-by-station.csv"
T1415 = "https://dataportal.orr.gov.uk/media/1908/table-1415-time-series-of-passenger-entries-and-exits-and-interchanges-by-station.ods"
os.makedirs("raw/orr", exist_ok=True)
def get(url, dest):
    if not os.path.exists(dest): urllib.request.urlretrieve(url, dest)
    return dest
get(T1410, "raw/orr/t1410.csv")
if not os.path.exists("raw/orr/t1415.xlsx"):
    get(T1415, "raw/orr/t1415.ods"); subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", "raw/orr", "raw/orr/t1415.ods"], check=True)
if not os.path.exists("raw/orr/wd_crs.json"):
    q = "SELECT ?crs ?coord ?opened WHERE { ?s wdt:P4755 ?crs ; wdt:P625 ?coord . OPTIONAL { ?s wdt:P1619 ?opened } }"
    req = urllib.request.Request("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q}), headers={"Accept": "application/sparql-results+json", "User-Agent": "uk-policy-atlas/0.1 (research)"})
    open("raw/orr/wd_crs.json", "wb").write(urllib.request.urlopen(req, timeout=120).read())
loc = {}
for b in json.load(open("raw/orr/wd_crs.json"))["results"]["bindings"]:
    m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", b["coord"]["value"])
    if m and b["crs"]["value"] not in loc: loc[b["crs"]["value"]] = (round(float(m.group(2)), 5), round(float(m.group(1)), 5), b.get("opened", {}).get("value", "")[:4] or None)
def num(x):
    x = str(x).replace(",", "").strip()
    try: return float(x)
    except: return None
ws = openpyxl.load_workbook("raw/orr/t1415.xlsx", read_only=True, data_only=True)["1415a_Entries_and_Exits"]
rows = list(ws.iter_rows(values_only=True)); hi = next(i for i, r in enumerate(rows) if r and r[0] == "Sort")
H = rows[hi]; years = [str(h).split("\n")[0].replace("Apr ", "").replace(" to Mar ", "-")[:9] for h in H[6:]]
ts = {r[2]: [num(v) for v in r[6:]] for r in rows[hi + 1:] if r and r[2]}
la = {r[2]: r[5] for r in rows[hi + 1:] if r and r[2]}
out_rows = []; miss = 0
f = open("raw/orr/t1410.csv", encoding="utf-8-sig"); rd = csv.reader(f); H2 = [h.replace("\n", " ").strip() for h in next(rd)]
ix = {h: i for i, h in enumerate(H2)}
for r in rd:
    tlc = r[ix["Three Letter Code (TLC)"]]; L = loc.get(tlc)
    if not L: miss += 1; continue
    s = ts.get(tlc, [])
    pre = s[years.index("2019-2020")] if "2019-2020" in years and s else None
    out_rows.append([r[0], tlc, L[0], L[1], num(r[ix["Entries and exits: All tickets"]]), num(r[ix["Interchanges"]]), r[ix["Region"]], la.get(tlc), r[ix["Station facility owner"]], L[2], pre, [None if v is None else round(v) for v in s]])
out = {"source": {"name": "ORR, Estimates of station usage, April 2025 to March 2026 (tables 1410 and 1415); station locations from Wikidata", "url": "https://dataportal.orr.gov.uk/station-usage", "file": T1410},
       "fields": ["name", "tlc", "lat", "lon", "entries_exits", "interchanges", "region", "la", "operator", "opened", "entries_2019_20", "series"], "series_years": years, "stations": out_rows}
json.dump(out, open("public/data/stations.json", "w"))
print(len(out_rows), "stations;", miss, "without location;", years[-3:])
