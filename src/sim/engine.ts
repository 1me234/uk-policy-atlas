// UK system model: propagates policy levers through fiscal, macro and service channels, year by year,
// against the OBR baseline. Pure functions, no React, so the drafting workspace and sandbox can reuse it.
import type { ParamValues } from "./params";

export const YEARS = ["2026-27", "2027-28", "2028-29", "2029-30", "2030-31"];
export const RULE_YEAR = "2029-30"; // fiscal rules are assessed in this year

export type Baseline = {
  years: string[];
  gdp: number[]; deflator: number[]; receipts: number[]; tme: number[]; psnb: number[]; psnd: number[]; psnfl: number[];
  cbd: number[]; psni: number[]; interest: number[]; outputGap: number[];
  welfare: number[]; nhsEngland: number; csHeadcount: number;
  waiting: number; completedPerMonth: number; waitingMonth: string;
  la: { socialCare: number; usableReserves: number; dsgDeficit: number };
  trr: Record<string, number[]>; trrYears: string[];
  sources: { name: string; url?: string }[];
};

export type Levers = {
  start: number; // index into YEARS of the first year the policy applies
  basicRate: number; higherRate: number; addRate: number; personalAllowancePct: number;
  employeeNics: number; employerNics: number; vat: number; corpTax: number; fuelDutyPct: number;
  nhs: number; schools: number; welfare: number; councils: number; defence: number; otherDept: number; capital: number; highNeeds: number;
  civilServicePct: number; nhsProductivity: number; giltShock: number;
};
export const ZERO: Levers = { start: 1, basicRate: 0, higherRate: 0, addRate: 0, personalAllowancePct: 0, employeeNics: 0, employerNics: 0, vat: 0, corpTax: 0, fuelDutyPct: 0, nhs: 0, schools: 0, welfare: 0, councils: 0, defence: 0, otherDept: 0, capital: 0, highNeeds: 0, civilServicePct: 0, nhsProductivity: 0, giltShock: 0 };

export type LeverDef = { k: keyof Levers; group: string; label: string; unit: string; min: number; max: number; step: number; help?: string };
export const LEVERS: LeverDef[] = [
  { k: "basicRate", group: "Tax", label: "Income tax basic rate", unit: "pp", min: -5, max: 5, step: 1 },
  { k: "higherRate", group: "Tax", label: "Income tax higher rate", unit: "pp", min: -5, max: 5, step: 1 },
  { k: "addRate", group: "Tax", label: "Income tax additional rate", unit: "pp", min: -5, max: 10, step: 1, help: "HMRC costs rises and cuts differently because top earners respond strongly." },
  { k: "personalAllowancePct", group: "Tax", label: "Personal allowance", unit: "%", min: -20, max: 50, step: 1 },
  { k: "employeeNics", group: "Tax", label: "Employee NICs main rate", unit: "pp", min: -8, max: 4, step: 1 },
  { k: "employerNics", group: "Tax", label: "Employer NICs rate", unit: "pp", min: -5, max: 5, step: 0.5 },
  { k: "vat", group: "Tax", label: "VAT standard rate", unit: "pp", min: -5, max: 5, step: 1 },
  { k: "corpTax", group: "Tax", label: "Corporation tax main rate", unit: "pp", min: -10, max: 10, step: 1 },
  { k: "fuelDutyPct", group: "Tax", label: "Fuel duty", unit: "%", min: -20, max: 30, step: 1 },
  { k: "nhs", group: "Spending (real £bn a year, 2026-27 prices)", label: "NHS England", unit: "£bn", min: -20, max: 40, step: 1 },
  { k: "schools", group: "Spending (real £bn a year, 2026-27 prices)", label: "Schools", unit: "£bn", min: -10, max: 20, step: 0.5 },
  { k: "highNeeds", group: "Spending (real £bn a year, 2026-27 prices)", label: "High-needs (SEND) funding", unit: "£bn", min: 0, max: 10, step: 0.5 },
  { k: "councils", group: "Spending (real £bn a year, 2026-27 prices)", label: "Council grant", unit: "£bn", min: -10, max: 20, step: 0.5 },
  { k: "welfare", group: "Spending (real £bn a year, 2026-27 prices)", label: "Welfare", unit: "£bn", min: -30, max: 30, step: 1 },
  { k: "defence", group: "Spending (real £bn a year, 2026-27 prices)", label: "Defence", unit: "£bn", min: -10, max: 40, step: 1 },
  { k: "otherDept", group: "Spending (real £bn a year, 2026-27 prices)", label: "Other departments", unit: "£bn", min: -30, max: 30, step: 1 },
  { k: "capital", group: "Spending (real £bn a year, 2026-27 prices)", label: "Public investment (capital)", unit: "£bn", min: -30, max: 60, step: 1 },
  { k: "civilServicePct", group: "Reform", label: "Civil service headcount", unit: "%", min: -30, max: 20, step: 1 },
  { k: "nhsProductivity", group: "Reform", label: "Extra NHS productivity growth", unit: "pp/yr", min: -2, max: 4, step: 0.1 },
  { k: "giltShock", group: "Shocks", label: "Gilt yield shock", unit: "pp", min: -2, max: 4, step: 0.25 },
];

