import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, quantiles, ramp, useData } from "../lib";
import { esc, useLeaflet } from "../map";
import { Card, Drawer, Loading, Page, Stat, Table } from "../ui";

type M = { k: string; label: string; kind: "perhead" | "authority"; col?: string; calc?: (g: (s: string) => number | null) => number | null; unit: string; note?: string };
const SERVICE = ["Education services", "Highways and transport services", "Children Social Care", "Adult Social Care", "Public Health", "Housing services", "Cultural and related services", "Environmental and regulatory services", "Planning and development services", "Central services", "TOTAL SERVICE EXPENDITURE"];
const METRICS: M[] = [
  ...SERVICE.map((s) => ({ k: s, label: `${s.replace("TOTAL SERVICE EXPENDITURE", "Total service spending")} (£ per head)`, kind: "perhead" as const, col: `Service Expenditure - ${s}`, unit: "£/head" })),
  { k: "ctr", label: "Council tax requirement (£ per head)", kind: "perhead", col: "COUNCIL TAX REQUIREMENT", unit: "£/head" },
  { k: "res", label: "Usable reserves as % of net revenue spend", kind: "authority", unit: "%", calc: (g) => { const r = (g("Estimated other earmarked financial reserves level at 31 March") ?? 0) + (g("Estimated unallocated financial reserves level at 31 March") ?? 0), n = g("NET REVENUE EXPENDITURE"); return n ? (r / n) * 100 : null; }, note: "Low reserves mean little cushion against overspends." },
  { k: "resch", label: "Change in usable reserves during 2025-26 (%)", kind: "authority", unit: "%", calc: (g) => { const a = (g("Estimated other earmarked financial reserves level at 1 April") ?? 0) + (g("Estimated unallocated financial reserves level at 1 April") ?? 0), b = (g("Estimated other earmarked financial reserves level at 31 March") ?? 0) + (g("Estimated unallocated financial reserves level at 31 March") ?? 0); return a ? (b / a - 1) * 100 : null; }, note: "Negative means the council ran its reserves down." },
  { k: "dsg", label: "High-needs (DSG) deficit, £ per child", kind: "authority", unit: "£/child", calc: (g) => g("dedicated schools grant adjustment account level at 31 March"), note: "The statutory override lets councils keep special educational needs deficits off their books; negative is a deficit." },
  { k: "ehc", label: "EHC plans (special needs) per 1,000 under-18s, January 2026", kind: "authority", unit: "per 1,000", calc: (g) => g("__ehc"), note: "Children and young people (0-25) with an education, health and care plan, per 1,000 residents under 18. Source: DfE." },
  { k: "ehcg", label: "Growth in EHC plans since 2019 (%)", kind: "authority", unit: "%", calc: (g) => g("__ehcg"), note: "Change in the number of EHC plans maintained, January 2019 to January 2026." },
  { k: "ehc20", label: "New EHC plans issued within the 20-week legal limit, 2025 (%)", kind: "authority", unit: "%", calc: (g) => g("__ehc20"), note: "Excluding exceptions. The law requires plans to be issued within 20 weeks of a request." },
  ...["Total", "Universal Credit", "Personal Independence Payment", "Housing Benefit", "State Pension"].map((b) => ({ k: `wb:${b}`, label: `Benefit spending: ${b === "Total" ? "all DWP benefits" : b} (£ per resident), 2024-25`, kind: "authority" as const, unit: "£/head", calc: (g: any) => g(`__wb:${b}`), note: "DWP benefit expenditure allocated to the district where claimants live. Shown for districts and unitaries, not counties." })),
  { k: "wbg", label: "Growth in benefit spending since 2019-20 (%, cash)", kind: "authority", unit: "%", calc: (g) => g("__wbg") },
  { k: "efs", label: "Exceptional financial support since 2020-21 (£ per resident)", kind: "authority", unit: "£/head", calc: (g) => g("__efs"), note: "Government permission to fund day-to-day spending from borrowing or asset sales, a sign a council cannot balance its budget. Zero for councils that have not received it." },
  { k: "int", label: "General fund interest costs as % of net revenue spend", kind: "authority", unit: "%", calc: (g) => { const i = g("General fund: Interest costs"), n = g("NET REVENUE EXPENDITURE"); return i != null && n ? (i / n) * 100 : null; }, note: "High debt-servicing costs crowd out services (several section 114 councils borrowed heavily for commercial investments)." },
  { k: "inv", label: "Commercial property outside own area: income (£m)", kind: "authority", unit: "£m", calc: (g) => { const a = g("Investment properties outside boundary but within LEP area: income"), b = g("Investment properties outside LEP area: income"); return a == null && b == null ? null : -((a ?? 0) + (b ?? 0)) / 1000; } },
];
export default function Councils() {
  const d = useData("councils", "geo_lad", "population", "lookup", "send", "welfare_la", "efs");
  const [mk, setMk] = useState("Adult Social Care");
  const [sel, setSel] = useState<any>(null);
  const [q, setQ] = useState("");
  const el = useRef<HTMLDivElement>(null);
  const map = useLeaflet(el, !!d);
  const layer = useRef<L.GeoJSON | null>(null);
  const model = useMemo(() => {
    if (!d) return null;
    const [c, geo, pop, lk, send, wla, efs] = d as any[];
    const efsBy: Record<string, number> = {}; for (const e of Object.values(efs.councils) as any[]) if (e.code) efsBy[e.code] = Object.values(e.years).reduce((a: number, y: any) => a + y.m, 0) as number;
    const sy = send.years;
    const cols: string[] = c.columns;
    const byCode: Record<string, any> = {};
    for (const a of c.authorities) {
      const se = send.la[a.code], wl = wla.la[a.code], ef = efsBy[a.code] ?? null;
      const g = (s: string) => { if (s === "__efs") return ef ?? 0; if (s.startsWith("__wb")) { if (!wl) return null; if (s === "__wbg") return wl.Total && wl.total_2019 ? (wl.Total / wl.total_2019 - 1) * 100 : null; return wl[s.slice(5)] ?? null; } if (s.startsWith("__")) { if (!se) return null; if (s === "__ehc") return se.plans[sy.at(-1)] ?? null; if (s === "__ehc20") return se.within20_pct ?? null; const a0 = se.plans[sy[0]], a1 = se.plans[sy.at(-1)]; return a0 && a1 ? (a1 / a0 - 1) * 100 : null; } const i = cols.findIndex((x) => x.includes(s)); const v = i >= 0 ? a.values[i] : null; return v == null ? null : v; };
      const p = pop.areas[a.code]?.all ?? null, kids = pop.areas[a.code]?.u18 ?? null;
      byCode[a.code] = { ...a, g, pop: p, kids };
    }
    return { c, geo, pop, lk, byCode };
  }, [d]);
  const metric = METRICS.find((m) => m.k === mk)!;
  const value = (a: any): number | null => {
    if (!a) return null;
    if (metric.kind === "perhead") { const v = a.g(metric.col!); return v != null && a.pop ? (v * 1000) / a.pop : null; }
    const v = metric.calc!(a.g);
    if (metric.k === "efs") return v != null && a.pop ? (v * 1e6) / a.pop : null;
    if (metric.k.startsWith("wb:")) return v != null && a.pop ? (v * 1e6) / a.pop : null;
    if (metric.k === "dsg" || metric.k === "ehc") return v != null && a.kids ? (v * 1000) / a.kids : null;
    return v;
  };
  const ladValue = (code: string) => {
    if (!model) return null;
    const own = model.byCode[code]; const up = model.lk.lad[code]?.upper; const upper = up && up !== code ? model.byCode[up] : null;
    if (metric.kind === "perhead") { const a = value(own), b = upper ? value(upper) : null; return a == null && b == null ? null : (a ?? 0) + (b ?? 0); }
    return upper && ["dsg", "ehc", "ehcg", "ehc20"].includes(metric.k) ? value(upper) : metric.k === "efs" ? Math.max(value(own) ?? 0, 0) + Math.max(upper ? value(upper) ?? 0 : 0, 0) : value(own) ?? (upper ? value(upper) : null);
  };
  useEffect(() => {
    if (!map.current || !model) return;
    layer.current?.remove();
    const vals = model.geo.features.map((f: any) => ladValue(f.properties.code)).filter((v: any) => v != null);
    const qf = quantiles(vals);
    layer.current = L.geoJSON(model.geo, {
      style: (f: any) => { const v = ladValue(f.properties.code); return { weight: 0.6, color: "#fff", fillOpacity: v == null ? 0.15 : 0.85, fillColor: v == null ? "#999" : ramp(qf(v)) }; },
      onEachFeature: (f: any, l) => { const v = ladValue(f.properties.code); l.bindTooltip(`<b>${esc(f.properties.name)}</b><br>${esc(metric.label)}: ${v == null ? "no data" : esc(fmt.n(v, metric.unit === "%" ? 1 : 0))}`); l.on("click", () => setSel(model.byCode[f.properties.code] || model.byCode[model.lk.lad[f.properties.code]?.upper])); },
    }).addTo(map.current);
  }, [model, mk, map.current]);
  if (!d || !model) return <Loading />;
  const { c } = model;
  const auths = Object.values(model.byCode).filter((a: any) => a.class !== "O" && a.class !== "Eng" && (!q || a.name.toLowerCase().includes(q.toLowerCase())));
  const calcAll = (k: string) => { const m = METRICS.find((x) => x.k === k)!; return (a: any) => { const v = m.calc!(a.g); return k === "dsg" || k === "ehc" ? (v != null && a.kids ? (v * 1000) / a.kids : null) : v; }; };
  const deficits = Object.values(model.byCode).filter((a: any) => a.class !== "O" && a.class !== "Eng").map((a: any) => a.g("dedicated schools grant adjustment account level at 31 March")).filter((v: any) => v != null && v < 0) as number[];
  const lowRes = Object.values(model.byCode).filter((a: any) => a.class !== "O" && (calcAll("res")(a) ?? 999) < 10).length;
  return <Page title="Councils" lede="Every English local authority's 2025-26 revenue outturn: what it spends per resident on each service, how much it holds in reserves, its special-needs deficit, debt costs and exposure to commercial property. Two-tier areas combine the district and the county.">
    <div className="grid g4">
      <Stat v={fmt.n(c.authorities.filter((a: any) => a.class !== "O" && a.class !== "Eng").length)} l="Principal councils in England" d={`plus ${c.authorities.filter((a: any) => a.class === "O").length} police, fire, transport and other bodies`} />
      <Stat v={fmt.gbp(-deficits.reduce((a, b) => a + b, 0), "k")} l="Combined high-needs (DSG) deficits at 31 March 2026" color="var(--red)" d={`${deficits.length} councils in deficit`} />
      <Stat v={lowRes} l="Councils with usable reserves under 10% of net spending" />
      <Stat v={fmt.gbp(c.authorities.find((a: any) => a.class === "Eng")?.values[c.columns.findIndex((x: string) => x.includes("NET REVENUE EXPENDITURE"))], "k")} l="Net revenue expenditure, all English councils" />
    </div>
    <Card style={{ marginTop: 14 }} source={[c.source, model.pop.source, model.geo.source]}>
      <div className="controls"><select value={mk} onChange={(e) => setMk(e.target.value)}>{METRICS.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}</select>{metric.note && <span className="muted">{metric.note}</span>}</div>
      <div ref={el} className="map" />
      <div className="legend"><span>Shaded by fifths of the distribution, light = lowest, dark = highest. Grey = no data. Click an area for its council's accounts.</span></div>
    </Card>
    {(() => { const efs = (d as any[])[6]; const E = Object.values(efs.councils) as any[]; const tot = efs.years.map((y: string) => ({ y, v: E.reduce((a: number, e: any) => a + (e.years[y]?.m || 0), 0) })); const rows = E.map((e: any) => ({ ...e, total: Object.values(e.years).reduce((a: number, y: any) => a + y.m, 0) as number, n: Object.keys(e.years).length })); return <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Exceptional financial support" sub="£m of day-to-day spending councils were allowed to fund from borrowing or asset sales, by year it applies to (agreed or agreed in principle)" source={efs.source}>
        <ResponsiveContainer width="100%" height={260}><BarChart data={tot}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis /><Tooltip formatter={(v: any) => fmt.gbp(v, "m")} /><Bar dataKey="v" name="Support agreed" fill="var(--red)" /></BarChart></ResponsiveContainer>
        <p className="muted" style={{ fontSize: 12.5 }}>{E.length} councils and bodies have needed this support since 2020-21. Councils in the most severe position also issue section 114 notices (an effective ban on new spending); there is no official central list of those.</p>
      </Card>
      <Card title="Councils receiving exceptional support" source={efs.source}>
        <Table rows={rows} initial="t" max={80} onRow={(e: any) => e.code && setSel(model.byCode[e.code])} cols={[{ k: "n", h: "Council", v: (e: any) => e.name }, { k: "y", h: "Years", n: true, v: (e: any) => e.n }, { k: "t", h: "Total £m", n: true, v: (e: any) => e.total, f: (e: any) => fmt.n(e.total, 1) }, { k: "l", h: "Latest", v: (e: any) => Object.keys(e.years).sort().at(-1) }]} />
      </Card>
    </div>; })()}
    <Card title="Financial resilience table" sub="Sort to find councils under the most strain" style={{ marginTop: 14 }} source={c.source}>
      <div className="controls"><input type="search" placeholder="Find a council…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Table rows={auths} initial="res" onRow={setSel} cols={[
        { k: "name", h: "Council", v: (a: any) => a.name },
        { k: "cls", h: "Type", v: (a: any) => a.class },
        { k: "nre", h: "Net revenue spend", n: true, v: (a: any) => a.g("NET REVENUE EXPENDITURE"), f: (a: any) => fmt.gbp(a.g("NET REVENUE EXPENDITURE"), "k") },
        { k: "res", h: "Reserves % of spend", n: true, v: calcAll("res"), f: (a: any) => fmt.pct(calcAll("res")(a), 0) },
        { k: "resch", h: "Reserves change", n: true, v: calcAll("resch"), f: (a: any) => fmt.pct(calcAll("resch")(a), 0) },
        { k: "dsg", h: "DSG deficit £/child", n: true, v: calcAll("dsg"), f: (a: any) => fmt.n(calcAll("dsg")(a)) },
        { k: "ehc", h: "EHC plans per 1,000 children", n: true, v: calcAll("ehc"), f: (a: any) => fmt.n(calcAll("ehc")(a), 1) },
        { k: "ehc20", h: "EHC plans on time", n: true, v: calcAll("ehc20"), f: (a: any) => fmt.pct(calcAll("ehc20")(a), 0) },
        { k: "int", h: "Interest % of spend", n: true, v: calcAll("int"), f: (a: any) => fmt.pct(calcAll("int")(a)) },
        { k: "inv", h: "Out-of-area property income £m", n: true, v: calcAll("inv"), f: (a: any) => fmt.n(calcAll("inv")(a), 1) },
      ]} />
    </Card>
    {sel && <Drawer onClose={() => setSel(null)}>
      <h2 style={{ fontSize: 20 }}>{sel.name}</h2><div className="muted">{sel.code} · {sel.detailed_class} · population {fmt.n(sel.pop)}</div>
      <h3 style={{ marginTop: 12 }}>Service spending, 2025-26</h3>
      <table><tbody>{SERVICE.map((s) => { const v = sel.g(`Service Expenditure - ${s}`); return <tr key={s}><td>{s}</td><td className="n">{fmt.gbp(v, "k")}</td><td className="n muted">{sel.pop && v != null ? `£${fmt.n((v * 1000) / sel.pop)}/head` : ""}</td></tr>; })}</tbody></table>
      <h3 style={{ marginTop: 12 }}>Risk indicators</h3>
      <div className="kv">{METRICS.filter((m) => m.kind === "authority").map((m) => [<div key={m.k + "l"}>{m.label}</div>, <div key={m.k}>{fmt.n(calcAll(m.k)(sel), m.unit === "%" ? 1 : 0)} {m.unit === "%" ? "%" : m.unit}</div>])}</div>
      <h3>All reported lines</h3>
      <div className="scroll" style={{ maxHeight: 360 }}><table><tbody>{c.columns.map((col: string, i: number) => sel.values[i] ? <tr key={i}><td style={{ fontSize: 12 }}>{col}</td><td className="n">{fmt.n(sel.values[i])}</td></tr> : null)}</tbody></table></div>
      <div className="src">£ thousand unless stated. Source: {c.source.name}</div>
    </Drawer>}
  </Page>;
}
