// UK system model: propagates policy levers through fiscal, macro and service channels, year by year,
// against the OBR baseline. Pure functions, no React, so the drafting workspace and sandbox can reuse it.
//
// Order of calculation each run:
//   1. Services and people (NHS, social care, schools, benefits, housing, prisons, police, labour supply),
//      once for the scenario and once for the baseline, so every knock-on is a difference between the two.
//   2. Money: tax receipts (HMRC ready reckoner), spending by programme, Barnett consequentials,
//      and the fiscal knock-ons from step 1 (benefits for people out of work, housing benefit, prison running costs).
//   3. Economy: demand (OBR multipliers, fading), supply (public investment, labour supply, housebuilding).
//   4. Feedback: automatic stabilisers, debt interest, borrowing and debt; fiscal rules; events; scorecard.
import type { ParamValues } from "./params";

export const YEARS = ["2026-27", "2027-28", "2028-29", "2029-30", "2030-31", "2031-32", "2032-33", "2033-34", "2034-35", "2035-36"];
export const RULE_YEAR = "2029-30"; // fiscal rules are assessed in this year
export const LAST_FORECAST = YEARS.indexOf("2031-32"); // years after this are extrapolated, not OBR forecast

export type Project = { id: string; name: string; dept: string; fy: number; end: number; dca: string; kind: "prison" | "homes" | "other" };
export type Baseline = {
  years: string[];
  gdp: number[]; deflator: number[]; receipts: number[]; tme: number[]; psnb: number[]; psnd: number[]; psnfl: number[];
  cbd: number[]; psni: number[]; interest: number[]; outputGap: number[];
  welfare: number[]; nhsEngland: number; csHeadcount: number; hmrcHeadcount: number;
  waiting: number; completedPerMonth: number; referralsPerMonth: number; waitingMonth: string;
  la: { socialCare: number; usableReserves: number; dsgDeficit: number };
  rdel: Record<string, number>;
  projects: Project[];
  trr: Record<string, number[]>; trrYears: string[];
  sources: { name: string; url?: string }[];
};

export type Levers = {
  start: number; // index into YEARS of the first year the policy applies
  basicRate: number; higherRate: number; addRate: number; personalAllowancePct: number;
  employeeNics: number; employerNics: number; vat: number; corpTax: number; fuelDutyPct: number; councilTaxPp: number;
  dHO: number; dMoJ: number; dDfT: number; dDEFRA: number; dDESNZ: number; dDSIT: number; dFCDO: number; dDCMS: number; dDWP: number; dHMRC: number;
  nhs: number; socialCare: number; nhsProductivity: number;
  schools: number; highNeeds: number; teacherPay: number; earlyYears: number;
  welfare: number; ucStandardPct: number; statePensionPct: number; healthBenefitsPct: number;
  councils: number; housebuilding: number; planningPct: number;
  prisonCapital: number; sentencingPct: number;
  defence: number; otherDept: number; capital: number;
  civilServicePct: number; hmrcStaff: number;
  giltShock: number; demandShock: number; netMigration: number;
  projects?: Record<string, number>; // project id → % change in annual spend (-100 cancels)
};
export const ZERO: Levers = { start: 1, basicRate: 0, higherRate: 0, addRate: 0, personalAllowancePct: 0, employeeNics: 0, employerNics: 0, vat: 0, corpTax: 0, fuelDutyPct: 0, councilTaxPp: 0,
  dHO: 0, dMoJ: 0, dDfT: 0, dDEFRA: 0, dDESNZ: 0, dDSIT: 0, dFCDO: 0, dDCMS: 0, dDWP: 0, dHMRC: 0,
  nhs: 0, socialCare: 0, nhsProductivity: 0, schools: 0, highNeeds: 0, teacherPay: 0, earlyYears: 0,
  welfare: 0, ucStandardPct: 0, statePensionPct: 0, healthBenefitsPct: 0, councils: 0, housebuilding: 0, planningPct: 0,
  prisonCapital: 0, sentencingPct: 0, defence: 0, otherDept: 0, capital: 0, civilServicePct: 0, hmrcStaff: 0,
  giltShock: 0, demandShock: 0, netMigration: 0 };

type NumKey = Exclude<keyof Levers, "projects">;
export type LeverDef = { k: NumKey; group: string; label: string; unit: string; min: number; max: number; step: number; help?: string };
const G = { tax: "Tax", dept: "Departments (real % change in day-to-day budget)", health: "Health and care", kids: "Schools and children", ss: "Social security",
  places: "Councils and housing", justice: "Justice", other: "Defence, investment and other spending", mog: "Machinery of government", shock: "Shocks and population" };
