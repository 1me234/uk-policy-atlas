// Civil service reorganisation mini-sim: merging departments, moving posts out of London, changing spans of
// control and automating routine work. Every effect is a parameter. Uncertain ones are drawn at random in each
// of many runs, so the result is a range, not a single number. Money is £m a year in today's prices.
export type Dept = { name: string; headcount: number; grades: Record<string, number>; london: number; salary: number };
export type ReorgParam = { id: string; group: string; label: string; value: number; unit: string; min: number; max: number; step: number; kind: "official" | "research" | "assumption"; note?: string; spread?: number };

export const GRADES = ["SCS", "Grade 6/7", "SEO/HEO", "EO", "AO/AA"] as const;
export const RP: ReorgParam[] = [
  { id: "sal_SCS", group: "Pay", label: "Median pay, Senior Civil Service", value: 95, unit: "£k", min: 60, max: 160, step: 1, kind: "official", note: "Civil Service Statistics 2025, medians by grade (approximate)." },
  { id: "sal_G67", group: "Pay", label: "Median pay, Grades 6 and 7", value: 62, unit: "£k", min: 40, max: 90, step: 1, kind: "official" },
  { id: "sal_HEO", group: "Pay", label: "Median pay, SEO and HEO", value: 40, unit: "£k", min: 25, max: 60, step: 1, kind: "official" },
  { id: "sal_EO", group: "Pay", label: "Median pay, EO", value: 31, unit: "£k", min: 20, max: 45, step: 1, kind: "official" },
  { id: "sal_AO", group: "Pay", label: "Median pay, AO and AA", value: 25, unit: "£k", min: 18, max: 35, step: 1, kind: "official" },
  { id: "oncost", group: "Pay", label: "Employer on-costs (pension, NI)", value: 30, unit: "%", min: 15, max: 45, step: 1, kind: "assumption" },
  { id: "turnover", group: "Pay", label: "Staff leaving each year anyway", value: 8, unit: "%", min: 3, max: 15, step: 0.5, kind: "official", note: "Civil service turnover has run at 7% to 10% a year. Cuts within natural turnover need no exit payments." },
  { id: "severance", group: "Pay", label: "Exit payment per compulsory or voluntary exit", value: 0.75, unit: "× salary", min: 0.2, max: 1.75, step: 0.05, kind: "assumption", note: "The Civil Service Compensation Scheme pays up to 21 months for compulsory exits." },
  // Mergers
  { id: "mog_cost", group: "Mergers", label: "Direct one-off cost per department merged in", value: 15, unit: "£m", min: 2, max: 60, step: 1, kind: "research", note: "NAO, Reorganising central government (2010): about £15m per reorganisation, with benefits rarely measured.", spread: 0.5 },
  { id: "dip", group: "Mergers", label: "Productivity lost in the merged department, first year", value: 5, unit: "%", min: 0, max: 20, step: 0.5, kind: "assumption", note: "Institute for Government, Making and breaking Whitehall departments (2010): mergers take two years or more to bed in.", spread: 0.6 },
  { id: "dip_years", group: "Mergers", label: "Years before productivity recovers", value: 2, unit: "years", min: 1, max: 5, step: 0.5, kind: "assumption", spread: 0.4 },
  { id: "corp_share", group: "Mergers", label: "Share of staff in corporate functions", value: 15, unit: "%", min: 5, max: 30, step: 1, kind: "assumption", note: "HR, finance, digital, commercial, property and communications." },
  { id: "overlap", group: "Mergers", label: "Corporate posts saved by combining functions", value: 20, unit: "%", min: 0, max: 50, step: 1, kind: "assumption", spread: 0.6 },
  { id: "top_team", group: "Mergers", label: "Senior posts removed per department merged in", value: 25, unit: "posts", min: 0, max: 80, step: 1, kind: "assumption", note: "A permanent secretary, directors general, their offices and private offices." },
  // Relocation
  { id: "reloc_years", group: "Moving posts out of London", label: "Years to move the posts", value: 4, unit: "years", min: 1, max: 10, step: 1, kind: "assumption" },
  { id: "reloc_cost", group: "Moving posts out of London", label: "One-off cost per post moved", value: 15, unit: "£k", min: 2, max: 50, step: 1, kind: "assumption", note: "New offices, fit-out, IT, double running.", spread: 0.4 },
  { id: "reloc_saving", group: "Moving posts out of London", label: "Yearly saving per post moved", value: 10, unit: "£k", min: 0, max: 25, step: 0.5, kind: "assumption", note: "London pay allowances and the gap in office cost per desk between London and the regions (Government Property Agency).", spread: 0.3 },
  { id: "refuse", group: "Moving posts out of London", label: "Staff who leave rather than move", value: 70, unit: "%", min: 10, max: 95, step: 1, kind: "research", note: "Past relocations lost most staff: the ONS move to Newport lost about nine in ten in some teams (Public Accounts Committee, 2007).", spread: 0.2 },
  { id: "replace", group: "Moving posts out of London", label: "Cost of replacing a leaver (recruitment, training, lost output)", value: 0.75, unit: "× salary", min: 0.1, max: 2, step: 0.05, kind: "assumption", spread: 0.4 },
  // Spans
  { id: "mgr_g67", group: "Spans and layers", label: "Share of Grade 6 and 7 staff who line-manage", value: 50, unit: "%", min: 0, max: 100, step: 5, kind: "assumption", note: "Many Grade 7s are policy or technical specialists without reports. The Senior Civil Service is counted as all managers." },
  { id: "heo_mgr", group: "Spans and layers", label: "Share of SEO/HEO staff who line-manage", value: 30, unit: "%", min: 0, max: 100, step: 5, kind: "assumption" },
  { id: "mgr_eo", group: "Spans and layers", label: "Share of EO staff who line-manage", value: 10, unit: "%", min: 0, max: 50, step: 5, kind: "assumption" },
  { id: "mgmt_time", group: "Spans and layers", label: "Share of a manager's time spent managing", value: 30, unit: "%", min: 5, max: 80, step: 5, kind: "assumption", note: "Widening spans frees management time, not whole people: managers who lose their reports still do their other work. Posts saved = managers no longer needed × this share.", spread: 0.5 },
  { id: "span_limit", group: "Spans and layers", label: "Span beyond which oversight suffers", value: 10, unit: "reports", min: 4, max: 20, step: 1, kind: "research", note: "Graicunas (1933) showed a manager's possible relationships grow exponentially with reports; modern studies put effective spans for knowledge work at roughly 6 to 12.", spread: 0.3 },
  { id: "span_penalty", group: "Spans and layers", label: "Output lost per report above that limit", value: 1.5, unit: "%", min: 0, max: 5, step: 0.1, kind: "assumption", spread: 0.6 },
  // Automation
  { id: "auto_years", group: "Automation", label: "Years to reach full adoption", value: 5, unit: "years", min: 2, max: 10, step: 1, kind: "assumption" },
  { id: "auto_success", group: "Automation", label: "Chance the programme delivers", value: 60, unit: "%", min: 10, max: 100, step: 5, kind: "research", note: "Most large government IT programmes in the Major Projects Portfolio are rated amber or red; this is the chance of broadly delivering." },
  { id: "auto_build", group: "Automation", label: "One-off cost per post freed", value: 25, unit: "£k", min: 5, max: 100, step: 1, kind: "assumption", spread: 0.5 },
  { id: "auto_run", group: "Automation", label: "Running cost per post freed", value: 3, unit: "£k a year", min: 0, max: 15, step: 0.5, kind: "assumption" },
  { id: "discount", group: "Appraisal", label: "Discount rate", value: 3.5, unit: "%", min: 0, max: 10, step: 0.5, kind: "official", note: "HM Treasury Green Book social time preference rate." },
];
export const defaultReorgParams = () => Object.fromEntries(RP.map((p) => [p.id, p.value])) as Record<string, number>;

