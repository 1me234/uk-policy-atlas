"""Build the data hub's dataset index: public/data/hub.json.

For every file in public/data it records the source, size, the main tables with their record counts and fields,
and which pages of the atlas read it (found by scanning the useData(...) calls in src/pages and the routes in
src/App.tsx). Run after the other build scripts, since it reads their output.
"""
import json, os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data")

# Subject areas, in the same vocabulary as organisations_catalogue.json
DOMAINS = {
    "assessments": ["nhs", "education", "justice", "councils", "welfare"], "charities": ["charities"], "civil_service": ["civil-service"],
    "contracts": ["spending", "procurement"], "councils": ["councils"], "datasets_backlog": ["meta"], "efs": ["councils"],
    "fiscal": ["spending", "economy"], "geo_icb": ["geography", "nhs"], "geo_lad": ["geography", "councils"], "geo_region": ["geography"],
    "infrastructure": ["infrastructure", "geography"], "legislation": ["law"], "legislation_landmarks": ["law"], "lookup": ["geography"],
    "major_projects": ["projects", "infrastructure"], "nhs_performance": ["nhs"], "oda": ["foreign", "spending"], "organisations": ["civil-service"],
    "organisations_catalogue": ["meta", "research"], "policy_history": ["history"], "population": ["population", "geography"],
    "schools": ["education"], "send": ["education", "councils"], "sim_params": ["spending", "tax", "model"], "spending": ["spending"],
    "stations": ["transport", "infrastructure"], "welfare": ["welfare"], "migration": ["migration", "justice"], "migration_context": ["migration", "law"], "eugenics_history": ["history", "law"], "welfare_la": ["welfare", "councils"], "hub": ["meta"],
}


def tables(d, prefix=""):
    """Main lists in a file: name, record count and the fields of the first record."""
    out = []
    if isinstance(d, list):
        if d and isinstance(d[0], dict):
            out.append({"name": prefix or "(root)", "n": len(d), "fields": list(d[0].keys())[:24]})
        elif d:
            out.append({"name": prefix or "(root)", "n": len(d), "fields": []})
    elif isinstance(d, dict):
        for k, v in d.items():
            if k in ("source", "note") or k.startswith("source_"):
                continue
            if isinstance(v, list) and len(v) >= 3:
                out += tables(v, f"{prefix}.{k}" if prefix else k)
            elif isinstance(v, dict) and len(v) >= 3 and all(isinstance(x, (list, dict)) for x in list(v.values())[:3]) and not prefix:
                out.append({"name": k, "n": len(v), "fields": list(v.keys())[:24], "keyed": True})
    return out


def routes():
    app = open(os.path.join(ROOT, "src", "App.tsx")).read()
    comp_file = dict(re.findall(r'import (\w+) from "\./pages/(\w+)"', app))
    nav = re.findall(r'\["([^"]+)", "([^"]+)", "([^"]+)", (\w+)\]', app)
    by_file = {}
    for group, key, label, comp in nav:
        by_file.setdefault(comp_file.get(comp, comp), []).append({"key": key, "label": label, "group": group})
    return nav, by_file


def users():
    """file -> list of page routes that load it."""
    _, by_file = routes()
    used = {}
    for path in glob.glob(os.path.join(ROOT, "src", "pages", "*.tsx")):
        src = open(path).read()
        name = os.path.basename(path)[:-4]
        names = set()
        for call in re.findall(r"useData\(([^)]*)\)", src):
            names |= set(re.findall(r'"([a-z_0-9]+)"', call))
        m = re.search(r"const INGESTED = \[([^\]]*)\]", src)
        if m:
            names |= set(re.findall(r'"([a-z_0-9]+)"', m.group(1)))
        # Sub-pages (e.g. LabReorg) are reached through their parent route
        pages = by_file.get(name) or [r for f, rs in by_file.items() if name.startswith(f) for r in rs]
        for n in names:
            for r in pages:
                if r not in used.setdefault(n, []):
                    used[n].append(r)
    return used


def main():
    used = users()
    nav, _ = routes()
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "*.json"))):
        key = os.path.basename(path)[:-5]
        if key == "hub":
            continue
        d = json.load(open(path))
        src = d.get("source") if isinstance(d, dict) else None
        extra = [d[k] for k in d if k.startswith("source_")] if isinstance(d, dict) else []
        note = d.get("note") if isinstance(d, dict) else None
        out.append({
            "file": key, "bytes": os.path.getsize(path),
            "source": src.get("name") if isinstance(src, dict) else None,
            "url": src.get("url") if isinstance(src, dict) else None,
            "more_sources": [{"name": s.get("name"), "url": s.get("url")} for s in extra if isinstance(s, dict)],
            "note": (note if isinstance(note, str) else None) or (src.get("note") if isinstance(src, dict) else None),
            "tables": tables(d)[:12], "domains": DOMAINS.get(key, []), "pages": used.get(key, []),
        })
    pages = [{"key": k, "label": l, "group": g} for g, k, l, _ in nav]
    json.dump({"note": "Index of every data file in the atlas, built by pipeline/build_hub.py.", "datasets": out, "pages": pages},
              open(os.path.join(DATA, "hub.json"), "w"), indent=0)
    print(f"hub.json: {len(out)} datasets, {len(pages)} pages")


if __name__ == "__main__":
    main()
