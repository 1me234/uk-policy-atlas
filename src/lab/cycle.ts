// Mini-simulation: a state-orchestrated cycle of bubble, consolidation, seizure, relocation,
// specialisation and reintegration, repeated across sectors. Compared with laissez-faire and with
// directed consolidation (no crash; the state brokers mergers at the peak).
// A stylised Monte Carlo model: values are in £bn of sector capital, and each stage's parameters are editable.

export type CycleParams = Record<string, number>;
export type Route = "insolvency" | "statute";
export type PDef = { id: string; stage: string; label: string; value: number; unit: string; min: number; max: number; step: number; note?: string };

export const STAGES = [
  { id: "boom", n: 1, t: "Boom", d: "Private capital floods a new sector. Investment grows each year and flows disproportionately to whoever is already biggest." },
  { id: "consolidate", n: 2, t: "Consolidation", d: "One firm pulls ahead on resources, data and brand. The bubble deflates; firms below a market-share threshold fail." },
  { id: "seize", n: 3, t: "Seizure", d: "The state acquires the failed firms' assets, through insolvency purchase or a statutory compulsory acquisition." },
  { id: "triage", n: 4, t: "Triage and resale", d: "Strategic assets are kept. The rest is sold, much of it abroad, at a price foreign buyers revise down once they learn the pattern." },
  { id: "relocate", n: 5, t: "Relocation", d: "Retained assets and teams move to a lagging region. Some talent leaves rather than move." },
  { id: "specialise", n: 6, t: "Specialisation", d: "The general-purpose capability is repurposed for a narrow, state-defined use." },
  { id: "reintegrate", n: 7, t: "Reintegration", d: "The specialised modules are handed to the champion, which folds them into its wider system." },
  { id: "repeat", n: 8, t: "Repeat in the next sector", d: "Investors and the champion now expect the cycle, and they adjust." },
];