export const LEVERS: LeverDef[] = [
  { k: "basicRate", group: G.tax, label: "Income tax basic rate", unit: "pp", min: -5, max: 5, step: 1 },
  { k: "higherRate", group: G.tax, label: "Income tax higher rate", unit: "pp", min: -5, max: 5, step: 1 },
  { k: "addRate", group: G.tax, label: "Income tax additional rate", unit: "pp", min: -5, max: 10, step: 1, help: "HMRC costs rises and cuts differently because top earners respond strongly." },
  { k: "personalAllowancePct", group: G.tax, label: "Personal allowance", unit: "%", min: -20, max: 50, step: 1 },
  { k: "employeeNics", group: G.tax, label: "Employee NICs main rate", unit: "pp", min: -8, max: 4, step: 1 },
  { k: "employerNics", group: G.tax, label: "Employer NICs rate", unit: "pp", min: -5, max: 5, step: 0.5 },
  { k: "vat", group: G.tax, label: "VAT standard rate", unit: "pp", min: -5, max: 5, step: 1 },
  { k: "corpTax", group: G.tax, label: "Corporation tax main rate", unit: "pp", min: -10, max: 10, step: 1 },
  { k: "fuelDutyPct", group: G.tax, label: "Fuel duty", unit: "%", min: -20, max: 30, step: 1 },
  { k: "councilTaxPp", group: G.tax, label: "Council tax: extra rise allowed each year", unit: "pp", min: -3, max: 5, step: 0.5, help: "Added to the referendum limit every year, so it compounds. The money stays with councils and eases their reserves." },
  { k: "dHO", group: G.dept, label: "Home Office (police, borders)", unit: "%", min: -20, max: 30, step: 1, help: "About half of extra Home Office money is assumed to reach police forces, which turns into officers." },
  { k: "dMoJ", group: G.dept, label: "Justice (prisons, courts, probation)", unit: "%", min: -20, max: 30, step: 1 },
  { k: "dDfT", group: G.dept, label: "Transport", unit: "%", min: -30, max: 30, step: 1 },
  { k: "dDEFRA", group: G.dept, label: "Environment, food and rural affairs", unit: "%", min: -30, max: 30, step: 1 },
  { k: "dDESNZ", group: G.dept, label: "Energy security and net zero", unit: "%", min: -30, max: 50, step: 1 },
  { k: "dDSIT", group: G.dept, label: "Science, innovation and technology", unit: "%", min: -30, max: 50, step: 1 },
  { k: "dFCDO", group: G.dept, label: "Foreign office and aid", unit: "%", min: -50, max: 50, step: 1 },
  { k: "dDCMS", group: G.dept, label: "Culture, media and sport", unit: "%", min: -30, max: 30, step: 1 },
  { k: "dDWP", group: G.dept, label: "DWP running costs (jobcentres, assessments)", unit: "%", min: -30, max: 30, step: 1 },
  { k: "dHMRC", group: G.dept, label: "HMRC running costs", unit: "%", min: -30, max: 30, step: 1, help: "Cuts here also cut compliance staff, which loses tax." },
  { k: "nhs", group: G.health, label: "NHS England budget", unit: "£bn", min: -20, max: 40, step: 1 },
  { k: "socialCare", group: G.health, label: "Adult social care grant", unit: "£bn", min: -5, max: 15, step: 0.5, help: "Part buys new care capacity, which frees hospital beds held by people fit for discharge; the rest relieves council budgets." },
  { k: "nhsProductivity", group: G.health, label: "Extra NHS productivity growth", unit: "pp/yr", min: -2, max: 4, step: 0.1 },
  { k: "schools", group: G.kids, label: "Core schools budget", unit: "£bn", min: -10, max: 20, step: 0.5 },
  { k: "highNeeds", group: G.kids, label: "High-needs (SEND) funding", unit: "£bn", min: 0, max: 10, step: 0.5 },
  { k: "teacherPay", group: G.kids, label: "Teacher pay above the planned award", unit: "pp", min: -5, max: 10, step: 0.5 },
  { k: "earlyYears", group: G.kids, label: "Funded childcare and early years", unit: "£bn", min: -3, max: 10, step: 0.5, help: "Some parents, mostly mothers, can then work or work more hours." },
  { k: "welfare", group: G.ss, label: "Other welfare spending", unit: "£bn", min: -30, max: 30, step: 1 },
  { k: "ucStandardPct", group: G.ss, label: "Universal Credit standard allowance", unit: "%", min: -20, max: 40, step: 1 },
  { k: "statePensionPct", group: G.ss, label: "State pension level", unit: "%", min: -10, max: 10, step: 0.5 },
  { k: "healthBenefitsPct", group: G.ss, label: "Health and disability benefits", unit: "%", min: -30, max: 20, step: 1, help: "PIP, the UC health element and ESA. Whether cuts move people into work is contested; the default effect is small." },
  { k: "councils", group: G.places, label: "Council core grant", unit: "£bn", min: -10, max: 20, step: 0.5 },
  { k: "housebuilding", group: G.places, label: "Social and affordable housing grant", unit: "£bn", min: -2, max: 15, step: 0.5 },
  { k: "planningPct", group: G.places, label: "Planning reform: extra homes built", unit: "%", min: -20, max: 50, step: 1, help: "The rise in private housebuilding that planning and land reform achieve. Choose how ambitious to be; the model then traces the effects." },
  { k: "prisonCapital", group: G.justice, label: "Prison building", unit: "£bn", min: 0, max: 5, step: 0.25, help: "Capital spending on new places, which open after a three-year lag." },
  { k: "sentencingPct", group: G.justice, label: "Sentencing reform: fewer prisoners", unit: "%", min: -10, max: 20, step: 1, help: "Percentage fall in the prison population, phased in over three years. Negative values mean tougher sentencing." },
  { k: "defence", group: G.other, label: "Defence", unit: "£bn", min: -10, max: 40, step: 1 },
  { k: "capital", group: G.other, label: "Public investment (general)", unit: "£bn", min: -30, max: 60, step: 1 },
  { k: "otherDept", group: G.other, label: "Other departments", unit: "£bn", min: -30, max: 30, step: 1 },
  { k: "civilServicePct", group: G.mog, label: "Civil service headcount", unit: "%", min: -30, max: 20, step: 1, help: "Cuts save pay but cost exit payments, and a share falls on HMRC compliance staff, which loses tax." },
  { k: "hmrcStaff", group: G.mog, label: "Extra HMRC compliance staff", unit: "k", min: -10, max: 20, step: 0.5 },
  { k: "giltShock", group: G.shock, label: "Gilt yield shock", unit: "pp", min: -2, max: 4, step: 0.25 },
  { k: "demandShock", group: G.shock, label: "Demand shock (recession or boom)", unit: "% GDP", min: -5, max: 3, step: 0.25, help: "A hit to demand in the first year that fades as the economy recovers." },
  { k: "netMigration", group: G.shock, label: "Net migration vs OBR forecast", unit: "k/yr", min: -300, max: 300, step: 10 },
];
export const LEVER_GROUPS = Object.values(G);

// Departmental lever → RDEL line in the spending plans, and how much of a change is "comparable" for Barnett
const DEPT: Record<string, { line: string; barnett: number }> = {
  dHO: { line: "Home Office", barnett: 0.4 }, dMoJ: { line: "Justice", barnett: 0.6 }, dDfT: { line: "Transport", barnett: 0.7 },
  dDEFRA: { line: "Environment, Food and Rural Affairs", barnett: 0.9 }, dDESNZ: { line: "Energy Security and Net Zero", barnett: 0.1 },
  dDSIT: { line: "Science, Innovation and Technology", barnett: 0 }, dFCDO: { line: "Foreign, Commonwealth and Development Office", barnett: 0 },
  dDCMS: { line: "Culture, Media and Sport", barnett: 0.7 }, dDWP: { line: "Work and Pensions", barnett: 0 }, dHMRC: { line: "HM Revenue and Customs", barnett: 0 },
};
// Approximate comparability of England-only programmes (HM Treasury Statement of Funding Policy)
const BARNETT_ENGLAND: Partial<Record<NumKey, number>> = { nhs: 1, socialCare: 1, schools: 1, highNeeds: 1, teacherPay: 1, earlyYears: 1, councils: 1, housebuilding: 1, prisonCapital: 0.6 };

