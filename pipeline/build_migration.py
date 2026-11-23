"""Irregular migration, asylum, detention, returns and settlement: public/data/migration.json.

Source: Home Office, Immigration system statistics data tables (summary tables, year ending June 2026).
The summary tables are .ods files; they are converted to .xlsx with LibreOffice (soffice) and read with openpyxl.
"""
import json, os, subprocess, sys
import openpyxl

sys.path.insert(0, os.path.dirname(__file__))
from govuk import attachments, download

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw", "migration")
PAGE = "/government/statistical-data-sets/immigration-system-statistics-data-tables"
WANT = {
    "asylum": "Asylum summary tables",
    "ier": "Illegal entry routes to the UK summary tables",
    "returns": "Returns summary tables",
    "detention": "Immigration detention summary tables",
    "settlement": "Settlement summary tables",
    "citizenship": "Citizenship summary tables",
}


def fetch():
    c, att = attachments(PAGE)
    files, urls = {}, {}
    for k, title in WANT.items():
        a = next(x for x in att if x["title"] and x["title"].startswith(title) and x["url"].endswith(".ods"))
        ods = download(a["url"], RAW)
        xlsx = ods[:-4] + ".xlsx"
        if not os.path.exists(xlsx):
            subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", RAW, ods], check=True, capture_output=True)
        files[k], urls[k] = openpyxl.load_workbook(xlsx, read_only=True, data_only=True), a["url"]
    return c, files, urls


def num(x):
    if isinstance(x, (int, float)):
        return x
    return None


def table(wb, sheet, header_first):
    """Rows of a sheet from the header row (whose first cell starts with header_first) to the next blank row."""
    rows = list(wb[sheet].iter_rows(values_only=True))
    i = next(i for i, r in enumerate(rows) if r and isinstance(r[0], str) and r[0].strip().startswith(header_first))
    head = [str(h).strip() if h is not None else "" for h in rows[i]]
    out = []
    for r in rows[i + 1:]:
        if not r or r[0] is None:
            break
        out.append(list(r))
    return head, out


def wide(wb, sheet, header_first, keep_cols=None):
    """Tables with years across the columns: {years: [...], series: {label: [values]}}."""
    head, rows = table(wb, sheet, header_first)
    cols = [j for j, h in enumerate(head) if j > 0 and h and (keep_cols is None or keep_cols(h))]
    return {"years": [head[j].replace(" [p]", "").replace("[Note 9]", "").strip() for j in cols],
            "series": {str(r[0]).strip(): [num(r[j]) for j in cols] for r in rows}}


def long(wb, sheet, header_first):
    """Tables with years down the rows: {cols: [...], rows: [[year, values...]]}."""
    head, rows = table(wb, sheet, header_first)
    while head and not head[-1]:
        head.pop()
    return {"cols": head, "rows": [[str(r[0]).replace(" [p]", "").strip()] + [num(x) for x in r[1:len(head)]] for r in rows]}


def main():
    c, F, U = fetch()
    A, I, R, D, S, C = F["asylum"], F["ier"], F["returns"], F["detention"], F["settlement"], F["citizenship"]
    not_change = lambda h: not h.lower().startswith(("change", "percentage", "%"))

    asy = wide(A, "Asy_00a", "Date", not_change)
    support = wide(A, "Asy_09a", "As at", not_change)
    waiting_dur = wide(A, "Asy_03a", "As at", not_change)
    sb_outcomes = long(A, "Asy_02c", "Outcome")
    inadm = wide(A, "Asy_02e", "Date")

    methods = wide(I, "IER_01", "Method", not_change)
    head, rows = table(I, "IER_02a", "Year")
    months = head[1:13]
    boats_monthly = []
    for r in rows:
        lab = str(r[0])
        if "arrivals" in lab:
            y = int(lab[:4])
            for m, v in enumerate(r[1:13]):
                if num(v) is not None:
                    boats_monthly.append({"y": y, "m": m + 1, "arrivals": v})
        elif "boats" in lab:
            y = int(lab[:4])
            for m, v in enumerate(r[1:13]):
                if num(v) is not None:
                    next(x for x in boats_monthly if x["y"] == y and x["m"] == m + 1)["boats"] = v
    by_nat = wide(I, "IER_02b", "Nationality", not_change)
    claims_nrm = wide(I, "IER_02d", "Year", lambda h: h[:4].isdigit())

    ret = long(R, "Ret_01", "Data of return")
    ret["rows"] = [r for r in ret["rows"] if not r[0].lower().startswith(("change", "percentage"))]
    _, q = table(R, "Ret_06a", "Date of return")
    sb_returns = [{"y": int(str(r[0])[:4]), "n": r[1]} for r in q if "Total" in str(r[0]) or "(Jan - Jun)" in str(r[0])]
    head, rows = table(R, "Ret_03", "Enforced returns")
    ret_nat = {"enforced": [[r[0], num(r[2])] for r in rows if r[0] not in ("Total",)],
               "voluntary": [[r[5], num(r[7])] for r in rows if r[5] not in ("Total",)]}

    det = long(D, "Det_01", "Date")
    det["rows"] = [r for r in det["rows"] if not r[0].lower().startswith(("change", "percentage"))]
    det_leave = long(D, "Det_04a", "Date of leaving")
    det_leave["rows"] = [r for r in det_leave["rows"] if not r[0].lower().startswith(("change", "percentage"))]

    settle = wide(S, "Se_02", "Year", not_change)
    cit = wide(C, "Cit_01", "Year", not_change)

    out = {
        "source": {"name": f"Home Office, {c.get('title')} (year ending June 2026)", "url": "https://www.gov.uk" + PAGE},
        "files": U,
        "asylum": asy, "support": support, "waiting_by_duration": waiting_dur, "small_boat_outcomes": sb_outcomes,
        "inadmissibility": inadm,
        "arrivals_by_method": methods, "boats_monthly": boats_monthly, "boats_by_nationality": by_nat, "boats_claims_nrm": claims_nrm,
        "returns": ret, "small_boat_returns": sb_returns, "returns_by_nationality": ret_nat,
        "detention": det, "detention_leaving": det_leave,
        "settlement": settle, "citizenship": cit,
    }
    path = os.path.join(ROOT, "public", "data", "migration.json")
    json.dump(out, open(path, "w"), indent=1, default=str)
    print("wrote", path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
