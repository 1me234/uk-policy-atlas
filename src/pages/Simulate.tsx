import React, { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Loading, Page, Seg, Source } from "../ui";
import { Baseline, buildBaseline, LAST_FORECAST, leverText, LEVERS, Levers, PRESETS, Result, RULE_YEAR, simulate, YEARS, ZERO } from "../sim/engine";
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
  const d = useData("fiscal", "spending", "nhs_performance", "welfare", "civil_service", "councils", "sim_params", "major_projects");
  const init = useMemo(fromHash, []);
  const [name, setName] = useState(init?.name ?? "My scenario");
  const [L, setL] = useState<Levers>({ ...ZERO, ...(init?.levers ?? {}) });
  const [over, setOver] = useState<Partial<ParamValues>>(init?.params ?? {});
  const [yr, setYr] = useState(YEARS.indexOf(RULE_YEAR));
  const [tab, setTab] = useState<"overview" | "system" | "charts" | "channels" | "params">("overview");
  const [open, setOpen] = useState<Record<string, boolean>>({ Tax: true });
  const [saved, setSaved] = useState<Scenario[]>(readSaved);
  const [copied, setCopied] = useState(false);
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(saved)); } catch {} }, [saved]);
  const B = useMemo(() => d && buildBaseline(...(d as [any, any, any, any, any, any, any, any])), [d]);
  const P = useMemo(() => ({ ...defaultParams(), ...over }) as ParamValues, [over]);
  const R = useMemo(() => B && simulate(B, L, P), [B, L, P]);
  if (!B || !R) return <Loading />;
  const set = (k: keyof Levers, v: number) => setL((x) => ({ ...x, [k]: v }));
  const scen: Scenario = { name, levers: L, params: over };
  const active = LEVERS.filter((l) => L[l.k] !== 0);
  const nProj = Object.keys(L.projects ?? {}).length;
  let group = "";

  return <Page title="Policy simulator" lede={<>Run the country for ten years. Change taxes, department budgets, benefits, public services, housing, prisons, the civil service and named infrastructure projects, and watch each change spread through services, people, the economy and the public finances, from {YEARS[0]} to {YEARS.at(-1)}. The baseline is the OBR's latest forecast to {YEARS[LAST_FORECAST]}, extended after that. Every parameter shows its source and can be edited.</>}
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
        {LEVERS.map((l) => { const head = l.group !== group && (group = l.group); const g = l.group; const n = LEVERS.filter((x) => x.group === g && L[x.k]).length;
          return <React.Fragment key={l.k}>
          {head && <button className="lever-group" onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))} aria-expanded={!!open[g]}><span>{open[g] ? "▾" : "▸"} {g}</span>{n > 0 && <span className="pill">{n}</span>}</button>}
          {open[g] && <div className={`lever ${L[l.k] ? "on" : ""}`} title={l.help}>
            <div className="lever-head"><span>{l.label}</span><span className="lever-v">{leverText(l, L[l.k])}</span></div>
            <input type="range" min={l.min} max={l.max} step={l.step} value={L[l.k]} onChange={(e) => set(l.k, +e.target.value)} onDoubleClick={() => set(l.k, 0)} aria-label={l.label} />
            {l.help && <div className="muted lever-help">{l.help}</div>}
          </div>}
        </React.Fragment>; })}
        <button className="lever-group" onClick={() => setOpen((o) => ({ ...o, projects: !o.projects }))} aria-expanded={!!open.projects}><span>{open.projects ? "▾" : "▸"} Major projects</span>{nProj > 0 && <span className="pill">{nProj}</span>}</button>
        {open.projects && <ProjectPicker B={B} L={L} setL={setL} />}
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Double-click a slider to reset it.</div>
      </aside>

      <div className="sim-out">
        <Headline R={R} B={B} yr={yr} />
        <div className="controls" style={{ marginTop: 14 }}>
          <Seg v={tab} set={setTab} opts={[["overview", "Scorecard and events"], ["system", "How it spreads"], ["charts", "Charts"], ["channels", "Year by year"], ["params", `Parameters${Object.keys(over).length ? ` (${Object.keys(over).length} edited)` : ""}`]]} />
          {(tab === "system") && <label className="muted" style={{ marginLeft: "auto" }}>Year <select value={yr} onChange={(e) => setYr(+e.target.value)}>{YEARS.map((y, i) => <option key={y} value={i}>{y}{i > LAST_FORECAST ? " (extrapolated)" : ""}</option>)}</select></label>}
        </div>
        {tab === "overview" && <Overview R={R} />}
        {tab === "system" && <SystemMap R={R} B={B} t={yr} L={L} />}
        {tab === "charts" && <Charts R={R} B={B} />}
        {tab === "channels" && <Channels R={R} />}
        {tab === "params" && <Params P={P} over={over} setOver={setOver} />}
        {active.length === 0 && nProj === 0 && (tab === "system" || tab === "overview") && <div className="flag gap" style={{ marginTop: 12 }}>Move a lever on the left or load a preset to see a policy spread through the system. The baseline is the OBR forecast with no change in policy.</div>}
        <Card title="What this model is, and is not" style={{ marginTop: 14 }}>
          <div className="prose muted" style={{ fontSize: 13 }}>
            <p>This is a transparent, small, linear model in the spirit of the OBR's own costings, built so you can see every step and argue with every number. Each run works through four stages. First, services and people: waiting lists, hospital beds, teachers, police, prisons, homes, temporary accommodation, poverty and the number of people in work. Second, money: tax, spending by programme, Barnett consequentials for the devolved governments, and the cost or saving that follows from the first stage. Third, the economy. Fourth, feedback into borrowing and debt. Tax yields come from HMRC's ready reckoner, which already includes behavioural responses, and are only valid for changes of a few points. Demand effects use the OBR's multipliers and fade as monetary policy responds. Public investment adds to potential output using the OBR's estimate. Any change in output then feeds back into borrowing through automatic stabilisers, and extra debt carries interest.</p>
            <p>The model does not include: distributional effects, changes in the inflation or Bank Rate path, migration, tax-specific supply effects (for example, corporation tax on business investment), how departments really spend extra money, or what the devolved governments do with their Barnett money. Most service links (beds freed by social care, teachers kept by pay, people moved into work, homes built per pound) are stated assumptions rather than official elasticities, so read them as directions and orders of magnitude, and change them in Parameters. Years after {YEARS[LAST_FORECAST]} extend the OBR forecast at constant shares of GDP and are shaded in the charts.</p>
          </div>
          <Source s={B.sources} />
        </Card>
      </div>
    </div>
  </Page>;
}