export type Plan = { merges: string[][]; relocatePct: number; span: number; automatePct: number; scope: string[] };
export type ReorgYear = { y: number; headcount: number; paybill: number; oneOff: number; productivity: number; net: number };

const salaryOf = (P: Record<string, number>) => ({ "SCS": P.sal_SCS, "Grade 6/7": P.sal_G67, "SEO/HEO": P.sal_HEO, "EO": P.sal_EO, "AO/AA": P.sal_AO } as Record<string, number>);
export function spanOf(g: Record<string, number>, P: Record<string, number>) {
  const mgr = (g["SCS"] || 0) + (P.mgr_g67 / 100) * (g["Grade 6/7"] || 0) + (P.heo_mgr / 100) * (g["SEO/HEO"] || 0) + (P.mgr_eo / 100) * (g["EO"] || 0);
  const total = GRADES.reduce((s, k) => s + (g[k] || 0), 0);
  return { managers: mgr, staff: total - mgr, span: (total - mgr) / Math.max(1, mgr) };
}
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function runReorg(depts: Dept[], plan: Plan, P0: Record<string, number>, seed: number, years = 10) {
  const r = rng(seed);
  // Draw each uncertain parameter from a triangular-ish range around its value
  const P: Record<string, number> = { ...P0 };
  if (seed) for (const p of RP) if (p.spread) { const u = (r() + r() + r()) / 3 * 2 - 1; P[p.id] = Math.max(p.min, Math.min(p.max * 1.5, P0[p.id] * (1 + p.spread * u))); }
  const S = salaryOf(P), oc = 1 + P.oncost / 100;
  const inScope = depts.filter((d) => plan.scope.length === 0 || plan.scope.includes(d.name));
  const G: Record<string, number> = {}; for (const k of GRADES) G[k] = inScope.reduce((s, d) => s + (d.grades[k] || 0), 0);
  const H0 = GRADES.reduce((s, k) => s + G[k], 0);
  const avgSal = GRADES.reduce((s, k) => s + G[k] * S[k], 0) / Math.max(1, H0);
  const paybill0 = (H0 * avgSal * oc) / 1000; // £m
  const out: ReorgYear[] = [];
  // Mergers
  const merged = plan.merges.filter((m) => m.length > 1).map((m) => { const ds = depts.filter((d) => m.includes(d.name)); const h = ds.reduce((s, d) => s + d.headcount, 0); return { k: ds.length, h, pay: ds.reduce((s, d) => s + d.headcount * d.salary, 0) / 1e6 * oc }; });
  const mergeOneOff = merged.reduce((s, m) => s + (m.k - 1) * P.mog_cost, 0);
  const mergePosts = merged.reduce((s, m) => s + m.h * (P.corp_share / 100) * (P.overlap / 100) + (m.k - 1) * P.top_team, 0);
  // Relocation
  const london = inScope.reduce((s, d) => s + d.london, 0), moved = (plan.relocatePct / 100) * london;
  // Spans
  const cur = spanOf(G, P);
  const targetMgr = plan.span > 0 ? cur.staff / plan.span : cur.managers;
  const dMgr = Math.min(0, targetMgr - cur.managers) * (P.mgmt_time / 100); // posts saved: management time freed; negative
  const mgrSal = ((P.mgr_g67 / 100) * G["Grade 6/7"] * S["Grade 6/7"] + (P.heo_mgr / 100) * G["SEO/HEO"] * S["SEO/HEO"]) / Math.max(1, (P.mgr_g67 / 100) * G["Grade 6/7"] + (P.heo_mgr / 100) * G["SEO/HEO"]);
  const spanNow = plan.span > 0 ? Math.max(plan.span, cur.span) : cur.span;
  const overSpan = Math.max(0, spanNow - P.span_limit) - Math.max(0, cur.span - P.span_limit);
  // Automation
  const works = seed ? r() < P.auto_success / 100 : true;
  const realised = seed ? (works ? 0.6 + 0.5 * r() : 0.1 * r()) : P.auto_success / 100;
  const autoPosts = (plan.automatePct / 100) * (G["EO"] + G["AO/AA"]) * realised;
  const lowSal = (G["EO"] * S["EO"] + G["AO/AA"] * S["AO/AA"]) / Math.max(1, G["EO"] + G["AO/AA"]);
  let npv = 0, cum = 0, payback: number | null = null, cumMoved = 0, cumAuto = 0, exitsNeeded = 0;
  for (let y = 0; y < years; y++) {
    let oneOff = 0, saving = 0, prodLoss = 0, posts = 0;
    // Mergers: costs now, a dip that fades, savings phased in over years 2 to 4
    if (y === 0) oneOff += mergeOneOff;
    for (const m of merged) prodLoss += m.pay * (P.dip / 100) * Math.max(0, 1 - y / P.dip_years);
    const mergePhase = Math.min(1, Math.max(0, y) / 3);
    posts += mergePosts * mergePhase;
    saving += (mergePosts * mergePhase * avgSal * oc) / 1000;
    // Relocation: an equal share each year; leavers replaced at a cost
    const step = y < P.reloc_years ? moved / P.reloc_years : 0;
    cumMoved += step;
    oneOff += (step * P.reloc_cost) / 1000 + (step * (P.refuse / 100) * P.replace * avgSal) / 1000;
    saving += (cumMoved * P.reloc_saving) / 1000;
    // Spans: managers removed in year 1; output lost if spans go past the limit
    if (y === 0 && dMgr < 0) { const exits = Math.max(0, -dMgr - (P.turnover / 100) * cur.managers * 2); /* two years of turnover absorb part of it */ oneOff += (exits * mgrSal * P.severance) / 1000; }
    if (dMgr < 0) { saving += (-dMgr * mgrSal * oc) / 1000; posts += -dMgr; }
    prodLoss += paybill0 * (overSpan * P.span_penalty) / 100;
    // Automation: S-curve adoption; build costs as posts are freed; exits beyond natural turnover cost severance
    const adopt = 1 / (1 + Math.exp(-(y + 1 - P.auto_years / 2) * (6 / P.auto_years)));
    const target = autoPosts * adopt, newly = Math.max(0, target - cumAuto); cumAuto = target;
    oneOff += (newly * P.auto_build) / 1000;
    if (seed && !works && y < P.auto_years) oneOff += ((plan.automatePct / 100) * (G["EO"] + G["AO/AA"]) * 0.6 * P.auto_build) / 1000 / P.auto_years; // money spent on a programme that fails
    exitsNeeded = Math.max(0, newly - (P.turnover / 100) * (G["EO"] + G["AO/AA"]) * 0.5);
    oneOff += (exitsNeeded * lowSal * P.severance) / 1000;
    saving += (cumAuto * lowSal * oc) / 1000 - (cumAuto * P.auto_run) / 1000;
    posts += cumAuto;
    const net = saving - oneOff - prodLoss;
    cum += net; if (payback == null && cum > 0 && y > 0) payback = y;
    npv += net / Math.pow(1 + P.discount / 100, y);
    out.push({ y, headcount: H0 - posts, paybill: paybill0 - saving, oneOff, productivity: 100 - (prodLoss / paybill0) * 100, net });
  }
  return { years: out, npv, payback, H0, paybill0, cur, targetMgr, dMgrPosts: dMgr, moved, autoPosts, mergePosts, overSpan, works };
}

