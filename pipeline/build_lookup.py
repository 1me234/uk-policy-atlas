"""ONS lookup: local authority district -> county/unitary (upper tier) -> region, Dec 2024."""
import json, urllib.request, urllib.parse
URL = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/WD24_LAD24_CTYUA_RGN_CTRY_UK_LU/FeatureServer/0/query"
out, off = {}, 0
while True:
    q = urllib.parse.urlencode({"where": "1=1", "outFields": "LAD24CD,LAD24NM,CTYUA24CD,CTYUA24NM,RGN24CD,RGN24NM", "returnGeometry": "false", "f": "json", "resultOffset": off, "resultRecordCount": 2000, "returnDistinctValues": "true"})
    d = json.loads(urllib.request.urlopen(URL + "?" + q, timeout=120).read())
    for f in d["features"]:
        a = f["attributes"]; out[a["LAD24CD"]] = {"name": a["LAD24NM"], "upper": a["CTYUA24CD"], "upper_name": a["CTYUA24NM"], "region": a["RGN24NM"]}
    if not d.get("exceededTransferLimit") and len(d["features"]) < 2000: break
    off += 2000
json.dump({"source": {"name": "ONS Open Geography Portal: Ward to LAD to county/unitary to region lookup, December 2024", "url": "https://geoportal.statistics.gov.uk/"}, "lad": out},
          open("public/data/lookup.json", "w"), separators=(",", ":"))
print(len(out), list(out.items())[:2])
