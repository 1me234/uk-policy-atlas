"""ONS Open Geography Portal boundaries (OGL, contains OS data © Crown copyright) as simplified GeoJSON."""
import json, urllib.request, urllib.parse
BASE = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/{}/FeatureServer/0/query"
LAYERS = {
    "lad": ("Local_Authority_Districts_December_2024_Boundaries_UK_BUC", "Local authority districts, December 2024 (ultra generalised)"),
    "icb": ("Integrated_Care_Boards_April_2026_Boundaries_EN_BSC", "Integrated Care Boards, April 2026 (super generalised)"),
    "region": ("Regions_December_2024_Boundaries_EN_BUC", "English regions, December 2024 (ultra generalised)"),
}
def r(x, p=3):
    return [r(v, p) for v in x] if isinstance(x, list) else round(x, p)
for key, (svc, title) in LAYERS.items():
    feats, offset = [], 0
    while True:
        q = urllib.parse.urlencode({"where": "1=1", "outFields": "*", "outSR": 4326, "f": "geojson", "resultOffset": offset,
                                    "resultRecordCount": 200, "maxAllowableOffset": 0.005 if key != "lad" else 0, "geometryPrecision": 4})
        d = json.loads(urllib.request.urlopen(BASE.format(svc) + "?" + q, timeout=120).read())
        feats += d["features"]
        if len(d["features"]) < 200: break
        offset += 200
    for f in feats:
        f["geometry"]["coordinates"] = r(f["geometry"]["coordinates"])
        p = f["properties"]
        code = next((v for k, v in p.items() if k.upper().endswith("CD")), None)
        name = next((v for k, v in p.items() if k.upper().endswith("NM")), None)
        f["properties"] = {"code": code, "name": name}
    gj = {"type": "FeatureCollection", "source": {"name": "ONS Open Geography Portal: " + title, "url": "https://geoportal.statistics.gov.uk/",
          "licence": "OGL v3; contains OS data © Crown copyright and database right"}, "features": feats}
    json.dump(gj, open(f"public/data/geo_{key}.json", "w"), separators=(",", ":"))
    print(key, len(feats), feats[0]["properties"])
