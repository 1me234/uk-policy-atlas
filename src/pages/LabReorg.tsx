import React, { useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Loading, Source } from "../ui";
import { defaultReorgParams, Dept, GRADES, hierarchy, Plan, reorgMonteCarlo, RP, spanOf } from "../lab/reorg";

const m = (v: number) => `${v < 0 ? "−" : ""}£${fmt.n(Math.abs(v), Math.abs(v) < 10 ? 1 : 0)}m`;
const EXCLUDE = /Scottish Government|Welsh Government|Overall Civil Service|Estyn/;

export function useDepts() {
  const d = useData("civil_service");
  return useMemo(() => {
    if (!d) return null;
    const [cs] = d as [any];
    const depts: Dept[] = cs.organisations.filter((o: any) => o.is_total && !EXCLUDE.test(o.name) && o.headcount >= 100).map((o: any) => ({
      name: o.name.replace(/ Overall$/, ""), headcount: o.headcount, grades: Object.fromEntries(GRADES.map((g) => [g, o.by_grade?.[g] || 0])),
      london: o.by_region?.London || 0, salary: o.median_salary || 36000,
    })).sort((a: Dept, b: Dept) => b.headcount - a.headcount);
    return { depts, source: cs.source, total: cs.organisations.find((o: any) => o.name === "Overall Civil Service") };
  }, [d]);
}

const PLANS: { name: string; note: string; plan: Partial<Plan> }[] = [
  { name: "Nothing yet", note: "Start from the current structure.", plan: {} },
  { name: "Merge business and energy back together", note: "Recreate a BEIS-style department from Business and Trade, Energy Security and Net Zero, and Science, Innovation and Technology.", plan: { merges: [["Department for Business and Trade", "Department for Energy Security and Net Zero", "Department for Science, Innovation and Technology"]] } },
  { name: "Places for Growth, doubled", note: "Move half of London posts out over four years.", plan: { relocatePct: 50 } },
  { name: "Flatter structure", note: "Widen spans of control to 8 across the civil service.", plan: { span: 8 } },
  { name: "Automate routine casework", note: "Automate 25% of administrative and executive officer work.", plan: { automatePct: 25 } },
  { name: "All of the above", note: "Every change at once.", plan: { merges: [["Department for Business and Trade", "Department for Energy Security and Net Zero", "Department for Science, Innovation and Technology"]], relocatePct: 50, span: 8, automatePct: 25 } },
];