export const CP: PDef[] = [
  { id: "cycles", stage: "repeat", label: "Number of sectors (cycles)", value: 4, unit: "", min: 1, max: 8, step: 1 },
  { id: "firms", stage: "boom", label: "Firms in each sector", value: 8, unit: "", min: 3, max: 20, step: 1 },
  { id: "invest0", stage: "boom", label: "Private investment in year 1 of the first boom", value: 20, unit: "£bn", min: 1, max: 200, step: 1 },
  { id: "hype", stage: "boom", label: "Growth in investment each boom year", value: 35, unit: "%", min: 0, max: 150, step: 5 },
  { id: "boomYears", stage: "boom", label: "Length of boom", value: 4, unit: "years", min: 1, max: 10, step: 1 },
  { id: "alpha", stage: "boom", label: "Rich-get-richer exponent (1 = proportional, >1 = winner takes most)", value: 1.3, unit: "", min: 0.5, max: 2.5, step: 0.05 },
  { id: "shareFail", stage: "consolidate", label: "Firms below this market share fail when the bubble deflates", value: 15, unit: "%", min: 2, max: 40, step: 1 },
  { id: "pFail", stage: "consolidate", label: "Chance a sub-threshold firm actually fails", value: 75, unit: "%", min: 0, max: 100, step: 5 },
  { id: "induced", stage: "consolidate", label: "State helps trigger the crash (0 = no, 1 = yes)", value: 0, unit: "", min: 0, max: 1, step: 1, note: "Inducing the crash raises failures but costs the wider economy and hits the champion too." },
  { id: "contagion", stage: "consolidate", label: "Collateral cost of an induced crash", value: 10, unit: "% of sector capital", min: 0, max: 50, step: 1 },
  { id: "insolPrice", stage: "seize", label: "Insolvency route: price paid", value: 25, unit: "% of book", min: 0, max: 100, step: 5 },
  { id: "insolDelay", stage: "seize", label: "Insolvency route: delay before control", value: 1.5, unit: "years", min: 0, max: 5, step: 0.25 },
  { id: "statPrice", stage: "seize", label: "Statutory route: compensation paid", value: 15, unit: "% of book", min: 0, max: 100, step: 5, note: "Grainger v UK (2012) upheld valuing Northern Rock shares as if no state support existed, which put them close to nil." },
  { id: "statDelay", stage: "seize", label: "Statutory route: delay before control", value: 0.25, unit: "years", min: 0, max: 3, step: 0.25 },
  { id: "pLegal", stage: "seize", label: "Statutory route: chance a legal challenge succeeds", value: 25, unit: "%", min: 0, max: 100, step: 5, note: "For example, a claim under A1P1 (protection of property, ECHR) or judicial review." },
  { id: "legalCost", stage: "seize", label: "Extra compensation if the challenge succeeds", value: 30, unit: "% of book", min: 0, max: 100, step: 5 },
  { id: "decay", stage: "seize", label: "Asset value lost per year of delay (staff leave, models go stale)", value: 25, unit: "%", min: 0, max: 80, step: 5 },
  { id: "foreign", stage: "seize", label: "Foreign-owned share of the failed firms", value: 40, unit: "%", min: 0, max: 100, step: 5 },
  { id: "pRetal", stage: "seize", label: "Chance of retaliation if foreign holders are expropriated by statute", value: 40, unit: "%", min: 0, max: 100, step: 5, note: "At a 40% foreign share. It scales in proportion to the foreign share, and insolvency purchases carry a fifth of the risk." },
  { id: "retalCost", stage: "seize", label: "Cost of retaliation (UK assets and market access abroad)", value: 15, unit: "£bn", min: 0, max: 200, step: 5 },
  { id: "offshore0", stage: "seize", label: "Crown-jewel IP moved offshore before seizure, first cycle", value: 10, unit: "%", min: 0, max: 90, step: 5 },
  { id: "offshoreLearn", stage: "seize", label: "Extra offshoring in each later cycle as firms anticipate", value: 15, unit: "pp", min: 0, max: 50, step: 5 },
  { id: "strategic", stage: "triage", label: "Share of seized assets kept as strategic", value: 50, unit: "%", min: 0, max: 100, step: 5 },
  { id: "nsi", stage: "triage", label: "Share of non-strategic assets that may be sold abroad (NSI Act)", value: 80, unit: "%", min: 0, max: 100, step: 5 },
  { id: "premium0", stage: "triage", label: "Foreign buyers' price, first cycle", value: 120, unit: "% of value", min: 20, max: 300, step: 5 },
  { id: "premiumLearn", stage: "triage", label: "Fall in foreign price each cycle as buyers learn assets were stripped", value: 20, unit: "%", min: 0, max: 80, step: 5 },
  { id: "domPrice", stage: "triage", label: "Domestic buyers' price", value: 60, unit: "% of value", min: 0, max: 150, step: 5 },
  { id: "talent", stage: "relocate", label: "Key staff who relocate rather than leave", value: 35, unit: "%", min: 0, max: 100, step: 5, note: "When ONS moved to Newport in 2006-10, only a small minority of London staff moved with it." },
  { id: "relocCost", stage: "relocate", label: "Relocation cost", value: 15, unit: "% of kept value", min: 0, max: 60, step: 1 },
  { id: "jobsPerBn", stage: "relocate", label: "Direct jobs per £bn of kept assets", value: 600, unit: "jobs", min: 50, max: 5000, step: 50 },
  { id: "multiplier", stage: "relocate", label: "Local jobs multiplier", value: 1.0, unit: "×", min: 0, max: 5, step: 0.1, note: "Range in the evidence: about 0.5 for public jobs in the UK (Faggio and Overman, 2014) to 4.9 for US high-tech jobs (Moretti, 2010)." },
  { id: "eta", stage: "specialise", label: "Capability kept when repurposed to a narrow use", value: 60, unit: "%", min: 0, max: 150, step: 5 },
  { id: "specYears", stage: "specialise", label: "Length of the state-run specialisation programme", value: 3, unit: "years", min: 1, max: 10, step: 1 },
  { id: "opex", stage: "specialise", label: "State running cost each year", value: 10, unit: "% of kept value", min: 0, max: 50, step: 1 },
  { id: "iota", stage: "reintegrate", label: "Share of specialised capability the champion successfully absorbs", value: 70, unit: "%", min: 0, max: 100, step: 5 },
  { id: "transfer", stage: "reintegrate", label: "Price the champion pays for the modules it receives", value: 0, unit: "% of their value", min: 0, max: 100, step: 5, note: "At 0 the hand-over is a free gift to the champion, in effect a subsidy." },
  { id: "complacency", stage: "reintegrate", label: "Champion's capability erosion per year without competitive pressure", value: 4, unit: "%", min: 0, max: 20, step: 1 },
  { id: "threat", stage: "reintegrate", label: "Credibility of the threat to run the cycle on the champion", value: 50, unit: "%", min: 0, max: 100, step: 5, note: "Offsets complacency in proportion. Your sketch relies on this to keep the champion from getting lazy." },
  { id: "champOffshore", stage: "reintegrate", label: "Champion's own crown jewels moved offshore, as a share of the firms' offshoring rate", value: 50, unit: "%", min: 0, max: 100, step: 5 },
  { id: "lfRedeploy", stage: "repeat", label: "Laissez-faire comparison: share of failed firms' value the market redeploys at home", value: 50, unit: "%", min: 0, max: 100, step: 5, note: "Staff join other firms and assets are bought cheaply; foreign buyers take the rest abroad." },
  { id: "kappa", stage: "repeat", label: "How much investors cut the next boom per unit of expected expropriation", value: 50, unit: "%", min: 0, max: 100, step: 5, note: "The hold-up problem (Kydland and Prescott, 1977): if a future seizure is expected, less is invested today." },
  { id: "sectorScale", stage: "repeat", label: "Size of each new sector relative to the last, before anticipation", value: 100, unit: "%", min: 25, max: 300, step: 5 },
];
export const defaultCycleParams = (): CycleParams => Object.fromEntries(CP.map((p) => [p.id, p.value]));