const TRR_LINES = {
  basic: "Change basic rate by 1p", higher: "Change higher rate by 1p", addUp: "Increase additional rate by 1p (yield)", addDown: "Decrease additional rate by 1p (cost)",
  pa: "Change personal allowance by 1%", ee: "Change Class 1 employee main rate by 1 percentage point", er: "Change Class 1 employer rate by 1 percentage point",
  vat: "Change standard rate by 1 percentage point", ct: "Increase Corporation tax by 1 percentage point", petrol: "Petrol", diesel: "Diesel",
} as const;

export function buildBaseline(fiscal: any, spending: any, nhs: any, welfare: any, cs: any, councils: any, trr: any): Baseline {
  const b = fiscal.bn, yi = (y: string) => b.years.indexOf(y);
  const s = (name: string) => YEARS.map((y) => b.series[name][yi(y)] as number);
  const W = welfare.sheets["UK welfare"], wyi = (y: string) => W.years.indexOf(y.replace("-", "/"));
  const wt = W.series.find((x: any) => x.label.startsWith("Total (consistent with OBR") && x.section.includes("nominal"));
  const ne = spending.tables.nhs_england_del;
  const neRow = ne.rows.find((r: any) => r.label.startsWith("Resource DEL"));
  const last = nhs.rtt_monthly.at(-1);
  const C = councils.columns as string[], E = councils.authorities.find((a: any) => a.class === "Eng").values as number[];
  const ci = (t: string) => E[C.findIndex((c) => c.includes(t))] || 0;
  const trrMap: Record<string, number[]> = {};
  const findTrr = (label: string) => trr.lines.find((l: any) => l.label === label)?.m ?? [0, 0, 0];
  for (const [k, label] of Object.entries(TRR_LINES)) trrMap[k] = findTrr(label);
  // VAT standard rate appears once; take the line in the VAT section to be sure
  trrMap.vat = trr.lines.find((l: any) => l.section === "VAT" && l.label === TRR_LINES.vat)?.m ?? trrMap.vat;
  return {
    years: YEARS,
    gdp: s("Nominal GDP (£ billion)"), deflator: s("GDP Deflator (2025-26=100)"),
    receipts: s("Public sector current receipts"), tme: s("Total managed expenditure"), psnb: s("Public sector net borrowing"),
    psnd: s("Public sector net debt"), psnfl: s("Public sector net financial liabilities"), cbd: s("Current budget deficit"),
    psni: s("Public sector net investment"), interest: s("Central government debt interest, net of APF"), outputGap: s("Output gap (per cent of GDP)"),
    welfare: YEARS.map((y) => wt.values[wyi(y)]),
    nhsEngland: neRow.values[ne.years.indexOf("2026-27")] / 1000,
    csHeadcount: cs.organisations.find((o: any) => o.name === "Overall Civil Service").headcount,
    waiting: last.waiting, completedPerMonth: (last.admitted || 0) + (last.non_admitted || 0), waitingMonth: last.month,
    la: { socialCare: (ci("Service Expenditure - Adult Social Care") + ci("Service Expenditure - Children Social Care")) / 1e6,
      usableReserves: (ci("Estimated unallocated financial reserves level at 31 March") + ci("Other earmarked reserves: budget stabilisation at 31 March")) / 1e6,
      dsgDeficit: -ci("dedicated schools grant adjustment account level at 31 March") / 1e6 },
    trr: trrMap, trrYears: trr.years,
    sources: [fiscal.source, trr.source, spending.source, welfare.source, nhs.source, cs.source, councils.source],
  };
}

export type Channel = { id: string; label: string; v: number[] };
export type Result = {
  years: string[];
  dReceipts: Channel[]; dSpend: Channel[]; // £bn, + = more receipts / more spending
  demand: number[]; supply: number[]; gdpPct: number[]; // % change in real GDP level vs baseline
  stabiliser: number[]; interest: number[]; dPsnb: number[]; dPsnd: number[];
  psnb: number[]; psnd: number[]; psndPct: number[]; cbd: number[]; psnflPct: number[]; gdp: number[];
  unemploymentPp: number[]; unemploymentK: number[];
  waiting: number[]; waitingBase: number[]; csHeadcount: number[];
  laReserves: number[]; laReservesBase: number[]; dsgDeficit: number[]; dsgDeficitBase: number[];
  welfarePct: number[]; welfareBasePct: number[]; schoolsRealPct: number[];
  rules: { stability: { base: number; scen: number; met: boolean; baseMet: boolean }; investment: { base: number; scen: number; met: boolean; baseMet: boolean } };
};

