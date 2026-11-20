"""UK infrastructure assets from Wikidata (CC0): location, build date, cost, parent project, operator."""
import json, os, urllib.request, urllib.parse, time
UA = {"User-Agent": "uk-policy-atlas/0.1 (https://github.com/1me234/uk-policy-atlas)", "Accept": "application/sparql-results+json"}
TYPES = {
    "reservoir": "Q131681", "dam": "Q12323", "railway line": "Q728937", "railway station": "Q55488",
    "motorway": "Q46622", "bridge": "Q12280", "tunnel": "Q44377", "power station": "Q159719",
    "wind farm": "Q194356", "nuclear power plant": "Q134447", "airport": "Q1248784", "port": "Q44782",
    "hospital": "Q16917", "prison": "Q40357", "canal": "Q12284", "water treatment plant": "Q1058873",
}
Q = """SELECT ?item ?itemLabel ?coord ?inception ?opened ?cost ?costUnitLabel ?partOfLabel ?operatorLabel ?length ?article WHERE {
  ?item wdt:P31/wdt:P279? wd:%s ; wdt:P17 wd:Q145 ; wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item wdt:P1619 ?opened }
  OPTIONAL { ?item p:P2130 ?cs . ?cs psv:P2130 ?cv . ?cv wikibase:quantityAmount ?cost ; wikibase:quantityUnit ?costUnit }
  OPTIONAL { ?item wdt:P361 ?partOf }
  OPTIONAL { ?item wdt:P137 ?operator }
  OPTIONAL { ?item wdt:P2043 ?length }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""
assets = {}
for t, q in TYPES.items():
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": Q % q})
    cache = f"raw/wd_{q}.json"; d = None
    if os.path.exists(cache): d = json.load(open(cache))
    for attempt in range(4):
        if d: break
        try:
            d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read())
            json.dump(d, open(cache, "w")); time.sleep(62)  # WDQS currently rate-limits to ~1 request/minute
        except Exception as e:
            print(" retry", t, str(e)[:60], flush=True); time.sleep(65)
    if not d: continue
    n0 = len(assets)
    for b in d["results"]["bindings"]:
        g = lambda k: b.get(k, {}).get("value")
        qid = g("item").rsplit("/", 1)[-1]
        lon, lat = g("coord").replace("Point(", "").rstrip(")").split()[:2]
        a = assets.setdefault(qid, {"id": qid, "name": g("itemLabel"), "type": t, "lat": round(float(lat), 5), "lon": round(float(lon), 5),
                                     "built": None, "opened": None, "cost": None, "cost_unit": None, "part_of": [], "operator": [], "length_m": None, "wikipedia": g("article")})
        if g("inception") and not a["built"]: a["built"] = g("inception")[:10]
        if g("opened") and not a["opened"]: a["opened"] = g("opened")[:10]
        if g("cost") and not a["cost"]: a["cost"], a["cost_unit"] = float(g("cost")), g("costUnitLabel")
        for k, f in (("partOfLabel", "part_of"), ("operatorLabel", "operator")):
            if g(k) and g(k) not in a[f] and not g(k).startswith("Q"): a[f].append(g(k))
        if g("length") and not a["length_m"]:
            try: a["length_m"] = float(g("length"))
            except: pass
    print(t, len(assets) - n0, flush=True)
out = {"source": {"name": "Wikidata (CC0) via SPARQL: UK items with coordinates, by type", "url": "https://query.wikidata.org/",
                  "note": "Community-maintained; build dates and costs are patchy. Treat as a starting index, not an authoritative register."},
       "assets": list(assets.values())}
json.dump(out, open("public/data/infrastructure.json", "w"), separators=(",", ":"))
print("total", len(assets), "with cost", sum(1 for a in assets.values() if a["cost"]), "with date", sum(1 for a in assets.values() if a["built"] or a["opened"]))