function Headline({ R, B }: { R: Result; B: Baseline; yr: number }) {
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

export function ProjectPicker({ B, L, setL }: { B: Baseline; L: Levers; setL: (f: (l: Levers) => Levers) => void }) {
  const [q, setQ] = useState("");
  const P = L.projects ?? {};
  const setP = (id: string, v: number) => setL((l) => { const p = { ...(l.projects ?? {}) }; if (v) p[id] = v; else delete p[id]; return { ...l, projects: p }; });
  const rows = B.projects.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.dept.toLowerCase().includes(q.toLowerCase()));
  return <div style={{ fontSize: 12.5 }}>
    <div className="muted" style={{ margin: "4px 0 6px" }}>Infrastructure projects in the Government Major Projects Portfolio, with this year's forecast spend. Cutting or cancelling one saves its spending but loses its contribution to growth; prison and housing projects also change places and homes.</div>
    <input type="search" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: 6 }} />
    <div style={{ maxHeight: 320, overflowY: "auto" }}>{rows.map((p) => <div key={p.id} className={`lever ${P[p.id] ? "on" : ""}`}>
      <div className="lever-head"><span>{p.name.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase())}</span><span className="lever-v">£{p.fy.toFixed(2)}bn/yr</span></div>
      <div className="controls" style={{ margin: "3px 0 0", justifyContent: "space-between" }}><span className="muted">{p.dept}{p.dca ? <> · <span className={`pill ${p.dca.split(/[ /]/)[0].toUpperCase()}`}>{p.dca.slice(0, 12)}</span></> : null}</span>
        <select value={P[p.id] ?? 0} onChange={(e) => setP(p.id, +e.target.value)} style={{ padding: "2px 6px", fontSize: 12 }}>
          <option value={0}>As planned</option><option value={-100}>Cancel</option><option value={-50}>Scale back by half</option><option value={50}>Expand by half</option><option value={100}>Double</option></select></div>
    </div>)}</div>
  </div>;
}

