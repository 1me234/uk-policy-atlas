"""NHS England performance from NHS England's published statistical press notices (PDF).

NHS England's statistics web pages sit behind a bot check, but the files they link to download
normally. URLs below were found by web search; add new months to RTT_SPNS as they are published.
Writes public/data/nhs_performance.json.
"""
import json, os, re, subprocess, urllib.request

B = "https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/"
RTT_SPNS = [
    "2025/11/Sep25-RTT-SPN-Publication-PDF-464K-87700.pdf",
    "2025/12/Oct25-RTT-SPN-Publication-PDF-452K-SrRW6y.pdf",
    "2026/01/Nov25-RTT-SPN-Publication-PDF-458K-1Xmjkk.pdf",
    "2026/02/Dec25-RTT-SPN-Publication-PDF-464K-6jPlxd.pdf",
    "2026/04/Feb26-RTT-SPN-Publication-PDF-552K-9j03fJT.pdf",
    "2026/05/Mar26-RTT-statistical-press-notice-PDF-545K-Dc1i9U.pdf",
    "2026/07/May26-RTT-statistical-press-notice-PDF-574K-3jBgba.pdf",
    "2026/08/Jun26-RTT-statistical-press-notice-PDF-579K-6jPlxd.pdf",
    "2026/09/Jul26-RTT-statistical-press-notice-PDF-578K-97ylx5.pdf",
    "2026/10/Aug26-RTT-statistical-press-notice-PDF-389K-vjgRdG.pdf",
    "2026/11/Sep26-RTT-SPN-publication-PDF-391K-ojyW5x.pdf",
]
CANCER = "2026/07/Cancer-Waiting-Times-Statistical-Release-May-2026-Provider-based-Provisional.pdf"
DIAG = "2026/09/DWTA-July-2026-Report_5WSGC.pdf"
AMB = "2026/06/20260611-AQI-Stats-Note-k58VJ.pdf"


def text(path):
    dest = os.path.join("raw/nhs", os.path.basename(path))
    if not os.path.exists(dest):
        os.makedirs("raw/nhs", exist_ok=True)
        urllib.request.urlretrieve(B + path, dest)
    return subprocess.run(["pdftotext", "-layout", dest, "-"], capture_output=True, text=True).stdout


def num(s):
    return float(s.replace(",", ""))


def million(s):
    return num(s) * 1e6


monthly = []
for p in RTT_SPNS:
    t = re.sub(r"\s+", " ", text(p))
    m = re.search(r"end of (\w+ \d{4}) was ([\d.]+) million", t)
    r = {"month": m.group(1), "file": B + p, "waiting": million(m.group(2))}
    for k, pat in {"over52": r"in ([\d,]+) cases the patient was waiting more than 52 weeks",
                   "over65": r"([\d,]+) cases they were waiting more than 65 weeks",
                   "over78": r"([\d,]+) cases they were waiting more than 78 weeks",
                   "over104": r"([\d,]+) cases they were waiting more than 104",
                   "within18_pct": r"In ([\d.]+)% of cases the patient had been waiting up to 18",
                   "clock_starts": r"([\d,]+) new RTT pathways were started",
                   "admitted": r"([\d,]+) pathways were completed as a result of admitted",
                   "non_admitted": r"and ([\d,]+) were completed in other ways",
                   "median_weeks": r"median waiting time was ([\d.]+) weeks",
                   "p92_weeks": r"92nd percentile waiting time was ([\d.]+) weeks",
                   "unique_patients_m": r"unique patients is estimated to be around ([\d.]+) million"}.items():
        mm = re.search(pat, t)
        r[k] = num(mm.group(1)) if mm else None
    monthly.append(r)

latest = text(RTT_SPNS[-1])
lines = latest.splitlines()
i = next(i for i, l in enumerate(lines) if l.startswith("Table 1"))
spec = []
for l in lines[i:]:
    m = re.match(r"^(\S.*?)\s{2,}([\d,]+)\s+([\d.]+)%\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$", l)
    if m:
        spec.append({"name": m.group(1).replace(" Service", ""), "waiting": num(m.group(2)), "within18_pct": num(m.group(3)),
                     "admitted": num(m.group(4)), "non_admitted": num(m.group(5)), "new": num(m.group(6))})
    if l.startswith("Table 2"):
        break
j = next(i for i, l in enumerate(lines) if l.startswith("Table 2"))
long = []
for l in lines[j:]:
    m = re.match(r"^\s*(\w{3}-\d\d)\*?\s+([\d.]+)\s+([\d.]+\+?)\s+([\d.]+)%", l)
    if m:
        long.append({"month": m.group(1), "median_weeks": num(m.group(2)), "p92_weeks": None if "+" in m.group(3) else num(m.group(3)), "within18_pct": num(m.group(4))})
    elif long and l.startswith("Notes"):
        break

c = re.sub(r"\s+", " ", text(CANCER))
cancer = {"month": "May 2026", "file": B + CANCER,
          "fds_pct": num(re.search(r"([\d.]+)% of people were told", c).group(1)),
          "d31_pct": num(re.search(r"([\d.]+)% of people treated began first or subsequent", c).group(1)),
          "d62_pct": num(re.search(r"([\d.]+)% of people treated began first definitive", c).group(1)),
          "targets": {"fds_pct": 80, "d31_pct": 96, "d62_pct": 85},
          "target_note": "Operational targets: 80% FDS by March 2026, 96% 31-day, 85% 62-day (constitutional)."}

d = re.sub(r"\s+", " ", text(DIAG))
diag = {"month": "July 2026", "file": B + DIAG,
        "over6w": num(re.search(r"end of July 2026 was ([\d,]+)\.", d).group(1)),
        "over6w_pct": num(re.search(r"This was ([\d.]+)% of the total", d).group(1)),
        "waiting": num(re.search(r"There were ([\d,]+) patients waiting for a key diagnostic", d).group(1)),
        "median_weeks": num(re.search(r"waiting for a diagnostic test was ([\d.]+) weeks", d).group(1)),
        "standard_pct": 1}

a = re.sub(r"\s+", " ", text(AMB))
amb = {"month": "May 2026", "file": B + AMB,
       "c1_mean": "7:52", "c1_target": "7:00", "c2_mean": re.search(r"C2 average was ([\d:]+)", a).group(1), "c2_target": "18:00 (interim 30:00)",
       "c3_mean": re.search(r"C3 average was ([\d:]+)", a).group(1), "c4_mean": re.search(r"C4 mean was ([\d:]+)", a).group(1)}
assert "7 minutes 52" in a

out = {"source": {"name": "NHS England statistical press notices: RTT waiting times (Sep 2025 to Sep 2026), cancer waiting times, diagnostic waiting times, ambulance quality indicators",
                  "url": "https://www.england.nhs.uk/statistics/", "file": B + RTT_SPNS[-1],
                  "note": "Headline figures parsed from the PDF press notices. Full trust-level data sits on NHS England pages that block automated access."},
       "rtt_monthly": monthly, "rtt_by_specialty": spec, "rtt_long": long, "cancer": cancer, "diagnostics": diag, "ambulance": amb}
json.dump(out, open("public/data/nhs_performance.json", "w"), indent=1)
print(len(monthly), "months;", len(spec), "specialties;", len(long), "long rows")
print(monthly[-1]); print(cancer, diag, amb)
