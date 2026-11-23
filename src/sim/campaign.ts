// Campaign mode: policy that changes from year to year.
//
// A campaign is a list of turns. Each turn sets the whole policy (every lever) that applies from its year onwards,
// until a later turn changes it. The single-scenario model assumes one policy switched on in one year, so a
// schedule is built by superposition: each turn adds the difference between running its policy and running the
// previous turn's policy, both switched on in the turn's year. This is exact for the model's linear links and
// handles a lever's nonlinear response (HMRC's diminishing returns, compounding council tax) relative to the level
// already in force. The effects that cannot be added (the waiting-list floor, a SEND deficit that cannot go below
// zero, ratios to GDP, the fiscal rules, events and the scorecard) are recomputed from the combined paths.
import { assess, Baseline, Channel, Event, Levers, Result, simulate, YEARS, ZERO } from "./engine";
import { ParamValues } from "./params";

export type Turn = { t: number; levers: Levers; note?: string };

type Num = number[];
const isNums = (v: unknown): v is Num => Array.isArray(v) && (v.length === 0 || typeof v[0] === "number");
const isChannels = (v: unknown): v is Channel[] => Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] && "v" in (v[0] as object);

/** base + Σ (hi − lo) over every numeric path, channel and service path. */
function superpose(base: Result, parts: [Result, Result][]): Result {
  const add = (b: Num, get: (r: Result) => Num | undefined) => b.map((x, i) => x + parts.reduce((s, [hi, lo]) => s + ((get(hi)?.[i] ?? 0) - (get(lo)?.[i] ?? 0)), 0));
  const out: any = { ...base };
  for (const [k, v] of Object.entries(base)) {
    if (isNums(v)) out[k] = add(v, (r) => (r as any)[k]);
    else if (isChannels(v)) {
      const ids = new Set<string>(v.map((c) => c.id));
      parts.forEach(([hi]) => ((hi as any)[k] as Channel[]).forEach((c) => ids.add(c.id)));
      out[k] = [...ids].map((id) => {
        const find = (r: Result) => ((r as any)[k] as Channel[]).find((c) => c.id === id);
        const b = find(base) ?? find(parts.find(([hi]) => find(hi))![0])!;
        return { ...b, v: add(find(base)?.v ?? b.v.map(() => 0), (r) => find(r)?.v) };
      });
    }
  }
  for (const k of ["S", "SB"] as const) {
    out[k] = {};
    for (const [pk, pv] of Object.entries(base[k])) out[k][pk] = add(pv as Num, (r) => (r[k] as any)[pk]);
  }
  return out as Result;
}

/** Run a schedule of turns. Turns are sorted by year; a turn with the same policy as the one before adds nothing. */
export function simulateSchedule(B: Baseline, turnsIn: Turn[], P: ParamValues, base = simulate(B, ZERO, P)): Result {
  const turns = [...turnsIn].sort((a, b) => a.t - b.t);
  const parts: [Result, Result][] = [];
  let prev: Levers = { ...ZERO };
  const same = (a: Levers, b: Levers) => JSON.stringify({ ...a, start: 0 }) === JSON.stringify({ ...b, start: 0 });
  for (const turn of turns) {
    const L = { ...ZERO, ...turn.levers };
    if (!same(L, prev)) parts.push([simulate(B, { ...L, start: turn.t }, P), simulate(B, { ...prev, start: turn.t }, P)]);
    prev = L;
  }
  if (!parts.length) return base;
  const R = superpose(base, parts);
  const n = YEARS.length, idx = [...Array(n).keys()];

  // Recompute what superposition cannot add.
  const floor = P.wl_floor * 1e6;
  R.waiting = R.waiting.map((w, t) => Math.max(Math.min(R.waitingBase[t], floor), w));
  R.S.waiting = R.waiting;
  R.dsgDeficit = R.dsgRaw.map((d) => Math.max(0, d));
  R.gdp = idx.map((t) => B.gdp[t] * (1 + R.gdpPct[t] / 100));
  R.psnb = idx.map((t) => B.psnb[t] + R.dPsnb[t]);
  R.psnd = idx.map((t) => B.psnd[t] + R.dPsnd[t]);
  R.psndPct = idx.map((t) => (R.psnd[t] / R.gdp[t]) * 100);
  R.psnflPct = idx.map((t) => ((B.psnfl[t] + R.dPsnd[t]) / R.gdp[t]) * 100);
  const A = assess(B, R);
  R.rules = A.rules; R.scores = A.scores;

  // Events that belong to a decision rather than a threshold: cancellations and market shocks, in the year taken.
  const events: Event[] = [...A.events];
  prev = { ...ZERO };
  for (const turn of turns) {
    const L = { ...ZERO, ...turn.levers };
    const cancelled = B.projects.filter((p) => L.projects?.[p.id] === -100 && prev.projects?.[p.id] !== -100);
    if (cancelled.length) events.push({ t: turn.t, tone: "info", area: "Infrastructure", text: `Cancelled: ${cancelled.map((p) => p.name).join(", ")}. Break costs of £${cancelled.reduce((s, p) => s + P.cancel_cost * p.fy, 0).toFixed(1)}bn.` });
    if (L.giltShock - prev.giltShock >= 1) events.push({ t: turn.t, tone: "bad", area: "Public finances", text: `Gilt yields jump ${(L.giltShock - prev.giltShock).toFixed(2)}pp.` });
    prev = L;
  }
  R.events = events.sort((a, b) => a.t - b.t);
  return R;
}