function Overview({ R }: { R: Result }) {
  const fmtv = (v: number, u: string) => u === "" ? fmt.n(v) : u.startsWith("%") || u === "% GDP" ? `${v.toFixed(1)}%` : u === "£bn" ? `£${v.toFixed(1)}bn` : u === "m" ? `${v.toFixed(2)}m` : `${fmt.n(v, Math.abs(v) < 10 ? 1 : 0)}${u.startsWith("k") ? "k" : ""}`;
  let area = "";
  return <div className="grid g2" style={{ alignItems: "start" }}>
    <Card title={`Scorecard, ${YEARS.at(-1)}`} sub="Where the country ends up under this scenario, against the baseline with no change in policy. Green is better, red is worse.">
      <table><thead><tr><th>Measure</th><th className="n">Baseline</th><th className="n">Scenario</th></tr></thead><tbody>
        {R.scores.map((s) => { const d = s.scen - s.base, tiny = Math.abs(d) < Math.max(1e-3, Math.abs(s.base) * 1e-3); const good = s.higherIsBetter == null || tiny ? null : (d > 0) === s.higherIsBetter;
          const head = s.area !== area && (area = s.area);
          return <React.Fragment key={s.label}>{head && <tr><td colSpan={3} className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", paddingTop: 10 }}>{s.area}</td></tr>}
            <tr><td>{s.label}</td><td className="n muted">{s.unit.includes("vs baseline") ? "–" : fmtv(s.base, s.unit)}</td>
              <td className="n" style={{ fontWeight: 600, color: good == null ? undefined : good ? "var(--green)" : "var(--red)" }}>{s.unit.includes("vs baseline") ? `${sign(s.scen, s.unit.startsWith("%") ? 2 : 0)}${s.unit.startsWith("%") ? "%" : "k"}` : fmtv(s.scen, s.unit)}</td></tr></React.Fragment>; })}
      </tbody></table>
    </Card>
    <Card title="What happens, year by year" sub="Thresholds this scenario crosses that the baseline does not, or avoids.">
      {R.events.length === 0 ? <div className="muted">Nothing crosses a threshold yet.</div> :
        <div className="timeline">{R.events.map((e, i) => <div key={i} className="tl-item" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12 }} className="muted"><b style={{ color: "var(--ink)" }}>{YEARS[e.t]}</b> · {e.area}{e.t > LAST_FORECAST ? " · extrapolated" : ""}</div>
          <div className={`flag ${e.tone === "good" ? "good" : e.tone === "info" ? "gap" : ""}`} style={{ margin: "3px 0 0" }}>{e.text}</div></div>)}</div>}
    </Card>
  </div>;
}

