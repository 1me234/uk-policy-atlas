"""GOV.UK organisations register: every department, agency and public body with parent/child links."""
import json, urllib.request
UA = {"User-Agent": "uk-policy-atlas/0.1"}
orgs, page = [], 1
while True:
    d = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://www.gov.uk/api/organisations?page={page}", headers=UA), timeout=60).read())
    for o in d["results"]:
        det = o.get("details", {})
        orgs.append({
            "id": det.get("slug"), "name": o.get("title"), "acronym": det.get("abbreviation"),
            "format": o.get("format"), "status": det.get("govuk_status"), "closed_at": det.get("closed_at"),
            "url": o.get("web_url"),
            "parents": [p["id"].rsplit("/", 1)[-1] for p in o.get("parent_organisations", [])],
            "children": [c["id"].rsplit("/", 1)[-1] for c in o.get("child_organisations", [])],
            "superseded_by": [c["id"].rsplit("/", 1)[-1] for c in o.get("superseding_organisations", [])],
        })
    if page >= d.get("pages", 1): break
    page += 1
json.dump({"source": {"name": "GOV.UK Organisations API", "url": "https://www.gov.uk/api/organisations"}, "organisations": orgs},
          open("public/data/organisations.json", "w"), separators=(",", ":"))
from collections import Counter
print(len(orgs), Counter(o["format"] for o in orgs).most_common(12), Counter(o["status"] for o in orgs))