const TRR_LINES = {
  basic: "Change basic rate by 1p", higher: "Change higher rate by 1p", addUp: "Increase additional rate by 1p (yield)", addDown: "Decrease additional rate by 1p (cost)",
  pa: "Change personal allowance by 1%", ee: "Change Class 1 employee main rate by 1 percentage point", er: "Change Class 1 employer rate by 1 percentage point",
  vat: "Change standard rate by 1 percentage point", ct: "Increase Corporation tax by 1 percentage point", petrol: "Petrol", diesel: "Diesel",
} as const;

const endIndex = (s: string) => { const m = (s || "").match(/(20\d\d)/); if (!m) return YEARS.length; const y = +m[1]; return Math.max(0, Math.min(YEARS.length, y - 2026)); };

export function buildBaseline(fiscal: any, spending: any, nhs: any, welfare: any, cs: any, councils: any, trr: any, projects?: any): Baseline {
  const b = fiscal.bn, yi = (y: string) => b.years.indexOf(y);
  const n = YEARS.length;
  // Series from the OBR forecast, extended past its last year: GDP and the deflator grow at their final-year rates,
  // flows hold their final share of GDP, and debt accumulates borrowing.
  const raw = (name: string) => YEARS.map((y) => (yi(y) >= 0 ? b.series[name]?.[yi(y)] : undefined) as number | undefined);
  const grow = (a: (number | undefined)[]) => { const v = [...a] as number[]; for (let t = 0; t < n; t++) if (v[t] == null) v[t] = v[t - 1] * (v[t - 1] / v[t - 2]); return v; };
  const gdp = grow(raw("Nominal GDP (£ billion)")), deflator = grow(raw("GDP Deflator (2025-26=100)"));
  const share = (name: string) => { const v = raw(name) as number[]; for (let t = 0; t < n; t++) if (v[t] == null) v[t] = (v[t - 1] / gdp[t - 1]) * gdp[t]; return v; };
  const psnb = share("Public sector net borrowing");
  const stock = (name: string) => { const v = raw(name) as number[]; for (let t = 0; t < n; t++) if (v[t] == null) v[t] = v[t - 1] + psnb[t]; return v; };
  const W = welfare.sheets["UK welfare"], wyi = (y: string) => W.years.indexOf(y.replace("-", "/"));
  const wt = W.series.find((x: any) => x.label.startsWith("Total (consistent with OBR") && x.section.includes("nominal"));
  const wv = YEARS.map((y) => (wyi(y) >= 0 ? wt.values[wyi(y)] : undefined)) as number[];
  for (let t = 0; t < n; t++) if (wv[t] == null) wv[t] = (wv[t - 1] / gdp[t - 1]) * gdp[t];
  const ne = spending.tables.nhs_england_del;
  const neRow = ne.rows.find((r: any) => r.label.startsWith("Resource DEL"));
  const last = nhs.rtt_monthly.at(-1);
  const C = councils.columns as string[], E = councils.authorities.find((a: any) => a.class === "Eng").values as number[];
  const ci = (t: string) => E[C.findIndex((c) => c.includes(t))] || 0;
  const trrMap: Record<string, number[]> = {};
  const findTrr = (label: string) => trr.lines.find((l: any) => l.label === label)?.m ?? [0, 0, 0];
  for (const [k, label] of Object.entries(TRR_LINES)) trrMap[k] = findTrr(label);
  trrMap.vat = trr.lines.find((l: any) => l.section === "VAT" && l.label === TRR_LINES.vat)?.m ?? trrMap.vat;
  const rd = spending.tables.rdel_plans.rows as { label: string; values: number[] }[];
  const rdel = Object.fromEntries(Object.entries(DEPT).map(([k, d]) => [k, (rd.find((r) => r.label === d.line)?.values[0] ?? 0) / 1000]));
  const P: Project[] = (projects?.projects ?? []).filter((p: any) => p.category === "Infrastructure and Construction" && (p.fy_forecast_m ?? 0) >= 50)
    .map((p: any) => ({ id: p.id, name: p.name, dept: p.department, fy: p.fy_forecast_m / 1000, end: endIndex(p.end), dca: p.dca_nista || p.dca_sro || "",
      kind: /prison|houseblock/i.test(p.name) ? "prison" : /affordable homes|home building|housing infrastructure/i.test(p.name) ? "homes" : "other" }))
    .sort((a: Project, b: Project) => b.fy - a.fy);
  const org = (s: string) => cs.organisations.find((o: any) => o.name === s)?.headcount ?? 0;
  return {
    years: YEARS, gdp, deflator,
    receipts: share("Public sector current receipts"), tme: share("Total managed expenditure"), psnb,
    psnd: stock("Public sector net debt"), psnfl: stock("Public sector net financial liabilities"), cbd: share("Current budget deficit"),
    psni: share("Public sector net investment"), interest: share("Central government debt interest, net of APF"),
    outputGap: (raw("Output gap (per cent of GDP)") as number[]).map((x) => x ?? 0),
    welfare: wv,
    nhsEngland: neRow.values[ne.years.indexOf("2026-27")] / 1000,
    csHeadcount: org("Overall Civil Service"), hmrcHeadcount: org("HM Revenue and Customs Overall"),
    waiting: last.waiting, completedPerMonth: (last.admitted || 0) + (last.non_admitted || 0), referralsPerMonth: last.clock_starts || (last.admitted + last.non_admitted), waitingMonth: last.month,
    la: { socialCare: (ci("Service Expenditure - Adult Social Care") + ci("Service Expenditure - Children Social Care")) / 1e6,
      usableReserves: (ci("Estimated unallocated financial reserves level at 31 March") + ci("Other earmarked reserves: budget stabilisation at 31 March")) / 1e6,
      dsgDeficit: -ci("dedicated schools grant adjustment account level at 31 March") / 1e6 },
    rdel, projects: P,
    trr: trrMap, trrYears: trr.years,
    sources: [fiscal.source, trr.source, spending.source, welfare.source, nhs.source, cs.source, councils.source, ...(projects?.source ? [projects.source] : [])],
  };
}