// The system as a node graph: levers → services and people → money → economy → feedback → debt.
function SystemMap({ R, B, t, L }: { R: Result; B: Baseline; t: number; L: Levers }) {
  const rec = R.dReceipts.reduce((s, c) => s + c.v[t], 0), sp = R.dSpend.reduce((s, c) => s + c.v[t], 0);
  const cap = ["capital", "housing", "prisons", "projects"].reduce((s, id) => s + R.dSpend.find((c) => c.id === id)!.v[t], 0);
  const S = R.S, SB = R.SB, dd = (a: number[], b: number[]) => a[t] - b[t];
  const tone = (d: number, better: boolean, eps = 1e-6) => Math.abs(d) < eps ? undefined : (d > 0) === better ? "good" as const : "bad" as const;
  const kfmt = (v: number) => `${sign(v, Math.abs(v) < 10 ? 1 : 0)}k`;
  const nodes: { id: string; x: number; y: number; t: string; v: string; on: boolean; tone?: "good" | "bad" }[] = [
    { id: "tax", x: 90, y: 80, t: "Tax changes", v: bn(rec), on: Math.abs(rec) > 0.01, tone: tone(rec, true, 0.01) },
    { id: "spend", x: 90, y: 190, t: "Spending changes", v: bn(sp), on: Math.abs(sp) > 0.01 },
    { id: "labour", x: 90, y: 300, t: "Labour supply", v: kfmt(S.labour[t]), on: Math.abs(S.labour[t]) > 0.05, tone: tone(S.labour[t], true, 0.05) },
    { id: "demand", x: 300, y: 80, t: "Demand (multipliers)", v: `${sign(R.demand[t], 2)}% GDP`, on: Math.abs(R.demand[t]) > 0.001 },
    { id: "supply", x: 300, y: 190, t: "Potential output", v: `${sign(R.supply[t], 2)}% GDP`, on: Math.abs(R.supply[t]) > 0.001, tone: tone(R.supply[t], true, 0.001) },
    { id: "shock", x: 300, y: 300, t: "Gilt yields", v: L.giltShock ? `${sign(L.giltShock, 2)}pp` : "no change", on: !!L.giltShock, tone: L.giltShock > 0 ? "bad" : L.giltShock < 0 ? "good" : undefined },
    { id: "jobs", x: 510, y: 40, t: "Unemployment", v: kfmt(R.unemploymentK[t]), on: Math.abs(R.unemploymentK[t]) > 0.5, tone: tone(R.unemploymentK[t], false, 0.5) },
    { id: "stab", x: 510, y: 130, t: "Automatic stabilisers", v: bn(R.stabiliser[t]), on: Math.abs(R.stabiliser[t]) > 0.01 },
    { id: "interest", x: 510, y: 300, t: "Debt interest", v: bn(R.interest[t]), on: Math.abs(R.interest[t]) > 0.01, tone: tone(R.interest[t], false, 0.01) },
    { id: "rules", x: 720, y: 80, t: "Fiscal rules", v: R.rules.stability.met && R.rules.investment.met ? "both met" : !R.rules.stability.met && !R.rules.investment.met ? "both broken" : R.rules.stability.met ? "investment rule broken" : "stability rule broken", on: true, tone: R.rules.stability.met && R.rules.investment.met ? "good" : "bad" },
    { id: "psnb", x: 720, y: 190, t: "Borrowing", v: bn(R.dPsnb[t]), on: Math.abs(R.dPsnb[t]) > 0.01, tone: tone(R.dPsnb[t], false, 0.05) },
    { id: "debt", x: 720, y: 300, t: "Debt", v: `${fmt.pct(R.psndPct[t])} GDP`, on: Math.abs(R.dPsnd[t]) > 0.01 },
    { id: "care", x: 90, y: 420, t: "Delayed discharges", v: `${fmt.n(S.delayed[t])} beds`, on: S.delayed[t] !== SB.delayed[t], tone: tone(dd(S.delayed, SB.delayed), false) },
    { id: "nhs", x: 300, y: 420, t: "NHS waiting list", v: `${sign(dd(R.waiting, R.waitingBase) / 1e6, 2)}m`, on: Math.abs(dd(R.waiting, R.waitingBase)) > 1000, tone: tone(dd(R.waiting, R.waitingBase), false, 1000) },
    { id: "la", x: 510, y: 420, t: "Council reserves", v: `£${R.laReserves[t].toFixed(1)}bn`, on: Math.abs(dd(R.laReserves, R.laReservesBase)) > 0.01, tone: R.laReserves[t] < 0 ? "bad" : tone(dd(R.laReserves, R.laReservesBase), true, 0.01) },
    { id: "send", x: 720, y: 420, t: "SEND deficit", v: `£${R.dsgDeficit[t].toFixed(1)}bn`, on: Math.abs(dd(R.dsgDeficit, R.dsgDeficitBase)) > 0.01, tone: tone(dd(R.dsgDeficit, R.dsgDeficitBase), false, 0.01) },
    { id: "homes", x: 90, y: 530, t: "Homes built", v: `${fmt.n(S.homes[t])}k a year`, on: Math.abs(dd(S.homes, SB.homes)) > 0.05, tone: tone(dd(S.homes, SB.homes), true, 0.05) },
    { id: "ta", x: 300, y: 530, t: "Temp. accommodation", v: kfmt(dd(S.ta, SB.ta)), on: Math.abs(dd(S.ta, SB.ta)) > 0.05, tone: tone(dd(S.ta, SB.ta), false, 0.05) },
    { id: "prisons", x: 510, y: 530, t: "Prison places spare", v: `${(S.prisonCap[t] - S.prisonPop[t]).toFixed(1)}k`, on: Math.abs(dd(S.prisonCap, SB.prisonCap) - dd(S.prisonPop, SB.prisonPop)) > 0.01, tone: S.prisonCap[t] < S.prisonPop[t] ? "bad" : "good" },
    { id: "pov", x: 720, y: 530, t: "Child poverty", v: `${sign(dd(S.childPov, SB.childPov) * 1000, 0)}k`, on: Math.abs(dd(S.childPov, SB.childPov)) > 0.001, tone: tone(dd(S.childPov, SB.childPov), false, 0.001) },
    { id: "cs", x: 930, y: 80, t: "Civil service", v: `${fmt.n(R.csHeadcount[t] / 1000, 0)}k staff`, on: R.csHeadcount[t] !== B.csHeadcount || !!L.hmrcStaff },
    { id: "teach", x: 930, y: 190, t: "Teachers", v: kfmt(dd(S.teachers, SB.teachers)), on: Math.abs(dd(S.teachers, SB.teachers)) > 0.05, tone: tone(dd(S.teachers, SB.teachers), true, 0.05) },
    { id: "police", x: 930, y: 300, t: "Police officers", v: kfmt(dd(S.police, SB.police)), on: Math.abs(dd(S.police, SB.police)) > 0.05, tone: tone(dd(S.police, SB.police), true, 0.05) },
    { id: "barnett", x: 930, y: 420, t: "Devolved govts (Barnett)", v: bn(R.dSpend.find((c) => c.id === "barnett")!.v[t]), on: Math.abs(R.dSpend.find((c) => c.id === "barnett")!.v[t]) > 0.01 },
    { id: "prices", x: 930, y: 530, t: "House prices", v: `${sign(S.housePricePct[t], 2)}%`, on: Math.abs(S.housePricePct[t]) > 0.001 },
  ];
  const E: [string, string][] = [["tax", "demand"], ["spend", "demand"], ["spend", "supply"], ["labour", "supply"], ["demand", "jobs"], ["demand", "stab"], ["supply", "stab"], ["stab", "psnb"], ["tax", "psnb"], ["spend", "psnb"],
    ["shock", "interest"], ["interest", "psnb"], ["psnb", "debt"], ["debt", "interest"], ["psnb", "rules"],
    ["care", "nhs"], ["nhs", "labour"], ["homes", "ta"], ["ta", "la"], ["homes", "prices"], ["send", "la"], ["prisons", "pov"], ["cs", "teach"], ["barnett", "send"]];
  const N = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const W = 150, H = 56;
  return <div className="card" style={{ overflowX: "auto" }}>
    <h2>How the policy spreads in {YEARS[t]}{t > LAST_FORECAST ? " (extrapolated)" : ""}</h2>
    <div className="sub">Lit boxes are where this scenario moves something; green is better than the baseline, red is worse. Values are changes against the baseline, except debt, reserves, the SEND deficit, prison places and homes, which are levels. {cap ? `Capital spending (${bn(cap)}) counts towards borrowing but not the current budget.` : ""}</div>
    <svg viewBox="0 10 1020 560" style={{ width: "100%", minWidth: 760, height: "auto" }} role="img" aria-label="System propagation diagram">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--muted)" /></marker></defs>
      {[["Economy and public finances", 18], ["Services and people", 366]].map(([l, y]) => <text key={l} x={14} y={+y + 6} fontSize={11} fill="var(--muted)" style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</text>)}
      <line x1={10} x2={1010} y1={360} y2={360} stroke="var(--line)" strokeDasharray="4 4" />
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