export function ReorgLab() {
  const D = useDepts();
  const [plan, setPlan] = useState<Plan>({ merges: [], relocatePct: 0, span: 0, automatePct: 0, scope: [] });
  const [P, setP] = useState(defaultReorgParams);
  const [pick, setPick] = useState<string[]>([]);
  const [group, setGroup] = useState("Mergers");
  const res = useMemo(() => D && reorgMonteCarlo(D.depts, plan, P), [D, plan, P]);
  if (!D || !res) return <Loading />;
  const c = res.central, cur = c.cur;
  const rows = res.yrs.map((y) => ({ y: `Year ${y.y + 1}`, p50: +y.net.p50.toFixed(1), band: [+y.net.p10.toFixed(1), +y.net.p90.toFixed(1)], prod: +y.productivity.p50.toFixed(2), prodLo: +y.productivity.p10.toFixed(2) }));
  const groups = [...new Set(RP.map((p) => p.group))];
  const active = plan.merges.length + (plan.relocatePct ? 1 : 0) + (plan.span ? 1 : 0) + (plan.automatePct ? 1 : 0);
  return <>
    <Card title="Civil service reorganisation" sub="Merge departments, move posts out of London, change spans of control and automate routine work, using the real headcount, grades and locations of every department. Each plan runs 300 times with the uncertain costs and benefits drawn at random, because past reorganisations have tended to cost more and save less than promised.">
      <div className="controls"><select style={{ width: "100%", maxWidth: "100%" }} value="" onChange={(e) => { const p = PLANS[+e.target.value]; if (p) setPlan({ merges: [], relocatePct: 0, span: 0, automatePct: 0, scope: [], ...p.plan }); }}><option value="">Load an example plan…</option>{PLANS.map((p, i) => <option key={i} value={i}>{p.name}: {p.note}</option>)}</select></div>
      <div className="grid g4">
        <div className="card stat"><div className="v" style={{ fontSize: 22, color: res.npv.p50 > 0 ? "var(--green)" : res.npv.p50 < 0 ? "var(--red)" : undefined }}>{m(res.npv.p50)}</div><div className="l">Net present value over 10 years (median)</div><div className="d muted">{m(res.npv.p10)} to {m(res.npv.p90)}, 80% of runs</div></div>
        <div className="card stat"><div className="v" style={{ fontSize: 22 }}>{active ? `${(res.pLoss * 100).toFixed(0)}%` : "–"}</div><div className="l">Chance it loses money</div><div className="d muted">share of runs with negative value</div></div>
        <div className="card stat"><div className="v" style={{ fontSize: 22 }}>{active ? (res.payback.p50 >= 99 ? "Never" : `Year ${res.payback.p50 + 1}`) : "–"}</div><div className="l">Pays back (median)</div><div className="d muted">when cumulative savings pass costs</div></div>
        <div className="card stat"><div className="v" style={{ fontSize: 22 }}>{fmt.n(c.years.at(-1)!.headcount - c.H0)}</div><div className="l">Change in posts by year 10</div><div className="d muted">of {fmt.n(c.H0)} in scope; current span {cur.span.toFixed(1)}</div></div>
      </div>
    </Card>
    <div className="sim" style={{ marginTop: 14 }}>
      <aside className="card sim-levers">
        <h3>The plan</h3>
        <div className="nav-group" style={{ padding: "10px 0 2px" }}>Merge departments</div>
        <select multiple value={pick} onChange={(e) => setPick([...e.target.selectedOptions].map((o) => o.value))} style={{ width: "100%", height: 150 }}>
          {D.depts.map((d) => <option key={d.name} value={d.name}>{d.name} ({fmt.n(d.headcount)})</option>)}</select>
        <div className="controls" style={{ marginTop: 6 }}><button className="seg" disabled={pick.length < 2} onClick={() => { setPlan((p) => ({ ...p, merges: [...p.merges, pick] })); setPick([]); }}>Merge selected ({pick.length})</button><span className="muted" style={{ fontSize: 11.5 }}>Ctrl or ⌘ to pick several</span></div>
        {plan.merges.map((g, i) => <div key={i} className="lever on" style={{ fontSize: 12.5 }}><div className="lever-head"><span>{g.map((x) => x.replace(/^Department (for|of) /, "")).join(" + ")}</span><button className="seg" style={{ padding: "0 6px" }} onClick={() => setPlan((p) => ({ ...p, merges: p.merges.filter((_, j) => j !== i) }))}>×</button></div></div>)}
        {([["relocatePct", "Move London posts to the regions", "%", 0, 80, 5], ["span", "Target span of control (0 = keep current)", "reports", 0, 15, 0.5], ["automatePct", "Automate administrative and executive officer work", "%", 0, 50, 1]] as const).map(([k, l, u, mn, mx, st]) => <div key={k} className={`lever ${plan[k] ? "on" : ""}`}>
          <div className="lever-head"><span>{l}</span><span className="lever-v">{plan[k] || (k === "span" ? `${cur.span.toFixed(1)} now` : 0)}{plan[k] ? ` ${u}` : ""}</span></div>
          <input type="range" min={mn} max={mx} step={st} value={plan[k]} onChange={(e) => setPlan((p) => ({ ...p, [k]: +e.target.value }))} aria-label={l} />
        </div>)}
        <div className="nav-group" style={{ padding: "10px 0 2px" }}>Scope</div>
        <select value={plan.scope[0] ?? ""} onChange={(e) => setPlan((p) => ({ ...p, scope: e.target.value ? [e.target.value] : [] }))} style={{ width: "100%" }}><option value="">Whole civil service</option>{D.depts.map((d) => <option key={d.name}>{d.name}</option>)}</select>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Relocation, spans and automation apply to the scope; mergers always use the merged departments.</div>
        <h3 style={{ marginTop: 14 }}>Assumptions</h3>
        <select value={group} onChange={(e) => setGroup(e.target.value)} style={{ width: "100%" }}>{groups.map((g) => <option key={g}>{g}</option>)}</select>
        {RP.filter((p) => p.group === group).map((p) => <div key={p.id} className={`lever ${P[p.id] !== p.value ? "on" : ""}`}>
          <div className="lever-head"><span>{p.label}</span><span className="lever-v">{P[p.id]} {p.unit}</span></div>
          <input type="range" min={p.min} max={p.max} step={p.step} value={P[p.id]} onChange={(e) => setP((x) => ({ ...x, [p.id]: +e.target.value }))} aria-label={p.label} />
          <div className="muted lever-help"><span className={`pill kind-${p.kind}`}>{p.kind}</span>{p.spread ? " Varies by ±" + Math.round(p.spread * 100) + "% across runs." : ""} {p.note}</div>
        </div>)}
      </aside>
      <div className="sim-out">
        <div className="grid g2">
          <Card title="Net saving each year" sub="£m, saving minus one-off costs and lost output. Line is the median run; band covers 80% of runs.">
            <ResponsiveContainer width="100%" height={260}><ComposedChart data={rows} margin={{ left: -6, right: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="y" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><ReferenceLine y={0} stroke="var(--muted)" />
              <Area dataKey="band" name="80% of runs" fill="var(--accent-soft)" stroke="none" /><Line dataKey="p50" name="Median" stroke="var(--c1)" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer>
          </Card>
          <Card title="Productivity of the organisations affected" sub="Index, 100 = no disruption. Mergers dip and recover; spans past the limit cost output for as long as they last.">
            <ResponsiveContainer width="100%" height={260}><LineChart data={rows} margin={{ left: -6, right: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="y" tick={{ fontSize: 11 }} /><YAxis domain={["auto", 100]} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="prod" name="Median" stroke="var(--c1)" strokeWidth={2} dot={false} /><Line dataKey="prodLo" name="Worst 10%" stroke="var(--c4)" strokeDasharray="4 4" dot={false} /></LineChart></ResponsiveContainer>
          </Card>
        </div>
        <Card title="Where the money comes from (central run)" style={{ marginTop: 14 }}>
          <table><tbody>
            <tr><td>Posts in scope</td><td className="n">{fmt.n(c.H0)}</td><td className="muted">pay bill about {m(c.paybill0)} a year with on-costs</td></tr>
            <tr><td>Managers now, and after the span change</td><td className="n">{fmt.n(cur.managers)} → {fmt.n(Math.min(cur.managers, c.targetMgr))}</td><td className="muted">line managers: all SCS, {P.mgr_g67}% of G6/7, {P.heo_mgr}% of SEO/HEO, {P.mgr_eo}% of EO; {fmt.n(-c.dMgrPosts)} posts saved from management time; span {cur.span.toFixed(1)} → {Math.max(cur.span, plan.span || cur.span).toFixed(1)}{c.overSpan > 0 ? `, ${c.overSpan.toFixed(1)} above the oversight limit` : ""}</td></tr>
            <tr><td>Corporate and senior posts saved by mergers</td><td className="n">{fmt.n(c.mergePosts)}</td><td className="muted">phased in over three years</td></tr>
            <tr><td>Posts moved out of London</td><td className="n">{fmt.n(c.moved)}</td><td className="muted">{P.refuse}% of staff expected to leave rather than move, each replaced at {P.replace}× salary</td></tr>
            <tr><td>Posts freed by automation (expected)</td><td className="n">{fmt.n(c.autoPosts)}</td><td className="muted">{P.auto_success}% chance the programme delivers; failure in {(res.failRate * 100).toFixed(0)}% of runs</td></tr>
          </tbody></table>
          <Source s={D.source} />
        </Card>
      </div>
    </div>
  </>;
}

export function StructureLab() {
  const D = useDepts();
  const [N, setN] = useState(10000);
  const [cur, setCur] = useState(6);
  if (!D) return <Loading />;
  const spans = Array.from({ length: 14 }, (_, i) => i + 2);
  const data = spans.map((s) => { const h = hierarchy(N, s); return { s, layers: h.layers, managers: h.managers, cost: +h.cost.toFixed(1) }; });
  const h = hierarchy(N, cur);
  const g = D.total.by_grade as Record<string, number>;
  const pyramid = GRADES.map((k, i) => ({ k, n: g[k] || 0, per: i ? (g[k] || 0) / Math.max(1, g[GRADES[i - 1]] || 1) : null }));
  const sp = spanOf(g, defaultReorgParams());
  return <div className="grid g2" style={{ alignItems: "start" }}>
    <Card title="Spans and layers" sub="For an organisation of a given size, how the number of management layers, managers and pay bill change with the span of control. Wider spans mean fewer layers and managers, and fewer hops for a decision to travel, but each manager has far more relationships to handle.">
      <div className="controls"><label className="muted">Staff <select value={N} onChange={(e) => setN(+e.target.value)}>{[500, 2000, 10000, 50000, 100000, 550000].map((x) => <option key={x} value={x}>{fmt.n(x)}</option>)}</select></label>
        <label className="muted">Span <input type="range" min={2} max={15} value={cur} onChange={(e) => setCur(+e.target.value)} /> {cur}</label></div>
      <div className="grid g4">
        <div className="card stat"><div className="v" style={{ fontSize: 20 }}>{h.layers}</div><div className="l">Management layers</div></div>
        <div className="card stat"><div className="v" style={{ fontSize: 20 }}>{fmt.n(h.managers)}</div><div className="l">Managers</div><div className="d muted">{((h.managers / N) * 100).toFixed(1)}% of staff</div></div>
        <div className="card stat"><div className="v" style={{ fontSize: 20 }}>{h.hops}</div><div className="l">Hops up and down for a decision</div></div>
        <div className="card stat"><div className="v" style={{ fontSize: 20 }}>{fmt.n(h.graicunas)}</div><div className="l">Relationships per manager</div><div className="d muted">Graicunas (1933)</div></div>
      </div>
      <ResponsiveContainer width="100%" height={250}><BarChart data={data} margin={{ left: -6, right: 8, top: 10 }}><CartesianGrid vertical={false} /><XAxis dataKey="s" label={{ value: "span of control", position: "insideBottom", offset: -2, fontSize: 11 }} /><YAxis yAxisId="a" /><YAxis yAxisId="b" orientation="right" /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="a" dataKey="managers" name="Managers" fill="var(--c1)" /><Bar yAxisId="b" dataKey="layers" name="Layers (right)" fill="var(--c3)" /><ReferenceLine yAxisId="a" x={cur} stroke="var(--c4)" /></BarChart></ResponsiveContainer>
      <div className="muted" style={{ fontSize: 12 }}>Pure tree with a uniform span; real organisations mix spans. Managers are paid £60k and staff £32k for the cost comparison.</div>
    </Card>
    <Card title="The civil service grade pyramid now" sub="Headcount by grade and the ratio of each grade to the one above. A ratio near 1 means one grade is doing little more than shadow the one above; very high ratios mean thin management.">
      <table><thead><tr><th>Grade</th><th className="n">Staff</th><th className="n">Per person in grade above</th></tr></thead><tbody>
        {pyramid.map((p) => <tr key={p.k}><td>{p.k}</td><td className="n">{fmt.n(p.n)}</td><td className="n">{p.per == null ? "–" : p.per.toFixed(1)}</td></tr>)}
      </tbody></table>
      <p className="muted" style={{ fontSize: 13 }}>Counting all of the Senior Civil Service, half of Grades 6 and 7, 30% of SEO and HEO staff and 10% of EOs as line managers (assumptions you can change in the reorganisation model), the average span of control is <b>{sp.span.toFixed(1)}</b> ({fmt.n(sp.managers)} managers for {fmt.n(sp.staff)} staff). The middle of the pyramid is wide: there are almost two SEO and HEO staff for every Grade 6 or 7, but fewer than one EO per SEO or HEO. Try widening spans in the reorganisation model to see what it saves, and what it risks.</p>
      <Source s={D.source} />
    </Card>
  </div>;
}