export type Strategy = "cycle" | "laissez" | "directed";
export type CycleOut = { natCap: number; kept: number; transferIn: number; invest: number; peakK: number; champShare: number; failedK: number; acq: number; legal: number; reloc: number; opex: number; contagion: number; sales: number; retal: number; net: number; jobs: number; talent: number; offshored: number; premium: number; capability: number; champCap: number; legalLost: boolean; retaliated: boolean };
export type RunOut = { cycles: CycleOut[]; net: number; jobs: number; capability: number; natCap: number; investLast: number; investFirst: number; champShare: number };

// Small seeded RNG so runs are reproducible
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export function runOnce(P: CycleParams, route: Route, strat: Strategy, seed: number): RunOut {
  const r = rng(seed), pc = (k: string) => P[k] / 100;
  const out: CycleOut[] = [];
  let invest = P.invest0, expropriation = 0, champCap = 0, natCap = 0;
  for (let c = 0; c < P.cycles; c++) {
    // 1. Boom: preferential attachment
    const N = Math.round(P.firms);
    const K = Array.from({ length: N }, () => Math.exp(0.5 * normal(r)));
    const tot0 = K.reduce((a, b) => a + b, 0); for (let i = 0; i < N; i++) K[i] = (K[i] / tot0) * invest * 0.5;
    const anticip = strat === "laissez" ? 0 : expropriation;
    const startInvest = invest * (1 - pc("kappa") * anticip);
    let I = startInvest;
    for (let y = 0; y < P.boomYears; y++) {
      const w = K.map((k) => Math.pow(k, P.alpha)), ws = w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < N; i++) K[i] += (I * w[i]) / ws;
      I *= 1 + pc("hype");
    }
    const peakK = K.reduce((a, b) => a + b, 0);
    const champ = K.indexOf(Math.max(...K));
    const share = K.map((k) => k / peakK);
    // 2. Consolidation: crash
    const induced = strat === "cycle" && P.induced >= 0.5;
    const pf = clamp(pc("pFail") + (induced ? 0.2 : 0));
    const failed = strat === "directed" ? share.map((s, i) => i !== champ && s < pc("shareFail")) : share.map((s, i) => i !== champ && s < pc("shareFail") && r() < pf);
    const failedK = K.reduce((a, k, i) => a + (failed[i] ? k : 0), 0);
    const contagion = induced ? pc("contagion") * peakK : 0;
    // champion's own capability: its capital, eroded by complacency, minus offshoring in anticipation
    const offshoreRate = strat === "laissez" ? 0 : clamp(pc("offshore0") + c * pc("offshoreLearn"), 0, 0.9);
    const yearsCycle = P.boomYears + P.specYears;
    const erosion = strat === "laissez" ? 0.5 * pc("complacency") : pc("complacency") * (1 - (strat === "cycle" ? pc("threat") : 0.5 * pc("threat")));
    champCap = (champCap + K[champ] * (induced ? 0.95 : 1) * (1 - offshoreRate * pc("champOffshore"))) * Math.pow(1 - erosion, yearsCycle); // offshoring hits the new sector's crown jewels
    let acq = 0, legal = 0, reloc = 0, opex = 0, sales = 0, retal = 0, jobs = 0, talentKept = 0, offshored = 0, premium = 0, capability = 0;
    let legalLost = false, retaliated = false, kept = 0, transferIn = 0, domestic = 0;
    const survK = K.reduce((a, k, i) => a + (!failed[i] && i !== champ ? k : 0), 0);
    if (strat === "laissez") {
      // Market insolvency: buyers pay the recovery price; the champion picks up a slice through M&A.
      domestic = failedK * pc("lfRedeploy") * (1 - pc("foreign") * 0.5);
      capability = 0.3 * domestic; // the champion buys a slice through ordinary M&A
      champCap += capability; domestic -= capability;
    } else if (strat === "directed") {
      // State brokers mergers of the weaker firms into the champion at the peak: no fire sale, less talent loss.
      acq = 0.3 * failedK; // compensation and sweeteners
      offshored = failedK * offshoreRate * 0.5;
      talentKept = clamp(0.75 + 0.08 * normal(r));
      capability = (failedK - offshored) * 0.5 * (0.3 + 0.7 * talentKept); // forced-merger integration is lossy
      champCap += capability;
      const pR = clamp(pc("pRetal") * 0.5 * (pc("foreign") / 0.4));
      if (r() < pR) { retal = P.retalCost; retaliated = true; }
    } else {
      // 3. Seizure
      const stat = route === "statute";
      const price = stat ? pc("statPrice") : pc("insolPrice");
      let delay = stat ? P.statDelay : P.insolDelay;
      acq = price * failedK;
      if (stat && r() < pc("pLegal")) { legal = pc("legalCost") * failedK; delay += 1; legalLost = true; }
      const pR = clamp(pc("pRetal") * (stat ? 1 : 0.2) * (pc("foreign") / 0.4));
      if (r() < pR) { retal = P.retalCost; retaliated = true; }
      offshored = failedK * offshoreRate;
      const V = (failedK - offshored) * Math.pow(1 - pc("decay"), delay);
      // 4. Triage and resale
      const Vs = V * pc("strategic"), Vn = V - Vs;
      premium = Math.max(0.05, pc("premium0") * Math.pow(1 - pc("premiumLearn"), c) * (1 + 0.1 * normal(r)));
      sales = Vn * pc("nsi") * premium + Vn * (1 - pc("nsi")) * pc("domPrice");
      domestic = Vn * (1 - pc("nsi")); kept = Vs;
      // 5. Relocation
      talentKept = clamp(pc("talent") + 0.1 * normal(r));
      reloc = pc("relocCost") * Vs;
      jobs = Vs * P.jobsPerBn * (0.5 + 0.5 * talentKept) * (1 + P.multiplier);
      // 6. Specialisation
      opex = pc("opex") * Vs * P.specYears;
      const S = pc("eta") * Vs * (0.3 + 0.7 * talentKept);
      // 7. Reintegration
      capability = pc("iota") * S;
      transferIn = pc("transfer") * capability;
      champCap += capability;
    }
    const net = sales + transferIn - acq - legal - reloc - opex - contagion - retal;
    natCap += survK + domestic;
    out.push({ natCap: natCap + champCap, kept, transferIn, invest: startInvest, peakK, champShare: share[champ], failedK, acq, legal, reloc, opex, contagion, sales, retal, net, jobs, talent: talentKept, offshored, premium, capability, champCap, legalLost, retaliated });
    // 8. Next sector: investors update their expectation of expropriation (share of value taken below cost)
    if (strat !== "laissez") {
      const taken = failedK > 0 ? clamp(1 - (acq + legal) / failedK) * (failedK / peakK) : 0;
      expropriation = clamp(0.5 * expropriation + 0.5 * taken * (strat === "directed" ? 0.6 : 1)); // adaptive expectations
    }
    invest = invest * pc("sectorScale");
  }
  const sum = (k: keyof CycleOut) => out.reduce((a, x) => a + (x[k] as number), 0);
  return { cycles: out, net: sum("net"), jobs: sum("jobs"), capability: out.at(-1)!.champCap, natCap: out.at(-1)!.natCap, investFirst: out[0].invest, investLast: out.at(-1)!.invest, champShare: out.at(-1)!.champShare };
}