export type Channel = { id: string; label: string; v: number[] };
export type Event = { t: number; tone: "good" | "bad" | "info"; area: string; text: string };
export type Score = { area: string; label: string; unit: string; base: number; scen: number; higherIsBetter: boolean | null; d?: number };
type Paths = {
  waiting: number[]; delayed: number[]; teachers: number[]; police: number[]; childPov: number[]; penPov: number[];
  homes: number[]; homesExtraCum: number[]; homesPrivateExtra: number[]; housePricePct: number[]; ta: number[];
  prisonPop: number[]; prisonCap: number[]; labour: number[]; residents: number[];
};
export type Result = {
  years: string[];
  dReceipts: Channel[]; dSpend: Channel[]; // £bn, + = more receipts / more spending
  demand: number[]; supply: number[]; supplyParts: Channel[]; gdpPct: number[]; // % change in real GDP level vs baseline
  stabiliser: number[]; interest: number[]; dPsnb: number[]; dPsnd: number[];
  psnb: number[]; psnd: number[]; psndPct: number[]; cbd: number[]; psnflPct: number[]; gdp: number[];
  unemploymentPp: number[]; unemploymentK: number[]; employmentK: number[];
  waiting: number[]; waitingBase: number[]; csHeadcount: number[];
  laReserves: number[]; laReservesBase: number[]; dsgDeficit: number[]; dsgDeficitBase: number[];
  welfarePct: number[]; welfareBasePct: number[]; schoolsRealPct: number[]; defencePct: number[];
  S: Paths; SB: Paths;
  rules: { stability: { base: number; scen: number; met: boolean; baseMet: boolean }; investment: { base: number; scen: number; met: boolean; baseMet: boolean } };
  events: Event[]; scores: Score[];
};

const sum = (a: number[][]) => a[0].map((_, i) => a.reduce((t, x) => t + x[i], 0));
const ramp = (since: number, years: number) => (since < 0 ? 0 : Math.min(1, (since + 1) / years));

