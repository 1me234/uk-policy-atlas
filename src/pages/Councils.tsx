import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
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
  { k: "int", label: "General fund interest costs as % of net revenue spend", kind: "authority", unit: "%", calc: (g) => { const i = g("General fund: Interest costs"), n = g("NET REVENUE EXPENDITURE"); return i != null && n ? (i / n) * 100 : null; }, note: "High debt-servicing costs crowd out services (several section 114 councils borrowed heavily for commercial investments)." },
  { k: "inv", label: "Commercial property outside own area: income (£m)", kind: "authority", unit: "£m", calc: (g) => { const a = g("Investment properties outside boundary but within LEP area: income"), b = g("Investment properties outside LEP area: income"); return a == null && b == null ? null : -((a ?? 0) + (b ?? 0)) / 1000; } },
];
export default function Councils() {
  const d = useData("councils", "geo_lad", "population", "lookup");
  const [mk, setMk] = useState("Adult Social Care");
  const [sel, setSel] = useState<any>(null);
  const [q, setQ] = useState("");
  const el = useRef<HTMLDivElement>(null);
  const map = useLeaflet(el, !!d);
  const layer = useRef<L.GeoJSON | null>(null);
  const model = useMemo(() => {
    if (!d) return null;
    const [c, geo, pop, lk] = d as any[];
    const cols: string[] = c.columns;
    const byCode: Record<string, any> = {};
    for (const a of c.authorities) {
      const g = (s: string) => { const i = cols.findIndex((x) => x.includes(s)); const v = i >= 0 ? a.values[i] : null; return v == null ? null : v; };
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
    if (metric.k === "dsg") return v != null && a.kids ? (v * 1000) / a.kids : null;
    return v;
  };
  const ladValue = (code: string) => {
    if (!model) return null;
    const own = model.byCode[code]; const up = model.lk.lad[code]?.upper; const upper = up && up !== code ? model.byCode[up] : null;
    if (metric.kind === "perhead") { const a = value(own), b = upper ? value(upper) : null; return a == null && b == null ? null : (a ?? 0) + (b ?? 0); }
    return upper && ["dsg"].includes(metric.k) ? value(upper) : value(own) ?? (upper ? value(upper) : null);
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
  const calcAll = (k: string) => { const m = METRICS.find((x) => x.k === k)!; return (a: any) => { const v = m.calc!(a.g); return k === "dsg" ? (v != null && a.kids ? (v * 1000) / a.kids : null) : v; }; };
  const deficits = Object.values(model.byCode).map((a: any) => a.g("dedicated schools grant adjustment account level at 31 March")).filter((v: any) => v != null && v < 0) as number[];
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
    <Card title="Financial resilience table" sub="Sort to find councils under the most strain" style={{ marginTop: 14 }} source={c.source}>
      <div className="controls"><input type="search" placeholder="Find a council…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Table rows={auths} initial="res" onRow={setSel} cols={[
        { k: "name", h: "Council", v: (a: any) => a.name },
        { k: "cls", h: "Type", v: (a: any) => a.class },
        { k: "nre", h: "Net revenue spend", n: true, v: (a: any) => a.g("NET REVENUE EXPENDITURE"), f: (a: any) => fmt.gbp(a.g("NET REVENUE EXPENDITURE"), "k") },
        { k: "res", h: "Reserves % of spend", n: true, v: calcAll("res"), f: (a: any) => fmt.pct(calcAll("res")(a), 0) },
        { k: "resch", h: "Reserves change", n: true, v: calcAll("resch"), f: (a: any) => fmt.pct(calcAll("resch")(a), 0) },
        { k: "dsg", h: "DSG deficit £/child", n: true, v: calcAll("dsg"), f: (a: any) => fmt.n(calcAll("dsg")(a)) },
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
