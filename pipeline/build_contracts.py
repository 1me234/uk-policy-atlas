"""Contracts Finder (OCDS) award notices for the last 12 months: buyers, suppliers, values.
Large awards (>= £1m) kept individually; all awards aggregated by buyer and supplier."""
import json, urllib.request, urllib.parse, time, datetime, os
from collections import defaultdict
UA = {"User-Agent": "uk-policy-atlas/0.1"}
END = datetime.date(2026, 11, 20); START = END - datetime.timedelta(days=365)
BIG = 1_000_000
big, buyers, suppliers, n = [], defaultdict(lambda: [0, 0.0]), defaultdict(lambda: [0, 0.0]), 0
day = START
while day < END:
    nxt = min(day + datetime.timedelta(days=7), END)
    url = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?" + urllib.parse.urlencode(
        {"publishedFrom": f"{day}T00:00:00", "publishedTo": f"{nxt}T00:00:00", "stages": "award", "limit": 100})
    while url:
        for attempt in range(5):
            try: d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()); break
            except Exception as e: print("retry", e, flush=True); time.sleep(10 * (attempt + 1)); d = None
        if not d: break
        for r in d.get("releases", []):
            for a in r.get("awards", []) or [{}]:
                v = (a.get("value") or r.get("tender", {}).get("value") or {}).get("amount") or 0
                buyer = (r.get("buyer") or {}).get("name") or "?"
                sups = [s.get("name") for s in a.get("suppliers", []) or []]
                n += 1
                buyers[buyer][0] += 1; buyers[buyer][1] += v
                for s in sups: suppliers[s][0] += 1; suppliers[s][1] += v / max(len(sups), 1)
                if v >= BIG:
                    t = r.get("tender", {})
                    pc = next((x.get("postalCode") for it in t.get("items", []) or [] for x in it.get("deliveryAddresses", []) or [] if x.get("postalCode")), None)
                    big.append({"id": r.get("ocid"), "title": t.get("title"), "buyer": buyer, "suppliers": sups, "value": v,
                                "date": (a.get("date") or r.get("date") or "")[:10], "cpv": (t.get("classification") or {}).get("description"),
                                "category": t.get("mainProcurementCategory"), "method": t.get("procurementMethodDetails"),
                                "sme": (t.get("suitability") or {}).get("sme"), "postcode": pc,
                                "start": (a.get("contractPeriod") or {}).get("startDate", "")[:10], "end": (a.get("contractPeriod") or {}).get("endDate", "")[:10]})
        url = (d.get("links") or {}).get("next")
        time.sleep(0.3)
    print(day, n, len(big), flush=True)
    day = nxt
top = lambda dd: sorted(([k, c, round(v)] for k, (c, v) in dd.items()), key=lambda x: -x[2])
json.dump({"source": {"name": f"Contracts Finder OCDS API, award notices published {START} to {END}", "url": "https://www.contractsfinder.service.gov.uk/",
                      "note": "Since the Procurement Act 2023 took effect (24 Feb 2025) many above-threshold notices appear only on Find a Tender; values are as published and can include framework ceilings."},
           "n_awards": n, "large_awards": sorted(big, key=lambda x: -x["value"]),
           "buyers": top(buyers)[:1500], "suppliers": top(suppliers)[:3000]},
          open("public/data/contracts.json", "w"), separators=(",", ":"))
print("done", n, len(big))