export type Dist = { p10: number; p50: number; p90: number; mean: number };
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; };
export const dist = (a: number[]): Dist => ({ p10: q(a, 0.1), p50: q(a, 0.5), p90: q(a, 0.9), mean: a.reduce((x, y) => x + y, 0) / a.length });

export function monteCarlo(P: CycleParams, route: Route, strat: Strategy, runs = 400, seed = 7) {
  const R = Array.from({ length: runs }, (_, i) => runOnce(P, route, strat, seed * 100003 + i));
  const C = Math.round(P.cycles);
  const perCycle = Array.from({ length: C }, (_, c) => {
    const f = (k: keyof CycleOut) => dist(R.map((r) => r.cycles[c][k] as number));
    return { c: c + 1, invest: f("invest"), net: f("net"), jobs: f("jobs"), capability: f("champCap"), natCap: f("natCap"), kept: f("kept"), premium: f("premium"), offshored: f("offshored"), sales: f("sales"), acq: f("acq"), failedK: f("failedK"), talent: f("talent"), pLegal: R.filter((r) => r.cycles[c].legalLost).length / runs, pRetal: R.filter((r) => r.cycles[c].retaliated).length / runs };
  });
  return { runs: R, natCap: dist(R.map((r) => r.natCap)), net: dist(R.map((r) => r.net)), jobs: dist(R.map((r) => r.jobs)), capability: dist(R.map((r) => r.capability)), investDrop: dist(R.map((r) => r.investLast / r.investFirst)), pNetPositive: R.filter((r) => r.net > 0).length / runs, perCycle };
}

// One-at-a-time sensitivity of the median outcome to each parameter (±50% of its value, within bounds)
export function sensitivity(P: CycleParams, route: Route, metric: "net" | "capability" | "jobs" | "natCap", ids: string[], runs = 120) {
  const base = monteCarlo(P, route, "cycle", runs)[metric].p50;
  return ids.map((id) => {
    const d = CP.find((p) => p.id === id)!;
    const lo = Math.max(d.min, P[id] * 0.5), hi = Math.min(d.max, P[id] === 0 ? d.max / 2 : P[id] * 1.5);
    const a = monteCarlo({ ...P, [id]: lo }, route, "cycle", runs)[metric].p50, b = monteCarlo({ ...P, [id]: hi }, route, "cycle", runs)[metric].p50;
    return { id, label: d.label, lo, hi, dLo: a - base, dHi: b - base, range: Math.abs(b - a) };
  }).sort((x, y) => y.range - x.range);
}