const sum = (a: number[][]) => a[0].map((_, i) => a.reduce((t, x) => t + x[i], 0));

export function simulate(B: Baseline, L: Levers, P: ParamValues): Result {
  const n = YEARS.length, idx = [...Array(n).keys()];
  const on = (t: number) => (t >= L.start ? 1 : 0);
  const since = (t: number) => t - L.start; // 0 in first year of policy
  const gdpGrowth = (t: number) => B.gdp[t] / B.gdp[0];
  const priceIdx = (t: number) => B.deflator[t] / B.deflator[0];
  // HMRC ready reckoner value for year t (£bn), extended past its last year with nominal GDP
  const trr = (k: string, t: number) => { const v = B.trr[k]; const i = Math.min(t, v.length - 1); return (v[i] / 1000) * (t > v.length - 1 ? B.gdp[t] / B.gdp[v.length - 1] : 1); };
  const R = (id: string, label: string, f: (t: number) => number): Channel => ({ id, label, v: idx.map((t) => on(t) * f(t)) });

  const dReceipts: Channel[] = [
    R("income", "Income tax rates", (t) => L.basicRate * trr("basic", t) + L.higherRate * trr("higher", t) + (L.addRate >= 0 ? L.addRate * trr("addUp", t) : L.addRate * trr("addDown", t))),
    R("pa", "Personal allowance", (t) => -L.personalAllowancePct * trr("pa", t)),
    R("nics", "National Insurance", (t) => L.employeeNics * trr("ee", t) + L.employerNics * trr("er", t)),
    R("vat", "VAT", (t) => L.vat * trr("vat", t)),
    R("corp", "Corporation tax", (t) => L.corpTax * trr("ct", t)),
    R("fuel", "Fuel duty", (t) => L.fuelDutyPct * (trr("petrol", t) + trr("diesel", t))),
  ];
  const cut = Math.min(0, L.civilServicePct) / 100 * B.csHeadcount;
  const csCost = (P.cs_cost / 1e6) * B.csHeadcount * (L.civilServicePct / 100); // £bn a year, 2026-27 prices
  const dSpend: Channel[] = [
    R("nhs", "NHS England", (t) => L.nhs * priceIdx(t)),
    R("schools", "Schools", (t) => L.schools * priceIdx(t)),
    R("highNeeds", "High-needs (SEND)", (t) => L.highNeeds * priceIdx(t)),
    R("councils", "Council grant", (t) => L.councils * priceIdx(t)),
    R("welfare", "Welfare", (t) => L.welfare * priceIdx(t)),
    R("defence", "Defence", (t) => L.defence * priceIdx(t)),
    R("other", "Other departments", (t) => L.otherDept * priceIdx(t)),
    R("cs", "Civil service pay bill", (t) => csCost * priceIdx(t) + (since(t) === 0 ? -cut * (P.cs_cost / 1e6) * P.cs_severance : 0)),
    R("capital", "Public investment", (t) => L.capital * priceIdx(t)),
  ];
  const get = (arr: Channel[], id: string) => arr.find((c) => c.id === id)!.v;

  // Demand channel: multiplier × fiscal impulse (% of GDP), fading linearly to zero over `fade` years
  const fade = (t: number) => Math.max(0, 1 - since(t) / Math.max(1, P.fade));
  const impulse = (t: number) => {
    const g = B.gdp[t], m = (id: string, arr: Channel[]) => (get(arr, id)[t] / g) * 100;
    const resource = ["nhs", "schools", "highNeeds", "councils", "defence", "other", "cs"].reduce((s, id) => s + m(id, dSpend), 0);
    return P.m_capital * m("capital", dSpend) + P.m_resource * resource + P.m_welfare * m("welfare", dSpend)
      - P.m_income * (m("income", dReceipts) + m("pa", dReceipts) + m("nics", dReceipts)) - P.m_vat * m("vat", dReceipts) - P.m_corp * m("corp", dReceipts) - P.m_fuel * m("fuel", dReceipts);
  };
  const demand = idx.map((t) => on(t) * impulse(t) * fade(t));
  // Supply channel: sustained investment raises potential output, building up linearly over 5 years
  const supply = idx.map((t) => { if (!on(t)) return 0; const shareGdp = (get(dSpend, "capital")[t] / B.gdp[t]) * 100; return P.inv_potential_5y * shareGdp * Math.min(1, (since(t) + 1) / 5); });
  const gdpPct = idx.map((t) => demand[t] + supply[t]);
  const gdp = idx.map((t) => B.gdp[t] * (1 + gdpPct[t] / 100));
  const stabiliser = idx.map((t) => -P.stabiliser * (gdpPct[t] / 100) * B.gdp[t]); // £bn change in borrowing: 0.5% of GDP per 1% of output
  // Borrowing and debt, with interest on the extra debt and on any gilt shock
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
  const capital = get(dSpend, "capital");
  const cbd = idx.map((t) => B.cbd[t] + dPsnb[t] - capital[t]);
  const psnflPct = idx.map((t) => ((B.psnfl[t] + dPsnd[t]) / gdp[t]) * 100);
  const unemploymentPp = idx.map((t) => -P.okun * demand[t]);
  // NHS elective waiting list (England)
  const realNhsPct = (t: number) => on(t) * (L.nhs / B.nhsEngland) * 100;
  const waitingBase: number[] = [], waiting: number[] = [];
  let wb = B.waiting, w = B.waiting, ref = B.completedPerMonth, done = B.completedPerMonth, doneB = B.completedPerMonth, prod = 0;
  for (const t of idx) {
    ref *= 1 + P.nhs_demand / 100;
    doneB *= 1 + P.nhs_supply_base / 100;
    prod += on(t) * L.nhsProductivity;
    done = doneB * (1 + (P.nhs_elastic * realNhsPct(t)) / 100) * (1 + prod / 100);
    wb = Math.max(0, wb + 12 * (ref - doneB));
    w = Math.max(0, w + 12 * (ref - done));
    waitingBase.push(wb); waiting.push(w);
  }
  // Councils: usable reserves absorb any social-care gap; extra grant closes it
  const laReservesBase: number[] = [], laReserves: number[] = [], dsgDeficitBase: number[] = [], dsgDeficit: number[] = [];
  let rb = B.la.usableReserves, r = rb, db = B.la.dsgDeficit, d = db, gap = 0;
  for (const t of idx) {
    gap += (P.la_gap / 100) * B.la.socialCare;
    rb -= gap; r -= gap - on(t) * L.councils;
    db += P.la_dsg_growth; d += P.la_dsg_growth - on(t) * L.highNeeds;
    laReservesBase.push(rb); laReserves.push(r); dsgDeficitBase.push(db); dsgDeficit.push(Math.max(0, d));
  }
  const ri = YEARS.indexOf(RULE_YEAR);
  const basePsnflPct = idx.map((t) => (B.psnfl[t] / B.gdp[t]) * 100);
  return {
    years: YEARS, dReceipts, dSpend, demand, supply, gdpPct, stabiliser, interest, dPsnb, dPsnd, psnb, psnd,
    psndPct: idx.map((t) => (psnd[t] / gdp[t]) * 100), cbd, psnflPct, gdp,
    unemploymentPp, unemploymentK: unemploymentPp.map((x) => (x / 100) * P.labour_force * 1000),
    waiting, waitingBase, csHeadcount: idx.map((t) => B.csHeadcount * (1 + (on(t) * L.civilServicePct) / 100)),
    laReserves, laReservesBase, dsgDeficit, dsgDeficitBase,
    welfarePct: idx.map((t) => ((B.welfare[t] + get(dSpend, "welfare")[t]) / gdp[t]) * 100), welfareBasePct: idx.map((t) => (B.welfare[t] / B.gdp[t]) * 100),
    schoolsRealPct: idx.map((t) => (on(t) * L.schools / P.schools_core) * 100),
    rules: {
      stability: { base: -B.cbd[ri], scen: -cbd[ri], baseMet: B.cbd[ri] <= 0, met: cbd[ri] <= 0 },
      investment: { base: basePsnflPct[ri] - basePsnflPct[ri - 1], scen: psnflPct[ri] - psnflPct[ri - 1], baseMet: basePsnflPct[ri] < basePsnflPct[ri - 1], met: psnflPct[ri] < psnflPct[ri - 1] },
    },
  };
}

export const PRESETS: { name: string; note: string; levers: Partial<Levers> }[] = [
  { name: "1p on basic rate for the NHS", note: "Raise the basic rate by 1p and give NHS England the money in real terms.", levers: { basicRate: 1, nhs: 8 } },
  { name: "Invest 1% of GDP a year", note: "About £32bn a year of extra capital spending, debt-financed.", levers: { capital: 32 } },
  { name: "Cut the civil service by 10%", note: "About 55,000 posts, with one-off exit costs in the first year.", levers: { civilServicePct: -10 } },
  { name: "Gilt market shock", note: "Yields up 1.5 percentage points with no policy response.", levers: { giltShock: 1.5 } },
  { name: "Fund councils and SEND", note: "£4bn of extra grant a year and £3bn for high needs, paid for by 1pp on employer NICs.", levers: { councils: 4, highNeeds: 3, employerNics: 1 } },
  { name: "NHS productivity drive", note: "1.5pp extra productivity growth a year with no extra money.", levers: { nhsProductivity: 1.5 } },
];
