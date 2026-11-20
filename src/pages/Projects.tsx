import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Drawer, Loading, Page, Pill, Stat, Table } from "../ui";

const rag = (p: any) => p.dca_nista || p.dca_sro || "";
const parseD = (s: string) => { const m = s?.match(/(\d\d)\/(\d\d)\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
export default function Projects() {
  const d = useData("major_projects");
  const [q, setQ] = useState(""); const [dep, setDep] = useState(""); const [cat, setCat] = useState(""); const [r, setR] = useState("");
  const [sel, setSel] = useState<any>(null);
  useEffect(() => { const id = decodeURIComponent(location.hash.split("/")[2] || ""); if (d && id) setSel((d[0] as any).projects.find((p: any) => p.id === id)); }, [d]);
  const all = d ? (d[0] as any).projects as any[] : [];
  const rows = useMemo(() => all.filter((p) => (!q || (p.name + p.description).toLowerCase().includes(q.toLowerCase())) && (!dep || p.department === dep) && (!cat || p.category === cat) && (!r || rag(p) === r)), [all, q, dep, cat, r]);
  if (!d) return <Loading />;
  const src = (d[0] as any).source;
  const deps = [...new Set(all.map((p) => p.department))].sort(); const cats = [...new Set(all.map((p) => p.category))].sort();
  const byCat = cats.map((c) => ({ c: c.replace("Information and Communications Technology (ICT)", "ICT").replace("Government Transformation and Service Delivery", "Transformation"), ...Object.fromEntries(["RED", "AMBER", "GREEN"].map((k) => [k, all.filter((p) => p.category === c && rag(p) === k).length])), Other: all.filter((p) => p.category === c && !["RED", "AMBER", "GREEN"].includes(rag(p))).length }));
  const wlc = rows.reduce((a, p) => a + (p.whole_life_cost_m || 0), 0), ben = rows.reduce((a, p) => a + (p.benefits_m || 0), 0);
  const close = () => { setSel(null); history.replaceState(null, "", "#/projects"); };
  return <Page title="Major projects" lede="The Government Major Projects Portfolio: the largest, riskiest projects across government, with the independent delivery confidence rating, cost, benefits, schedule and the department's own explanation of what changed.">
    <div className="grid g4">
      <Stat v={rows.length} l="Projects in view" />
      <Stat v={fmt.gbp(wlc, "m")} l="Whole-life cost (2024-25 prices)" />
      <Stat v={fmt.gbp(ben, "m")} l="Monetised benefits claimed" d={wlc ? `Benefit/cost ${(ben / wlc).toFixed(2)} (where reported)` : ""} />
      <Stat v={rows.filter((p) => rag(p) === "RED").length} l="Rated red" color="var(--red)" d={`${rows.filter((p) => rag(p) === "AMBER").length} amber · ${rows.filter((p) => rag(p) === "GREEN").length} green`} />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Delivery confidence by type of project" sub="NISTA rating where given, otherwise the senior responsible owner's own rating" source={src}>
        <ResponsiveContainer width="100%" height={220}><BarChart data={byCat} layout="vertical" margin={{ left: 40 }}><XAxis type="number" /><YAxis type="category" dataKey="c" width={150} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="RED" stackId="a" fill="var(--red)" /><Bar dataKey="AMBER" stackId="a" fill="var(--amber)" /><Bar dataKey="GREEN" stackId="a" fill="var(--green)" /><Bar dataKey="Other" name="Exempt / not rated" stackId="a" fill="var(--line)" /></BarChart></ResponsiveContainer>
      </Card>
      <Card title="Biggest in-year budget variances" sub="Forecast vs baseline for 2025-26, projects over £50m baseline" source={src}>
        {all.filter((p) => (p.fy_baseline_m || 0) > 50 && p.fy_variance_pct != null).sort((a, b) => Math.abs(b.fy_variance_pct) - Math.abs(a.fy_variance_pct)).slice(0, 7).map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--soft)" }}><a href="#/projects" onClick={(e) => { e.preventDefault(); setSel(p); }}>{p.name}</a><span>{fmt.gbp(p.fy_baseline_m, "m")} → {fmt.gbp(p.fy_forecast_m, "m")} <b>({fmt.pct(p.fy_variance_pct, 0)})</b></span></div>)}
      </Card>
    </div>
    <Card style={{ marginTop: 14 }} source={src}>
      <div className="controls">
        <input type="search" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={dep} onChange={(e) => setDep(e.target.value)}><option value="">All departments</option>{deps.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All types</option>{cats.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={r} onChange={(e) => setR(e.target.value)}><option value="">Any rating</option><option>RED</option><option>AMBER</option><option>GREEN</option></select>
      </div>
      <Table rows={rows} initial="wlc" onRow={setSel} cols={[
        { k: "name", h: "Project", v: (p: any) => p.name },
        { k: "dep", h: "Dept", v: (p: any) => p.department },
        { k: "rag", h: "Rating", v: (p: any) => rag(p), f: (p: any) => <Pill v={rag(p)} /> },
        { k: "wlc", h: "Whole-life cost", n: true, v: (p: any) => p.whole_life_cost_m, f: (p: any) => fmt.gbp(p.whole_life_cost_m, "m") },
        { k: "ben", h: "Benefits", n: true, v: (p: any) => p.benefits_m, f: (p: any) => fmt.gbp(p.benefits_m, "m") },
        { k: "end", h: "End date", n: true, v: (p: any) => parseD(p.end), f: (p: any) => parseD(p.end)?.slice(0, 7) ?? "–" },
        { k: "var", h: "In-year variance", n: true, v: (p: any) => p.fy_variance_pct, f: (p: any) => fmt.pct(p.fy_variance_pct, 0) },
      ]} />
    </Card>
    {sel && <Drawer onClose={close}>
      <h2 style={{ fontSize: 20 }}>{sel.name}</h2>
      <div className="muted">{sel.department} · {sel.category} · {sel.id}</div>
      <div className="kv">
        <div>NISTA rating</div><div><Pill v={sel.dca_nista} /></div>
        <div>SRO's own rating</div><div><Pill v={sel.dca_sro} /></div>
        <div>Dates</div><div>{sel.start} → {sel.end}</div>
        <div>Whole-life cost</div><div>{fmt.gbp(sel.whole_life_cost_m, "m")}</div>
        <div>Benefits</div><div>{fmt.gbp(sel.benefits_m, "m")}</div>
        <div>2025-26 budget</div><div>{fmt.gbp(sel.fy_baseline_m, "m")} baseline → {fmt.gbp(sel.fy_forecast_m, "m")} forecast ({fmt.pct(sel.fy_variance_pct, 0)})</div>
        <div>Responsible owner</div><div>{sel.sro || "–"}</div>
      </div>
      <div className="prose">
        {[["What it is", sel.description], ["Why it has this rating", sel.dca_commentary], ["Schedule", sel.schedule_narrative], ["Costs", sel.costs_narrative], ["In-year variance", sel.variance_narrative], ["Benefits", sel.benefits_narrative], ["Evaluation", sel.evaluation]].filter(([, t]) => t).map(([h, t]) => <div key={h}><h3>{h}</h3>{String(t).split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>)}
      </div>
    </Drawer>}
  </Page>;
}