export type Dist = { p10: number; p50: number; p90: number };
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
const dist = (a: number[]): Dist => ({ p10: q(a, 0.1), p50: q(a, 0.5), p90: q(a, 0.9) });
export function reorgMonteCarlo(depts: Dept[], plan: Plan, P: Record<string, number>, runs = 300) {
  const R = Array.from({ length: runs }, (_, i) => runReorg(depts, plan, P, i + 1));
  const central = runReorg(depts, plan, P, 0);
  const yrs = central.years.map((_, y) => ({ y, net: dist(R.map((x) => x.years[y].net)), productivity: dist(R.map((x) => x.years[y].productivity)), headcount: dist(R.map((x) => x.years[y].headcount)) }));
  const paybacks = R.map((x) => x.payback ?? 99);
  return { central, npv: dist(R.map((x) => x.npv)), pLoss: R.filter((x) => x.npv < 0).length / runs, payback: dist(paybacks), yrs, failRate: R.filter((x) => !x.works).length / runs };
}

// Management structure: how layers, managers and cost change with the span of control.
export function hierarchy(N: number, span: number, sal = { mgr: 60, staff: 32 }) {
  let layers = 0, level = N, managers = 0;
  while (level > 1) { level = Math.ceil(level / span); managers += level; layers++; }
  const graicunas = span * (Math.pow(2, span - 1) + span - 1); // possible relationships a manager must handle
  return { layers, managers, cost: (managers * sal.mgr + (N - managers) * sal.staff) / 1000, graicunas, hops: 2 * layers };
}
