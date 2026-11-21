import React, { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Loading, Page, Seg, Source } from "../ui";
import { buildBaseline, LEVERS, Levers, PRESETS, Result, RULE_YEAR, simulate, YEARS, ZERO } from "../sim/engine";
import { defaultParams, PARAMS, ParamValues } from "../sim/params";

type Scenario = { name: string; levers: Levers; params: Partial<ParamValues>; notes?: string };
const LS = "atlas-scenarios";
const readSaved = (): Scenario[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };
const enc = (s: Scenario) => btoa(unescape(encodeURIComponent(JSON.stringify(s))));
const dec = (s: string): Scenario | null => { try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; } };
export const scenarioLink = (s: Scenario) => `#/simulate?s=${encodeURIComponent(enc(s))}`;

function fromHash(): Scenario | null {
  const m = location.hash.match(/[?&]s=([^&]+)/);
  return m ? dec(decodeURIComponent(m[1])) : null;
}
const sign = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
const bn = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}£${Math.abs(v).toFixed(1)}bn`;

export default function Simulate() {
  const d = useData("fiscal", "spending", "nhs_performance", "welfare", "civil_service", "councils", "sim_params");
  const init = useMemo(fromHash, []);
  const [name, setName] = useState(init?.name ?? "My scenario");
  const [L, setL] = useState<Levers>({ ...ZERO, ...(init?.levers ?? {}) });
  const [over, setOver] = useState<Partial<ParamValues>>(init?.params ?? {});
  const [yr, setYr] = useState(YEARS.indexOf(RULE_YEAR));
  const [tab, setTab] = useState<"system" | "charts" | "channels" | "params">("system");
  const [saved, setSaved] = useState<Scenario[]>(readSaved);
  const [copied, setCopied] = useState(false);
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(saved)); } catch {} }, [saved]);
  const B = useMemo(() => d && buildBaseline(...(d as [any, any, any, any, any, any, any])), [d]);
  const P = useMemo(() => ({ ...defaultParams(), ...over }) as ParamValues, [over]);
  const R = useMemo(() => B && simulate(B, L, P), [B, L, P]);
  if (!B || !R) return <Loading />;
  const set = (k: keyof Levers, v: number) => setL((x) => ({ ...x, [k]: v }));
  const scen: Scenario = { name, levers: L, params: over };
  const active = LEVERS.filter((l) => L[l.k] !== 0);
  let group = "";

  return <Page title="Policy simulator" lede={<>Change taxes, budgets and the machinery of government, and watch the effects spread through the public finances, the economy and public services from {YEARS[0]} to {YEARS.at(-1)}. The baseline is the OBR's October 2026 forecast. Every parameter shows its source and can be edited.</>}
    right={<div className="controls" style={{ margin: 0 }}>
      <select value="" onChange={(e) => { const p = PRESETS[+e.target.value]; if (p) { setL({ ...ZERO, start: L.start, ...p.levers }); setName(p.name); } }}><option value="">Load a preset…</option>{PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}</select>
      {saved.length > 0 && <select value="" onChange={(e) => { const s = saved[+e.target.value]; if (s) { setL({ ...ZERO, ...s.levers }); setOver(s.params); setName(s.name); } }}><option value="">Saved scenarios…</option>{saved.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</select>}
    </div>}>
    <div className="sim">
      <aside className="card sim-levers">
        <input className="sim-name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Scenario name" />
        <div className="controls" style={{ marginTop: 8 }}>
          <label className="muted">Policy starts in <select value={L.start} onChange={(e) => set("start", +e.target.value)}>{YEARS.map((y, i) => <option key={y} value={i}>{y}</option>)}</select></label>
        </div>
        <div className="controls">
          <button className="seg" onClick={() => setSaved((s) => [...s.filter((x) => x.name !== name), scen])}>Save</button>
          <button className="seg" onClick={() => { const u = location.href.split("#")[0] + scenarioLink(scen); navigator.clipboard?.writeText(u).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? "Copied" : "Copy link"}</button>
          <button className="seg" onClick={() => { setL({ ...ZERO, start: L.start }); setOver({}); }}>Reset</button>
        </div>
        {LEVERS.map((l) => <React.Fragment key={l.k}>
          {l.group !== group && (group = l.group) && <div className="nav-group" style={{ padding: "12px 0 2px" }}>{l.group}</div>}
          <div className={`lever ${L[l.k] ? "on" : ""}`} title={l.help}>
            <div className="lever-head"><span>{l.label}</span><span className="lever-v">{sign(L[l.k], l.step < 1 ? (l.step < 0.5 ? 2 : 1) : 0)}{l.unit === "£bn" ? "bn" : ` ${l.unit}`}</span></div>
            <input type="range" min={l.min} max={l.max} step={l.step} value={L[l.k]} onChange={(e) => set(l.k, +e.target.value)} onDoubleClick={() => set(l.k, 0)} aria-label={l.label} />
          </div>
        </React.Fragment>)}
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Double-click a slider to reset it.</div>
      </aside>

      <div className="sim-out">
        <Headline R={R} B={B} yr={yr} />
        <div className="controls" style={{ marginTop: 14 }}>
          <Seg v={tab} set={setTab} opts={[["system", "How it spreads"], ["charts", "Charts"], ["channels", "Year by year"], ["params", `Parameters${Object.keys(over).length ? ` (${Object.keys(over).length} edited)` : ""}`]]} />
          {(tab === "system") && <span style={{ marginLeft: "auto" }}><Seg v={String(yr)} set={(v) => setYr(+v)} opts={YEARS.map((y, i) => [String(i), y] as [string, string])} /></span>}
        </div>
        {tab === "system" && <SystemMap R={R} B={B} t={yr} L={L} />}
        {tab === "charts" && <Charts R={R} B={B} />}
        {tab === "channels" && <Channels R={R} />}
        {tab === "params" && <Params P={P} over={over} setOver={setOver} />}
        {active.length === 0 && tab === "system" && <div className="flag gap" style={{ marginTop: 12 }}>Move a lever on the left or load a preset to see a policy spread through the system. The baseline is the OBR forecast with no change in policy.</div>}
        <Card title="What this model is, and is not" style={{ marginTop: 14 }}>
          <div className="prose muted" style={{ fontSize: 13 }}>
            <p>This is a transparent, small, linear model in the spirit of the OBR's own costings, built so you can see every step and argue with every number. Tax yields come from HMRC's ready reckoner, which already includes behavioural responses, and are only valid for changes of a few points. Demand effects use the OBR's multipliers and fade as monetary policy responds. Public investment adds to potential output using the OBR's estimate. Any change in output then feeds back into borrowing through automatic stabilisers, and extra debt carries interest.</p>
            <p>The model does not include: distributional effects, changes in the inflation or Bank Rate path, migration, tax-specific supply effects (for example, corporation tax on business investment), how departments really spend extra money, or Scottish, Welsh and Northern Irish block grant (Barnett) consequentials. The service models (NHS waiting list, council reserves) use stated assumptions rather than official elasticities, so read them as directions and orders of magnitude.</p>
          </div>
          <Source s={B.sources} />
        </Card>
      </div>
    </div>
  </Page>;
}

function Headline({ R, B, yr }: { R: Result; B: any; yr: number }) {
  const t = YEARS.length - 1, ri = YEARS.indexOf(RULE_YEAR);
  const S = R.rules.stability;
  const items = [
    { l: `Borrowing ${YEARS[t]}`, v: `£${R.psnb[t].toFixed(0)}bn`, d: bn(R.dPsnb[t]) + " vs baseline", c: R.dPsnb[t] > 0.05 ? "var(--red)" : R.dPsnb[t] < -0.05 ? "var(--green)" : undefined },
    { l: `Debt, % of GDP ${YEARS[t]}`, v: fmt.pct(R.psndPct[t]), d: `${sign(R.psndPct[t] - (B.psnd[t] / B.gdp[t]) * 100, 2)} pts vs baseline` },
    { l: `Real GDP level ${YEARS[t]}`, v: `${sign(R.gdpPct[t], 2)}%`, d: `of which supply side ${sign(R.supply[t], 2)}%` },
    { l: "Unemployment, peak change", v: `${sign(R.unemploymentK.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0), 0)}k`, d: "people, from the demand effect" },
    { l: `NHS waiting list ${YEARS[t]}`, v: `${(R.waiting[t] / 1e6).toFixed(2)}m`, d: `${sign((R.waiting[t] - R.waitingBase[t]) / 1e6, 2)}m vs baseline (${B.waitingMonth}: ${(B.waiting / 1e6).toFixed(1)}m)` },
    { l: `Stability rule ${RULE_YEAR}`, v: S.met ? "Met" : "Broken", d: `current budget ${S.scen >= 0 ? "surplus" : "deficit"} £${Math.abs(S.scen).toFixed(1)}bn (baseline £${S.base.toFixed(1)}bn surplus)`, c: S.met ? "var(--green)" : "var(--red)" },
  ];
  return <div className="grid g3">{items.map((x) => <div key={x.l} className="card stat"><div className="v" style={{ color: x.c, fontSize: 22 }}>{x.v}</div><div className="l">{x.l}</div><div className="d muted">{x.d}</div></div>)}</div>;
}

// The system as a node graph: levers → fiscal → economy → feedback → debt; and service nodes.
function SystemMap({ R, B, t, L }: { R: Result; B: any; t: number; L: Levers }) {
  const rec = R.dReceipts.reduce((s, c) => s + c.v[t], 0), sp = R.dSpend.reduce((s, c) => s + c.v[t], 0);
  const cap = R.dSpend.find((c) => c.id === "capital")!.v[t];
  const nodes: { id: string; x: number; y: number; t: string; v: string; on: boolean; tone?: "good" | "bad" }[] = [
    { id: "tax", x: 90, y: 80, t: "Tax changes", v: bn(rec), on: Math.abs(rec) > 0.01, tone: rec > 0 ? "good" : rec < 0 ? "bad" : undefined },
    { id: "spend", x: 90, y: 190, t: "Spending changes", v: bn(sp), on: Math.abs(sp) > 0.01 },
    { id: "shock", x: 300, y: 300, t: "Gilt yields", v: L.giltShock ? `${sign(L.giltShock, 2)}pp` : "no change", on: !!L.giltShock },
    { id: "demand", x: 300, y: 80, t: "Demand (multipliers)", v: `${sign(R.demand[t], 2)}% GDP`, on: Math.abs(R.demand[t]) > 0.001 },
    { id: "supply", x: 300, y: 190, t: "Potential output", v: `${sign(R.supply[t], 2)}% GDP`, on: Math.abs(R.supply[t]) > 0.001 },
    { id: "jobs", x: 510, y: 40, t: "Unemployment", v: `${sign(R.unemploymentK[t], 0)}k`, on: Math.abs(R.unemploymentK[t]) > 0.5 },
    { id: "stab", x: 510, y: 130, t: "Automatic stabilisers", v: bn(R.stabiliser[t]), on: Math.abs(R.stabiliser[t]) > 0.01 },
    { id: "interest", x: 510, y: 300, t: "Debt interest", v: bn(R.interest[t]), on: Math.abs(R.interest[t]) > 0.01 },
    { id: "psnb", x: 720, y: 190, t: "Borrowing", v: bn(R.dPsnb[t]), on: Math.abs(R.dPsnb[t]) > 0.01, tone: R.dPsnb[t] > 0.05 ? "bad" : R.dPsnb[t] < -0.05 ? "good" : undefined },
    { id: "debt", x: 720, y: 300, t: "Debt", v: `${fmt.pct(R.psndPct[t])} GDP`, on: Math.abs(R.dPsnd[t]) > 0.01 },
    { id: "rules", x: 720, y: 80, t: "Fiscal rules", v: R.rules.stability.met && R.rules.investment.met ? "both met" : !R.rules.stability.met && !R.rules.investment.met ? "both broken" : R.rules.stability.met ? "investment rule broken" : "stability rule broken", on: true, tone: R.rules.stability.met && R.rules.investment.met ? "good" : "bad" },
    { id: "nhs", x: 300, y: 410, t: "NHS waiting list", v: `${sign((R.waiting[t] - R.waitingBase[t]) / 1e6, 2)}m`, on: Math.abs(R.waiting[t] - R.waitingBase[t]) > 1000, tone: R.waiting[t] < R.waitingBase[t] ? "good" : R.waiting[t] > R.waitingBase[t] ? "bad" : undefined },
    { id: "la", x: 510, y: 410, t: "Council reserves", v: `£${R.laReserves[t].toFixed(1)}bn`, on: Math.abs(R.laReserves[t] - R.laReservesBase[t]) > 0.01, tone: R.laReserves[t] < 0 ? "bad" : undefined },
    { id: "send", x: 720, y: 410, t: "SEND deficit", v: `£${R.dsgDeficit[t].toFixed(1)}bn`, on: Math.abs(R.dsgDeficit[t] - R.dsgDeficitBase[t]) > 0.01, tone: R.dsgDeficit[t] > B.la.dsgDeficit ? "bad" : "good" },
    { id: "cs", x: 90, y: 410, t: "Civil service", v: `${fmt.n(R.csHeadcount[t])} staff`, on: R.csHeadcount[t] !== B.csHeadcount },
  ];
  const E: [string, string][] = [["tax", "demand"], ["spend", "demand"], ["spend", "supply"], ["demand", "jobs"], ["demand", "stab"], ["supply", "stab"], ["stab", "psnb"], ["tax", "psnb"], ["spend", "psnb"], ["shock", "interest"], ["interest", "psnb"], ["psnb", "debt"], ["debt", "interest"], ["psnb", "rules"], ["spend", "nhs"], ["spend", "la"], ["spend", "send"], ["spend", "cs"]];
  const N = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const W = 150, H = 56;
  return <div className="card" style={{ overflowX: "auto" }}>
    <h2>How the policy spreads in {YEARS[t]}</h2>
    <div className="sub">Lit boxes are where this scenario moves something. Values are changes against the OBR baseline, except debt, reserves and the deficit, which are levels. {cap ? `Capital spending (${bn(cap)}) counts towards borrowing but not the current budget.` : ""}</div>
    <svg viewBox="0 10 810 450" style={{ width: "100%", minWidth: 640, height: "auto" }} role="img" aria-label="System propagation diagram">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--muted)" /></marker></defs>
      {E.map(([a, b], i) => { const A = N[a], Bn = N[b]; const lit = A.on && Bn.on; const x1 = A.x + W / 2, y1 = A.y, x2 = Bn.x - W / 2, y2 = Bn.y;
        const back = Bn.x < A.x - 5; const same = back && Math.abs(Bn.y - A.y) < 5; const path = same ? `M${A.x - W / 2},${A.y + 12} L${Bn.x + W / 2},${Bn.y + 12}` : back ? `M${A.x},${A.y - H / 2} C${A.x},${A.y - 70} ${Bn.x},${Bn.y + 70} ${Bn.x},${Bn.y + H / 2}` : Math.abs(Bn.x - A.x) < 5 ? (Bn.y > A.y ? `M${A.x},${A.y + H / 2} L${Bn.x},${Bn.y - H / 2}` : `M${A.x},${A.y - H / 2} L${Bn.x},${Bn.y + H / 2}`) : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
        return <path key={i} d={path} fill="none" stroke={lit ? "var(--accent)" : "var(--line)"} strokeWidth={lit ? 2 : 1.2} markerEnd="url(#arr)" opacity={lit ? 1 : 0.8} />; })}
      {nodes.map((n) => <g key={n.id} transform={`translate(${n.x - W / 2},${n.y - H / 2})`}>
        <rect width={W} height={H} rx={9} fill={n.on ? "var(--accent-soft)" : "var(--panel)"} stroke={n.tone === "bad" && n.on ? "var(--red)" : n.tone === "good" && n.on ? "var(--green)" : n.on ? "var(--accent)" : "var(--line)"} strokeWidth={n.on ? 1.6 : 1} />
        <text x={W / 2} y={22} textAnchor="middle" fontSize={12} fill="var(--muted)">{n.t}</text>
        <text x={W / 2} y={42} textAnchor="middle" fontSize={14} fontWeight={600} fill={n.tone === "bad" && n.on ? "var(--red)" : n.tone === "good" && n.on ? "var(--green)" : "var(--ink)"}>{n.v}</text>
      </g>)}
    </svg>
    <Trace R={R} t={t} />
  </div>;
}

function Trace({ R, t }: { R: Result; t: number }) {
  const rows = [...R.dReceipts.map((c) => ({ l: `${c.label}: receipts`, v: c.v[t] })), ...R.dSpend.map((c) => ({ l: `${c.label}: spending`, v: -c.v[t] }))].filter((r) => Math.abs(r.v) > 0.005);
  if (!rows.length && !R.interest[t]) return null;
  return <div style={{ marginTop: 10 }}>
    <h3>Borrowing in {YEARS[t]}, step by step (+ reduces borrowing)</h3>
    <table><tbody>
      {rows.map((r) => <tr key={r.l}><td>{r.l}</td><td className="n">{bn(r.v)}</td></tr>)}
      <tr><td>Automatic stabilisers (output {sign(R.gdpPct[t], 2)}%)</td><td className="n">{bn(-R.stabiliser[t])}</td></tr>
      <tr><td>Debt interest on extra debt and any gilt shock</td><td className="n">{bn(-R.interest[t])}</td></tr>
      <tr><td><b>Change in borrowing</b></td><td className="n"><b>{bn(R.dPsnb[t])}</b></td></tr>
    </tbody></table>
  </div>;
}

function Charts({ R, B }: { R: Result; B: any }) {
  const rows = YEARS.map((y, t) => ({ y, psnb: +R.psnb[t].toFixed(1), psnbB: +B.psnb[t].toFixed(1), debt: +R.psndPct[t].toFixed(2), debtB: +((B.psnd[t] / B.gdp[t]) * 100).toFixed(2), gdp: +R.gdpPct[t].toFixed(3), dem: +R.demand[t].toFixed(3), sup: +R.supply[t].toFixed(3), w: +(R.waiting[t] / 1e6).toFixed(3), wB: +(R.waitingBase[t] / 1e6).toFixed(3), la: +R.laReserves[t].toFixed(2), laB: +R.laReservesBase[t].toFixed(2), dsg: +R.dsgDeficit[t].toFixed(2), dsgB: +R.dsgDeficitBase[t].toFixed(2) }));
  const C = ({ title, sub, lines }: { title: string; sub: string; lines: [string, string, string, boolean?][] }) => <Card title={title} sub={sub}>
    <ResponsiveContainer width="100%" height={230}><LineChart data={rows} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis domain={["auto", "auto"]} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
      {lines.map(([k, n, c, dash]) => <Line key={k} dataKey={k} name={n} stroke={c} strokeDasharray={dash ? "4 4" : undefined} dot={false} strokeWidth={2} />)}</LineChart></ResponsiveContainer></Card>;
  return <div className="grid g2">
    <C title="Public sector net borrowing" sub="£bn, scenario against OBR baseline" lines={[["psnb", "Scenario", "var(--c1)"], ["psnbB", "Baseline", "var(--muted)", true]]} />
    <C title="Public sector net debt" sub="% of GDP" lines={[["debt", "Scenario", "var(--c1)"], ["debtB", "Baseline", "var(--muted)", true]]} />
    <C title="Real GDP level" sub="% difference from baseline" lines={[["gdp", "Total", "var(--c1)"], ["dem", "Demand", "var(--c2)", true], ["sup", "Supply side", "var(--c3)", true]]} />
    <C title="NHS England elective waiting list" sub="millions of pathways" lines={[["w", "Scenario", "var(--c1)"], ["wB", "Baseline", "var(--muted)", true]]} />
    <C title="Council usable reserves" sub="£bn, unallocated plus budget stabilisation reserves, England" lines={[["la", "Scenario", "var(--c1)"], ["laB", "Baseline", "var(--muted)", true]]} />
    <C title="High-needs (SEND) deficit" sub="£bn, England" lines={[["dsg", "Scenario", "var(--c4)"], ["dsgB", "Baseline", "var(--muted)", true]]} />
  </div>;
}

function Channels({ R }: { R: Result }) {
  const row = (l: string, v: number[], f = bn) => <tr key={l}><td>{l}</td>{v.map((x, i) => <td key={i} className="n">{f(x)}</td>)}</tr>;
  const pct = (x: number) => `${sign(x, 2)}%`;
  return <Card title="Every channel, every year" sub="£bn unless stated. Receipts: + means more revenue. Spending: + means more spending.">
    <div className="scroll"><table><thead><tr><th>Channel</th>{YEARS.map((y) => <th key={y} className="n">{y}</th>)}</tr></thead><tbody>
      <tr><td colSpan={6}><b>Receipts (HMRC ready reckoner)</b></td></tr>
      {R.dReceipts.filter((c) => c.v.some((x) => x)).map((c) => row(c.label, c.v))}
      <tr><td colSpan={6}><b>Spending</b></td></tr>
      {R.dSpend.filter((c) => c.v.some((x) => x)).map((c) => row(c.label, c.v))}
      <tr><td colSpan={6}><b>Economy</b></td></tr>
      {row("Demand effect on GDP", R.demand, pct)}{row("Supply-side effect on GDP", R.supply, pct)}{row("Unemployment (thousands)", R.unemploymentK, (x) => sign(x, 0))}
      <tr><td colSpan={6}><b>Feedback to the public finances</b></td></tr>
      {row("Automatic stabilisers", R.stabiliser)}{row("Debt interest", R.interest)}{row("Change in borrowing", R.dPsnb)}{row("Change in debt", R.dPsnd)}
      <tr><td colSpan={6}><b>Services</b></td></tr>
      {row("NHS waiting list (millions)", R.waiting.map((w, i) => (w - R.waitingBase[i]) / 1e6), (x) => sign(x, 2))}
      {row("Schools, real change in core budget", R.schoolsRealPct, pct)}
      {row("Welfare, % of GDP", R.welfarePct, (x) => fmt.pct(x, 2))}
    </tbody></table></div>
  </Card>;
}

function Params({ P, over, setOver }: { P: ParamValues; over: Partial<ParamValues>; setOver: (f: (o: Partial<ParamValues>) => Partial<ParamValues>) => void }) {
  let g = "";
  return <Card title="Parameters" sub="Official = published by a UK public body. Research = peer-reviewed or institute estimate. Assumption = a choice made in this model, stated so you can change it.">
    <div className="scroll" style={{ maxHeight: 700 }}><table><thead><tr><th>Parameter</th><th className="n">Value</th><th>Basis</th></tr></thead><tbody>
      {PARAMS.map((p) => <React.Fragment key={p.id}>
        {p.group !== g && (g = p.group) && <tr><td colSpan={3}><b>{p.group}</b></td></tr>}
        <tr><td>{p.label}<div className="muted" style={{ fontSize: 12 }}>{p.note}</div></td>
          <td className="n" style={{ whiteSpace: "nowrap" }}><input type="number" value={P[p.id]} step={p.step ?? 0.1} onChange={(e) => { const v = e.target.value === "" ? p.value : +e.target.value; setOver((o) => { const n = { ...o }; if (v === p.value) delete n[p.id]; else n[p.id] = v; return n; }); }} style={{ width: 76, textAlign: "right", background: over[p.id] != null ? "var(--accent-soft)" : undefined }} /> <span className="muted">{p.unit}</span></td>
          <td><span className={`pill kind-${p.kind}`}>{p.kind}</span> {p.url ? <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{p.source ?? "link"}</a> : <span className="muted" style={{ fontSize: 12 }}>{p.source}</span>}</td></tr>
      </React.Fragment>)}
    </tbody></table></div>
    {Object.keys(over).length > 0 && <button className="seg" style={{ marginTop: 10 }} onClick={() => setOver(() => ({}))}>Restore all defaults</button>}
  </Card>;
}