export function simulate(B: Baseline, Lin: Levers, P: ParamValues): Result {
  const L: Levers = { ...ZERO, ...Lin };
  const n = YEARS.length, idx = [...Array(n).keys()];
  const on = (t: number) => (t >= L.start ? 1 : 0);
  const since = (t: number) => t - L.start; // 0 in first year of policy
  const priceIdx = (t: number) => B.deflator[t] / B.deflator[0];
  const trr = (k: string, t: number) => { const v = B.trr[k]; const i = Math.min(t, v.length - 1); return (v[i] / 1000) * (t > v.length - 1 ? B.gdp[t] / B.gdp[v.length - 1] : 1); };
  const R = (id: string, label: string, f: (t: number) => number): Channel => ({ id, label, v: idx.map((t) => on(t) * f(t)) });
  const proj = L.projects ?? {};
  const projSpend = (kind?: Project["kind"]) => idx.map((t) => on(t) * B.projects.reduce((s, p) => s + (proj[p.id] && t <= p.end && (!kind || p.kind === kind) ? (proj[p.id] / 100) * p.fy * priceIdx(t) : 0), 0));
  const prisonProj = projSpend("prison"), homesProj = projSpend("homes");

  // ---------- 1. Services and people ----------
  const paths = (X: Levers, active: boolean): Paths => {
    const a = (t: number) => (active ? on(t) : 0), s = (t: number) => (active ? since(t) : -1);
    const out: Paths = { waiting: [], delayed: [], teachers: [], police: [], childPov: [], penPov: [], homes: [], homesExtraCum: [], homesPrivateExtra: [], housePricePct: [], ta: [], prisonPop: [], prisonCap: [], labour: [], residents: [] };
    let w = B.waiting, ref = B.completedPerMonth, base = B.completedPerMonth, prod = 0, cum = 0, capAdded = 0, ta = P.ta_base, migrants = 0;
    const capSpend: number[] = [];
    for (const t of idx) {
      // NHS: referrals grow; completions grow, plus extra money, productivity and beds freed by social care
      const beds = Math.min(P.dd_base, a(t) * Math.max(0, X.socialCare) * P.sc_capacity_share * P.dd_per_bn * ramp(s(t), 2));
      ref *= 1 + P.nhs_demand / 100; base *= 1 + P.nhs_supply_base / 100; prod += a(t) * X.nhsProductivity;
      const done = base * (1 + (P.nhs_elastic * a(t) * (X.nhs / B.nhsEngland) * 100) / 100) * (1 + prod / 100) + (beds * P.elective_per_bed) / 12;
      w = Math.max(Math.min(w, P.wl_floor * 1e6), w + 12 * (ref - done)); // the list cannot fall below a frictional floor
      out.waiting.push(w); out.delayed.push(P.dd_base - beds);
      // Schools: pay raises retention; extra budget buys some teachers
      out.teachers.push(P.teacher_fte * (1 + (a(t) * X.teacherPay * P.teacher_retention * ramp(s(t), 3)) / 100) + a(t) * Math.max(-20, X.schools) * P.schools_staff_share * 1000 / P.teacher_cost);
      // Police officers from Home Office money
      out.police.push(P.police_base + (a(t) * (X.dHO / 100) * B.rdel.dHO * P.police_share * 1000) / P.officer_cost);
      // Poverty: cash to low-income families
      const ucBn = a(t) * (X.ucStandardPct / 100) * P.uc_std_base, hbBn = a(t) * (X.healthBenefitsPct / 100) * P.health_ben_base;
      out.childPov.push(P.child_pov_base - (ucBn + 0.3 * hbBn + 0.3 * a(t) * X.welfare) * P.pov_per_bn);
      out.penPov.push(P.pen_pov_base - a(t) * (X.statePensionPct / 100) * P.pension_base * P.pen_pov_per_bn);
      // Housing: grant-funded homes complete two years after the money; planning reform ramps up over three years
      const grant = (tt: number) => (tt >= 0 ? a(tt) * X.housebuilding + (active ? homesProj[tt] : 0) : 0);
      const grantHomes = (grant(t - 2) * 1000) / P.home_grant_cost; // thousands
      const priv = a(t) * P.homes_base * (X.planningPct / 100) * ramp(s(t), 3);
      cum += grantHomes + priv;
      out.homes.push(P.homes_base + grantHomes + priv); out.homesExtraCum.push(cum); out.homesPrivateExtra.push(priv);
      out.housePricePct.push(-P.price_elast * (cum / P.dwelling_stock) * 100);
      ta = ta + P.ta_growth - Math.min(ta, grantHomes * P.ta_share); out.ta.push(Math.max(0, ta));
      // Prisons: demand grows; sentencing reform cuts it; new places open three years after capital spending
      capSpend.push(a(t) * X.prisonCapital + (active ? prisonProj[t] : 0));
      capAdded += t >= 3 ? (capSpend[t - 3] * 1000) / P.cost_per_place / 1000 : 0; // thousands of places
      out.prisonPop.push((P.prison_pop + P.prison_growth * (t + 1)) * (1 - (a(t) * X.sentencingPct * ramp(s(t), 3)) / 100));
      out.prisonCap.push(P.prison_cap + P.cap_growth * (t + 1) + capAdded);
      // Labour supply (thousands): childcare, health-benefit changes, migration. Waiting-list effect added after.
      migrants += a(t) * X.netMigration;
      out.residents.push(migrants);
      out.labour.push(a(t) * X.earlyYears * P.childcare_jobs_per_bn * ramp(s(t), 2) - hbBn * P.hb_work_per_bn + migrants * P.mig_work);
    }
    return out;
  };
  const S = paths(L, true), SB = paths(L, false);
  // People kept out of work by waiting for treatment
  idx.forEach((t) => { const d = -(S.waiting[t] - SB.waiting[t]) / 1000 * P.wl_inactive / 1000; S.labour[t] += d; });
  const dInactive = idx.map((t) => (S.waiting[t] - SB.waiting[t]) / 1000 * P.wl_inactive / 1000); // thousands

  // ---------- 2. Money ----------
  const dReceipts: Channel[] = [
    R("income", "Income tax rates", (t) => L.basicRate * trr("basic", t) + L.higherRate * trr("higher", t) + (L.addRate >= 0 ? L.addRate * trr("addUp", t) : L.addRate * trr("addDown", t))),
    R("pa", "Personal allowance", (t) => -L.personalAllowancePct * trr("pa", t)),
    R("nics", "National Insurance", (t) => L.employeeNics * trr("ee", t) + L.employerNics * trr("er", t)),
    R("vat", "VAT", (t) => L.vat * trr("vat", t)),
    R("corp", "Corporation tax", (t) => L.corpTax * trr("ct", t)),
    R("fuel", "Fuel duty", (t) => L.fuelDutyPct * (trr("petrol", t) + trr("diesel", t))),
    R("ctax", "Council tax", (t) => P.council_tax_base * (Math.pow(1 + L.councilTaxPp / 100, since(t) + 1) - 1) * priceIdx(t)),
  ];
  const csCut = Math.min(0, L.civilServicePct) / 100 * B.csHeadcount; // negative = posts cut
  const hmrcLostK = (-csCut * P.hmrc_cut_share - Math.min(0, L.dHMRC) / 100 * B.hmrcHeadcount * 0.4) / 1000; // compliance staff lost, thousands
  // Diminishing returns: each extra officer chases smaller, harder cases. Losses from cuts are taken at the full marginal yield.
  const hmrcNet = L.hmrcStaff - hmrcLostK, hmrcEff = hmrcNet > 0 ? P.hmrc_sat * (1 - Math.exp(-hmrcNet / P.hmrc_sat)) : hmrcNet;
  dReceipts.push(R("compliance", "HMRC compliance yield", (t) => hmrcEff * P.hmrc_yield * ramp(since(t), 3) * priceIdx(t)));

  const csCost = (P.cs_cost / 1e6) * B.csHeadcount * (L.civilServicePct / 100);
  const dept = (k: string) => R(k, `${DEPT[k].line} (day-to-day)`, (t) => ((L as any)[k] / 100) * B.rdel[k] * priceIdx(t));
  const deptCh = Object.keys(DEPT).map(dept);
  const barnettBase = (t: number) => (Object.entries(BARNETT_ENGLAND) as [NumKey, number][]).reduce((s, [k, f]) => s + f * (k === "teacherPay" ? L.teacherPay * P.teacher_pay_cost : (L[k] as number)), 0)
    + Object.entries(DEPT).reduce((s, [k, d]) => s + d.barnett * ((L as any)[k] / 100) * B.rdel[k], 0);
  const dSpend: Channel[] = [
    R("nhs", "NHS England", (t) => L.nhs * priceIdx(t)),
    R("socialCare", "Adult social care", (t) => L.socialCare * priceIdx(t)),
    R("schools", "Schools", (t) => L.schools * priceIdx(t)),
    R("highNeeds", "High-needs (SEND)", (t) => L.highNeeds * priceIdx(t)),
    R("teacherPay", "Teacher pay", (t) => L.teacherPay * P.teacher_pay_cost * priceIdx(t)),
    R("earlyYears", "Childcare and early years", (t) => L.earlyYears * priceIdx(t)),
    R("councils", "Council grant", (t) => L.councils * priceIdx(t)),
    ...deptCh,
    R("defence", "Defence", (t) => L.defence * priceIdx(t)),
    R("other", "Other departments", (t) => L.otherDept * priceIdx(t)),
    R("cs", "Civil service pay bill", (t) => csCost * priceIdx(t) + (since(t) === 0 ? -csCut * (P.cs_cost / 1e6) * P.cs_severance : 0)),
    R("hmrcStaff", "HMRC compliance staff", (t) => L.hmrcStaff * P.hmrc_staff_cost / 1000 * priceIdx(t)),
    R("barnett", "Barnett consequentials (devolved governments)", (t) => P.barnett_on * P.barnett_share * barnettBase(t) * priceIdx(t)),
    // Welfare
    R("welfare", "Other welfare", (t) => L.welfare * priceIdx(t)),
    R("uc", "Universal Credit standard allowance", (t) => (L.ucStandardPct / 100) * P.uc_std_base * priceIdx(t)),
    R("pension", "State pension", (t) => (L.statePensionPct / 100) * P.pension_base * priceIdx(t)),
    R("healthBen", "Health and disability benefits", (t) => (L.healthBenefitsPct / 100) * P.health_ben_base * priceIdx(t)),
    { id: "inactive", label: "Benefits for people out of work while waiting for treatment", v: idx.map((t) => dInactive[t] * P.inactive_benefit / 1000 * priceIdx(t)) },
    { id: "hb", label: "Housing benefit saved by new social homes", v: idx.map((t) => -(S.homesExtraCum[t] - S.homesPrivateExtra.slice(0, t + 1).reduce((a, b) => a + b, 0)) * P.hb_saving / 1000 * priceIdx(t)) },
    { id: "ta", label: "Temporary accommodation (councils)", v: idx.map((t) => (S.ta[t] - SB.ta[t]) * P.ta_cost / 1000 * priceIdx(t)) },
    { id: "prisonRun", label: "Prison running costs", v: idx.map((t) => (S.prisonPop[t] - SB.prisonPop[t]) * P.prison_cost / 1000 * priceIdx(t)) },
    { id: "migServices", label: "Public services for a changed population", v: idx.map((t) => S.residents[t] * P.mig_service_cost / 1000 * priceIdx(t)) },
    // Capital
    R("capital", "Public investment (general)", (t) => L.capital * priceIdx(t)),
    R("housing", "Affordable housing grant", (t) => L.housebuilding * priceIdx(t)),
    R("prisons", "Prison building", (t) => L.prisonCapital * priceIdx(t)),
    { id: "projects", label: "Major projects", v: idx.map((t) => on(t) * B.projects.reduce((s, p) => s + (proj[p.id] && t <= p.end ? (proj[p.id] / 100) * p.fy * priceIdx(t) : 0) + (proj[p.id] === -100 && since(t) === 0 ? P.cancel_cost * p.fy : 0), 0)) },
  ];
  const get = (arr: Channel[], id: string) => arr.find((c) => c.id === id)!.v;
  const CAPITAL = ["capital", "housing", "prisons", "projects"];
  const WELFARE = ["welfare", "uc", "pension", "healthBen", "inactive", "hb"];
  const TAXES_INC = ["income", "pa", "nics", "compliance", "ctax"];

  // ---------- 3. Economy ----------
  const fade = (t: number) => Math.max(0, 1 - since(t) / Math.max(1, P.fade));
  const impulse = (t: number) => {
    const g = B.gdp[t], m = (v: number[]) => (v[t] / g) * 100;
    let cap = 0, res = 0, wel = 0;
    for (const c of dSpend) { if (CAPITAL.includes(c.id)) cap += m(c.v); else if (WELFARE.includes(c.id)) wel += m(c.v); else res += m(c.v); }
    const inc = TAXES_INC.reduce((s, id) => s + m(get(dReceipts, id)), 0);
    return P.m_capital * cap + P.m_resource * res + P.m_welfare * wel - P.m_income * inc - P.m_vat * m(get(dReceipts, "vat")) - P.m_corp * m(get(dReceipts, "corp")) - P.m_fuel * m(get(dReceipts, "fuel"));
  };
  const demand = idx.map((t) => on(t) * (impulse(t) + L.demandShock * fade(t)));
  // Supply: public investment builds potential output; extra workers add output; private housebuilding adds residential investment
  const capTotal = (t: number) => CAPITAL.reduce((s, id) => s + get(dSpend, id)[t], 0);
  const supplyParts: Channel[] = [
    { id: "invest", label: "Public investment", v: idx.map((t) => on(t) * P.inv_potential_5y * (capTotal(t) / B.gdp[t]) * 100 * Math.min(1, (since(t) + 1) / 5)) },
    { id: "labour", label: "Labour supply", v: idx.map((t) => (S.labour[t] * P.output_per_worker / 1e6 * priceIdx(t)) / B.gdp[t] * 100 * 1000) },
    { id: "homes", label: "Private housebuilding", v: idx.map((t) => (S.homesPrivateExtra[t] * P.output_per_home / 1e6 * priceIdx(t)) / B.gdp[t] * 100 * 1000) },
  ];
  const supply = sum(supplyParts.map((c) => c.v));
  const gdpPct = idx.map((t) => demand[t] + supply[t]);
  const gdp = idx.map((t) => B.gdp[t] * (1 + gdpPct[t] / 100));
  const stabiliser = idx.map((t) => -P.stabiliser * (gdpPct[t] / 100) * B.gdp[t]);

  // ---------- 4. Feedback ----------
  const totalRec = sum(dReceipts.map((c) => c.v)), totalSpend = sum(dSpend.map((c) => c.v));
  const interest: number[] = [], dPsnb: number[] = [], dPsnd: number[] = [];
  for (const t of idx) {
    const prevD = t ? dPsnd[t - 1] : 0;
    const repriced = on(t) ? Math.min(1, P.reprice_y1 / 100 + since(t) / P.avg_maturity) : 0;
    interest[t] = (P.marginal_rate / 100) * prevD + (L.giltShock / 100) * repriced * B.psnd[t];
    dPsnb[t] = totalSpend[t] - totalRec[t] + stabiliser[t] + interest[t];
    dPsnd[t] = prevD + dPsnb[t];
  }
  const psnb = idx.map((t) => B.psnb[t] + dPsnb[t]);
  const psnd = idx.map((t) => B.psnd[t] + dPsnd[t]);
  const cbd = idx.map((t) => B.cbd[t] + dPsnb[t] - capTotal(t));
  const psnflPct = idx.map((t) => ((B.psnfl[t] + dPsnd[t]) / gdp[t]) * 100);
  const unemploymentPp = idx.map((t) => -P.okun * demand[t]);
  const unemploymentK = unemploymentPp.map((x) => (x / 100) * P.labour_force * 1000);
  const employmentK = idx.map((t) => -unemploymentK[t] + S.labour[t]);

  // Councils: reserves absorb the social-care gap; grant, council tax, social care money and lower TA costs relieve it
  const laReservesBase: number[] = [], laReserves: number[] = [], dsgDeficitBase: number[] = [], dsgDeficit: number[] = [];
  let rb = B.la.usableReserves, r = rb, db = B.la.dsgDeficit, d = db, gap = 0;
  const ctax = get(dReceipts, "ctax"), taCost = get(dSpend, "ta");
  for (const t of idx) {
    gap += (P.la_gap / 100) * B.la.socialCare;
    rb -= gap; r -= gap - on(t) * (L.councils + L.socialCare * (1 - P.sc_capacity_share)) - ctax[t] + taCost[t];
    db += P.la_dsg_growth; d += P.la_dsg_growth - on(t) * L.highNeeds;
    laReservesBase.push(rb); laReserves.push(r); dsgDeficitBase.push(db); dsgDeficit.push(Math.max(0, d));
  }
  const waitingBase = SB.waiting, waiting = S.waiting;
  const ri = YEARS.indexOf(RULE_YEAR);
  const basePsnflPct = idx.map((t) => (B.psnfl[t] / B.gdp[t]) * 100);
  const psndPct = idx.map((t) => (psnd[t] / gdp[t]) * 100);
  const csHeadcount = idx.map((t) => B.csHeadcount * (1 + (on(t) * L.civilServicePct) / 100));
  const rules = {
    stability: { base: -B.cbd[ri], scen: -cbd[ri], baseMet: B.cbd[ri] <= 0, met: cbd[ri] <= 0 },
    investment: { base: basePsnflPct[ri] - basePsnflPct[ri - 1], scen: psnflPct[ri] - psnflPct[ri - 1], baseMet: basePsnflPct[ri] < basePsnflPct[ri - 1], met: psnflPct[ri] < psnflPct[ri - 1] },
  };

  // ---------- Events: thresholds the scenario crosses, compared with the baseline ----------
  const events: Event[] = [];
  const first = (a: number[], f: (x: number, t: number) => boolean) => idx.find((t) => f(a[t], t));
  const crossing = (area: string, a: number[], b: number[], f: (x: number) => boolean, bad: boolean, text: (t: number) => string, notInBase: (t: number | undefined) => string) => {
    const ts = first(a, f), tb = first(b, f);
    if (ts === tb) return;
    if (ts != null) events.push({ t: ts, tone: bad ? "bad" : "good", area, text: text(ts) + (tb == null ? ` ${notInBase(tb)}` : ` (baseline: ${YEARS[tb]})`) });
    else if (tb != null) events.push({ t: tb, tone: bad ? "good" : "bad", area, text: `Avoided: ${text(tb).charAt(0).toLowerCase()}${text(tb).slice(1)} (happens in the baseline)` });
  };
  if (rules.stability.baseMet && !rules.stability.met) events.push({ t: ri, tone: "bad", area: "Public finances", text: `The stability rule is broken: a current budget deficit of £${(-rules.stability.scen).toFixed(1)}bn in ${RULE_YEAR}. Expect pressure from markets and the OBR.` });
  if (!rules.stability.baseMet && rules.stability.met) events.push({ t: ri, tone: "good", area: "Public finances", text: `The stability rule is met, which the baseline fails.` });
  if (rules.investment.baseMet && !rules.investment.met) events.push({ t: ri, tone: "bad", area: "Public finances", text: `The investment rule is broken: net financial liabilities rise as a share of GDP in ${RULE_YEAR}.` });
  crossing("Public finances", psndPct, idx.map((t) => (B.psnd[t] / B.gdp[t]) * 100), (x) => x >= 100, true, (t) => `Net debt passes 100% of GDP in ${YEARS[t]}`, () => "and never does in the baseline");
  crossing("Councils", laReserves, laReservesBase, (x) => x <= 0, true, (t) => `Councils' usable reserves run out in ${YEARS[t]}: widespread section 114 notices and emergency support`, () => "");
  const dsgEnd = YEARS.indexOf("2027-28");
  events.push({ t: dsgEnd + 1, tone: dsgDeficit[dsgEnd] > 1 ? "bad" : "good", area: "Schools", text: `The SEND statutory override ends in March 2028 with high-needs deficits of £${dsgDeficit[dsgEnd].toFixed(1)}bn (baseline £${dsgDeficitBase[dsgEnd].toFixed(1)}bn). Without a settlement, many councils' balance sheets go negative.` });
  crossing("Justice", idx.map((t) => S.prisonCap[t] - S.prisonPop[t]), idx.map((t) => SB.prisonCap[t] - SB.prisonPop[t]), (x) => x < 0, true, (t) => `Prisons run out of places in ${YEARS[t]}: emergency early release and police cells used`, () => "");
  crossing("Health", waiting, waitingBase, (x) => x < 6e6, false, (t) => `The waiting list falls below 6 million in ${YEARS[t]}`, () => "and never does in the baseline");
  crossing("Health", waiting, waitingBase, (x) => x > 8e6, true, (t) => `The waiting list passes 8 million in ${YEARS[t]}`, () => "");
  crossing("Housing", S.ta, SB.ta, (x) => x > 160, true, (t) => `Households in temporary accommodation pass 160,000 in ${YEARS[t]}`, () => "");
  const peakU = unemploymentK.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0), tU = unemploymentK.indexOf(peakU);
  if (Math.abs(peakU) >= 50) events.push({ t: tU, tone: peakU > 0 ? "bad" : "good", area: "Economy", text: `Unemployment ${peakU > 0 ? "rises" : "falls"} by about ${Math.abs(peakU).toFixed(0)}k at its peak in ${YEARS[tU]}.` });
  const dPov = S.childPov.map((x, t) => x - SB.childPov[t]), tp = dPov.findIndex((x) => Math.abs(x) >= 0.1);
  if (tp >= 0) events.push({ t: tp, tone: dPov[tp] < 0 ? "good" : "bad", area: "Poverty", text: `About ${Math.abs(dPov[tp] * 1000).toFixed(0)}k ${dPov[tp] < 0 ? "fewer" : "more"} children in relative poverty from ${YEARS[tp]}.` });
  const cancelled = B.projects.filter((p) => proj[p.id] === -100);
  if (cancelled.length) events.push({ t: L.start, tone: "info", area: "Infrastructure", text: `Cancelled: ${cancelled.map((p) => p.name).join(", ")}. Break costs of £${cancelled.reduce((s, p) => s + P.cancel_cost * p.fy, 0).toFixed(1)}bn in the first year.` });
  if (L.giltShock >= 1) events.push({ t: L.start, tone: "bad", area: "Public finances", text: `Gilt yields jump ${L.giltShock.toFixed(2)}pp. Debt interest rises by £${interest[Math.min(n - 1, L.start + 2)].toFixed(1)}bn within three years.` });
  events.sort((a, b) => a.t - b.t);

  // ---------- Scorecard at the horizon ----------
  const T = n - 1;
  const scores: Score[] = [
    { area: "Public finances", label: `Borrowing ${YEARS[T]}`, unit: "£bn", base: B.psnb[T], scen: psnb[T], higherIsBetter: false },
    { area: "Public finances", label: `Debt ${YEARS[T]}`, unit: "% GDP", base: (B.psnd[T] / B.gdp[T]) * 100, scen: psndPct[T], higherIsBetter: false },
    { area: "Economy", label: "Real GDP level", unit: "% vs baseline", base: 0, scen: gdpPct[T], higherIsBetter: true },
    { area: "Economy", label: "Employment", unit: "k vs baseline", base: 0, scen: employmentK[T], higherIsBetter: true },
    { area: "Health", label: "NHS waiting list", unit: "m", base: waitingBase[T] / 1e6, scen: waiting[T] / 1e6, higherIsBetter: false },
    { area: "Health", label: "Beds held by delayed discharges", unit: "", base: SB.delayed[T], scen: S.delayed[T], higherIsBetter: false },
    { area: "Schools", label: "Teachers (FTE)", unit: "k", base: SB.teachers[T], scen: S.teachers[T], higherIsBetter: true },
    { area: "Schools", label: "SEND deficit", unit: "£bn", base: dsgDeficitBase[T], scen: dsgDeficit[T], higherIsBetter: false },
    { area: "Poverty", label: "Children in relative poverty", unit: "m", base: SB.childPov[T], scen: S.childPov[T], higherIsBetter: false },
    { area: "Poverty", label: "Pensioners in relative poverty", unit: "m", base: SB.penPov[T], scen: S.penPov[T], higherIsBetter: false },
    { area: "Housing", label: "Homes built a year", unit: "k", base: SB.homes[T], scen: S.homes[T], higherIsBetter: true },
    { area: "Housing", label: "Households in temporary accommodation", unit: "k", base: SB.ta[T], scen: S.ta[T], higherIsBetter: false },
    { area: "Housing", label: "House prices", unit: "% vs baseline", base: 0, scen: S.housePricePct[T], higherIsBetter: null },
    { area: "Councils", label: "Usable reserves", unit: "£bn", base: laReservesBase[T], scen: laReserves[T], higherIsBetter: true },
    { area: "Justice", label: "Prison places spare", unit: "k", base: SB.prisonCap[T] - SB.prisonPop[T], scen: S.prisonCap[T] - S.prisonPop[T], higherIsBetter: true },
    { area: "Justice", label: "Police officers", unit: "k", base: SB.police[T], scen: S.police[T], higherIsBetter: true },
    { area: "State", label: "Civil servants", unit: "k", base: B.csHeadcount / 1000, scen: csHeadcount[T] / 1000, higherIsBetter: null },
  ];

  return {
    years: YEARS, dReceipts, dSpend, demand, supply, supplyParts, gdpPct, stabiliser, interest, dPsnb, dPsnd, psnb, psnd,
    psndPct, cbd, psnflPct, gdp, unemploymentPp, unemploymentK, employmentK,
    waiting, waitingBase, csHeadcount, laReserves, laReservesBase, dsgDeficit, dsgDeficitBase,
    welfarePct: idx.map((t) => ((B.welfare[t] + WELFARE.reduce((s, id) => s + get(dSpend, id)[t], 0)) / gdp[t]) * 100), welfareBasePct: idx.map((t) => (B.welfare[t] / B.gdp[t]) * 100),
    schoolsRealPct: idx.map((t) => (on(t) * L.schools / P.schools_core) * 100),
    defencePct: idx.map((t) => P.defence_base_pct + (on(t) * L.defence * priceIdx(t) / gdp[t]) * 100),
    S, SB, rules, events, scores,
  };
}