export function Charts({ R, B, now }: { R: Result; B: Baseline; now?: number }) {
  const S = R.S, SB = R.SB, f = (v: number, d = 2) => +v.toFixed(d);
  const rows = YEARS.map((y, t) => ({ y, psnb: f(R.psnb[t], 1), psnbB: f(B.psnb[t], 1), debt: f(R.psndPct[t]), debtB: f((B.psnd[t] / B.gdp[t]) * 100), gdp: f(R.gdpPct[t], 3), dem: f(R.demand[t], 3), sup: f(R.supply[t], 3),
    w: f(R.waiting[t] / 1e6, 3), wB: f(R.waitingBase[t] / 1e6, 3), la: f(R.laReserves[t]), laB: f(R.laReservesBase[t]), dsg: f(R.dsgDeficit[t]), dsgB: f(R.dsgDeficitBase[t]),
    emp: f(R.employmentK[t], 1), lab: f(S.labour[t], 1), pov: f(S.childPov[t] * 1000, 0), povB: f(SB.childPov[t] * 1000, 0), homes: f(S.homes[t], 1), homesB: f(SB.homes[t], 1),
    ta: f(S.ta[t], 1), taB: f(SB.ta[t], 1), pp: f(S.prisonPop[t], 1), pc: f(S.prisonCap[t], 1), ppB: f(SB.prisonPop[t], 1), pcB: f(SB.prisonCap[t], 1),
    arr: f(S.asyArrivals[t], 1), arrB: f(SB.asyArrivals[t], 1), aw: f(S.asyAwaiting[t] + S.asyAppeals[t], 1), awB: f(SB.asyAwaiting[t] + SB.asyAppeals[t], 1), asup: f(S.asySupported[t], 1), asupB: f(SB.asySupported[t], 1), hot: f(S.asyHotels[t], 1), hotB: f(SB.asyHotels[t], 1),
    ret: f(S.asyReturns[t], 1), retB: f(SB.asyReturns[t], 1), lim: f(S.asyLimbo[t], 1), ref: f(S.asyRefused[t], 1), refB: f(SB.asyRefused[t], 1), risk: f(S.legalRisk[t], 1), riskB: f(SB.legalRisk[t], 1), dip: f(S.diplomatic[t], 1), dipB: f(SB.diplomatic[t], 1) }));
  const C = ({ title, sub, lines }: { title: string; sub: string; lines: [string, string, string, boolean?][] }) => <Card title={title} sub={sub}>
    <ResponsiveContainer width="100%" height={230}><LineChart data={rows} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="y" interval={1} tick={{ fontSize: 11 }} /><YAxis domain={["auto", "auto"]} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
      <ReferenceArea x1={YEARS[LAST_FORECAST]} x2={YEARS.at(-1)} fill="var(--soft)" />
      {now != null && <ReferenceLine x={YEARS[now]} stroke="var(--accent)" strokeDasharray="3 3" label={{ value: "Now", position: "insideTopLeft", fontSize: 10, fill: "var(--accent)" }} />}
      {lines.map(([k, n, c, dash]) => <Line key={k} dataKey={k} name={n} stroke={c} strokeDasharray={dash ? "4 4" : undefined} dot={false} strokeWidth={2} />)}</LineChart></ResponsiveContainer></Card>;
  return <>
    <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>The shaded years extend the OBR forecast at constant shares of GDP. Treat them as illustrations of direction, not forecasts.</div>
    <div className="grid g2">
      <C title="Public sector net borrowing" sub="£bn, scenario against baseline" lines={[["psnb", "Scenario", "var(--c1)"], ["psnbB", "Baseline", "var(--muted)", true]]} />
      <C title="Public sector net debt" sub="% of GDP" lines={[["debt", "Scenario", "var(--c1)"], ["debtB", "Baseline", "var(--muted)", true]]} />
      <C title="Real GDP level" sub="% difference from baseline" lines={[["gdp", "Total", "var(--c1)"], ["dem", "Demand", "var(--c2)", true], ["sup", "Supply side", "var(--c3)", true]]} />
      <C title="Employment" sub="thousands, change from baseline" lines={[["emp", "Employment", "var(--c1)"], ["lab", "of which extra labour supply", "var(--c3)", true]]} />
      <C title="NHS England elective waiting list" sub="millions of pathways" lines={[["w", "Scenario", "var(--c1)"], ["wB", "Baseline", "var(--muted)", true]]} />
      <C title="Children in relative poverty" sub="thousands, after housing costs" lines={[["pov", "Scenario", "var(--c4)"], ["povB", "Baseline", "var(--muted)", true]]} />
      <C title="Homes built a year" sub="thousands, England" lines={[["homes", "Scenario", "var(--c2)"], ["homesB", "Baseline", "var(--muted)", true]]} />
      <C title="Households in temporary accommodation" sub="thousands, England" lines={[["ta", "Scenario", "var(--c4)"], ["taB", "Baseline", "var(--muted)", true]]} />
      <C title="Prisons" sub="thousands, England and Wales" lines={[["pp", "Population", "var(--c4)"], ["pc", "Capacity", "var(--c1)"], ["ppB", "Population, baseline", "var(--muted)", true]]} />
      <C title="Council usable reserves" sub="£bn, unallocated plus budget stabilisation reserves, England" lines={[["la", "Scenario", "var(--c1)"], ["laB", "Baseline", "var(--muted)", true]]} />
      <C title="High-needs (SEND) deficit" sub="£bn, England" lines={[["dsg", "Scenario", "var(--c4)"], ["dsgB", "Baseline", "var(--muted)", true]]} />
      <C title="Small boat arrivals" sub="thousands a year" lines={[["arr", "Scenario", "var(--c1)"], ["arrB", "Baseline", "var(--muted)", true]]} />
      <C title="Asylum backlogs" sub="thousands awaiting an initial decision or an appeal" lines={[["aw", "Scenario", "var(--c4)"], ["awB", "Baseline", "var(--muted)", true]]} />
      <C title="People in asylum support" sub="thousands" lines={[["asup", "All", "var(--c1)"], ["hot", "In hotels", "var(--c4)"], ["asupB", "All, baseline", "var(--muted)", true], ["hotB", "Hotels, baseline", "var(--muted)", true]]} />
      <C title="Returns and people without status" sub="thousands" lines={[["ret", "Asylum-related returns a year", "var(--c2)"], ["retB", "Returns, baseline", "var(--muted)", true], ["ref", "Refused, still in the UK", "var(--c4)"], ["refB", "Refused, baseline", "var(--muted)", true], ["lim", "Inadmissible, not removed", "var(--c5)"]]} />
      <C title="Legal and diplomatic risk" sub="index, 0 to 10" lines={[["risk", "Legal challenge", "var(--c4)"], ["riskB", "Legal, baseline", "var(--muted)", true], ["dip", "Diplomatic friction", "var(--c1)"], ["dipB", "Diplomatic, baseline", "var(--muted)", true]]} />
    </div>
  </>;
}

