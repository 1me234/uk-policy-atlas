"""Exceptional Financial Support (capitalisation directions) agreed for English councils, 2020-21 to 2026-27,
from MHCLG's yearly GOV.UK guidance pages. Writes public/data/efs.json (£m by council by year, latest stated figure)."""
import html, json, re, urllib.request
YEARS = ["2020-21", "2021-22", "2022-23", "2023-24", "2024-25", "2025-26", "2026-27"]
def body(y):
    u = f"https://www.gov.uk/api/content/guidance/exceptional-financial-support-for-local-authorities-for-{y}"
    try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "uk-policy-atlas"}), timeout=60).read())["details"]["body"]
    except Exception as e: print(y, "missing", e); return ""
money = lambda s: float(s.replace(",", ""))
out = {}
for y in YEARS:
    b = body(y)
    for tr in re.findall(r"<tr>(.*?)</tr>", b, re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", " ", c)).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if len(cells) < 2 or not cells[0] or cells[0].lower().startswith("local authority"): continue
        name = re.sub(r"\s+", " ", cells[0]); txt = " ".join(cells[1:])
        if re.match(r"^\d{4}-\d\d$", name): continue
        m = re.search(r"£\s?([\d,.]+)\s?(m|million|bn)?", txt)
        if not m: continue
        v = money(m.group(1)) * (1000 if m.group(2) == "bn" else 1)
        out.setdefault(name, {})[y] = {"m": v, "text": re.sub(r"\s+", " ", txt)[:300]}
def norm(n): return re.sub(r"\b(ua|cc|bc|dc|towns|city|council|borough|of|the|md|lb)\b", "", n.lower().replace("&", "and")).replace(" ", "")
cj = json.load(open("public/data/councils.json"))
codes = {norm(a["name"]): a["code"] for a in cj["authorities"] if a["class"] not in ("O", "Eng")}
merged = {}
for n, v in out.items():
    k = norm(n); merged.setdefault(k, {"name": n, "code": codes.get(k), "years": {}})["years"].update(v)
out = {m["name"]: m for m in merged.values()}
res = {"source": {"name": "MHCLG, Exceptional Financial Support for local authorities (yearly decisions, 2020-21 to 2026-27)", "url": "https://www.gov.uk/government/collections/exceptional-financial-support-for-local-authorities", "note": "Figure shown is the first amount stated for each year (capitalisation agreed or agreed in principle). Later revisions noted in the text. Councils use this permission to fund day-to-day costs from borrowing or asset sales."},
       "years": YEARS, "councils": out}
json.dump(res, open("public/data/efs.json", "w"), indent=0)
tot = {y: round(sum(c["years"][y]["m"] for c in out.values() if y in c["years"]), 1) for y in YEARS}
print(len(out), "councils;", tot, [n for n, c in out.items() if not c["code"]])