export const PRESETS: { name: string; note: string; levers: Partial<Levers> }[] = [
  { name: "1p on basic rate for the NHS", note: "Raise the basic rate by 1p and give NHS England the money in real terms.", levers: { basicRate: 1, nhs: 8 } },
  { name: "Fix social care to fix the NHS", note: "£5bn a year for adult social care, half of it new capacity, plus £3bn for the NHS, paid for by 1pp on employer NICs.", levers: { socialCare: 5, nhs: 3, employerNics: 1 } },
  { name: "Build 1.5 million homes", note: "Planning reform that lifts private building by 35%, plus £4bn a year of social housing grant.", levers: { planningPct: 35, housebuilding: 4 } },
  { name: "Invest 1% of GDP a year", note: "About £32bn a year of extra capital spending, debt-financed.", levers: { capital: 32 } },
  { name: "Cut the civil service by 10%", note: "About 55,000 posts, with one-off exit costs and lost HMRC compliance yield.", levers: { civilServicePct: -10 } },
  { name: "Tax compliance drive", note: "10,000 extra HMRC compliance staff.", levers: { hmrcStaff: 10 } },
  { name: "Child poverty package", note: "UC standard allowance up 15% and £2bn more for funded childcare, paid for by 2p on the higher rate.", levers: { ucStandardPct: 15, earlyYears: 2, higherRate: 2 } },
  { name: "Prisons crisis", note: "£1.5bn a year of prison building and sentencing reform that cuts the population by 8%.", levers: { prisonCapital: 1.5, sentencingPct: 8 } },
  { name: "Defence to 3.5% of GDP", note: "About £30bn a year more on defence, debt-financed.", levers: { defence: 30 } },
  { name: "Fund councils and SEND", note: "£4bn of extra grant a year and £3bn for high needs, paid for by 1pp on employer NICs.", levers: { councils: 4, highNeeds: 3, employerNics: 1 } },
  { name: "Austerity round", note: "Unprotected departments cut 10% in real terms, health benefits cut 10%.", levers: { dHO: -10, dMoJ: -10, dDfT: -10, dDEFRA: -10, dDCMS: -10, dFCDO: -10, healthBenefitsPct: -10 } },
  { name: "Recession", note: "A demand shock of 3% of GDP with no policy response.", levers: { demandShock: -3 } },
  { name: "Gilt market shock", note: "Yields up 1.5 percentage points with no policy response.", levers: { giltShock: 1.5 } },
  { name: "NHS productivity drive", note: "1.5pp extra productivity growth a year with no extra money.", levers: { nhsProductivity: 1.5 } },
];