function Channels({ R }: { R: Result }) {
  const row = (l: string, v: number[], f = bn) => <tr key={l}><td>{l}</td>{v.map((x, i) => <td key={i} className="n">{f(x)}</td>)}</tr>;
  const pct = (x: number) => `${sign(x, 2)}%`, k = (x: number) => sign(x, 1), span = YEARS.length + 1;
  const d = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
  return <Card title="Every channel, every year" sub="£bn unless stated. Receipts: + means more revenue. Spending: + means more spending.">
    <div className="scroll"><table><thead><tr><th>Channel</th>{YEARS.map((y, i) => <th key={y} className="n" style={i > LAST_FORECAST ? { fontStyle: "italic" } : undefined}>{y}</th>)}</tr></thead><tbody>
      <tr><td colSpan={span}><b>Receipts</b></td></tr>
      {R.dReceipts.filter((c) => c.v.some((x) => Math.abs(x) > 1e-6)).map((c) => row(c.label, c.v))}
      <tr><td colSpan={span}><b>Spending</b></td></tr>
      {R.dSpend.filter((c) => c.v.some((x) => Math.abs(x) > 1e-6)).map((c) => row(c.label, c.v))}
      <tr><td colSpan={span}><b>Economy</b></td></tr>
      {row("Demand effect on GDP", R.demand, pct)}{R.supplyParts.map((c) => row(`Supply side: ${c.label.toLowerCase()}`, c.v, pct))}
      {row("Unemployment (thousands)", R.unemploymentK, (x) => sign(x, 0))}{row("Employment (thousands)", R.employmentK, (x) => sign(x, 0))}
      <tr><td colSpan={span}><b>Feedback to the public finances</b></td></tr>
      {row("Automatic stabilisers", R.stabiliser)}{row("Debt interest", R.interest)}{row("Change in borrowing", R.dPsnb)}{row("Change in debt", R.dPsnd)}
      <tr><td colSpan={span}><b>Services and people (change from baseline)</b></td></tr>
      {row("NHS waiting list (millions)", d(R.waiting, R.waitingBase).map((x) => x / 1e6), (x) => sign(x, 2))}
      {row("Beds held by delayed discharges", d(R.S.delayed, R.SB.delayed), (x) => sign(x, 0))}
      {row("Teachers (thousands)", d(R.S.teachers, R.SB.teachers), k)}
      {row("Police officers (thousands)", d(R.S.police, R.SB.police), k)}
      {row("Children in poverty (thousands)", d(R.S.childPov, R.SB.childPov).map((x) => x * 1000), (x) => sign(x, 0))}
      {row("Homes built (thousands a year)", d(R.S.homes, R.SB.homes), k)}
      {row("Temporary accommodation (thousands)", d(R.S.ta, R.SB.ta), k)}
      {row("Prison places spare (thousands)", R.S.prisonCap.map((c, i) => c - R.S.prisonPop[i] - (R.SB.prisonCap[i] - R.SB.prisonPop[i])), k)}
      {row("Schools, real change in core budget", R.schoolsRealPct, pct)}
      {row("Welfare, % of GDP", R.welfarePct, (x) => fmt.pct(x, 2))}
      {row("Defence, % of GDP", R.defencePct, (x) => fmt.pct(x, 2))}
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
