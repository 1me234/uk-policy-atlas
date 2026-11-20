"""Generic parser for HMT-style spreadsheet tables: finds the year header row and returns labelled rows."""
import re, openpyxl
YEAR = re.compile(r"^(19|20)\d\d-\d\d$")
def num(x):
    if x is None or x in ("-", "..", ""): return None
    try: return float(x)
    except: return None
def table(path, sheet, label_col=0, stop_at_note=True):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)[sheet]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    title = next((str(c) for r in rows for c in r if c), "")
    hdr_i, cols = None, []
    for i, r in enumerate(rows):
        cols = [(j, str(c).strip()) for j, c in enumerate(r) if c is not None and YEAR.match(str(c).strip())]
        if len(cols) >= 2: hdr_i = i; break
    if hdr_i is None: return None
    unit = next((str(c) for r in rows[:hdr_i+1] for c in r if c and ("£" in str(c) or "per cent" in str(c).lower())), "")
    out = []
    for r in rows[hdr_i+1:]:
        first = cols[0][0]
        parts = [str(c).strip() for c in r[:first] if c is not None and str(c).strip()]
        if not parts: continue
        lab = " – ".join(parts)
        if stop_at_note and re.match(r"^\(\d+\)", lab): break
        vals = [num(r[j]) if j < len(r) else None for j, _ in cols]
        if all(v is None for v in vals): 
            out.append({"label": lab, "header": True}); continue
        out.append({"label": lab, "values": vals})
    return {"title": title, "unit": unit, "years": [c for _, c in cols], "rows": out}
