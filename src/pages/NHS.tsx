import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { esc, useLeaflet } from "../map";
import { Card, Loading, Page, Pill, Stat, Table } from "../ui";

const isNHS = (b: string) => /NHS|Integrated Care Board|Health|Hospital|Ambulance|Foundation Trust|Primary Care|Commissioning Support/i.test(b);
export default function NHS() {
  const d = useData("spending", "geo_icb", "infrastructure", "major_projects", "contracts", "assessments", "civil_service");
  const el = useRef<HTMLDivElement>(null);
  const map = useLeaflet(el, !!d);
  useEffect(() => {
    if (!map.current || !d) return;
    const [, icb, infra] = d as any[];
    const g = L.layerGroup().addTo(map.current);
    L.geoJSON(icb, { style: () => ({ color: "#0f5e63", weight: 1, fillOpacity: 0.06 }), onEachFeature: (f: any, l) => l.bindTooltip(esc(f.properties.name)) }).addTo(g);
    for (const a of infra.assets.filter((a: any) => a.type === "hospital")) L.circleMarker([a.lat, a.lon], { radius: 3.5, color: "#c2362f", weight: 1, fillOpacity: 0.8 }).bindPopup(`<b>${esc(a.name)}</b>${a.built ? `<br>Opened/inception: ${esc(a.built)}` : ""}${a.operator?.length ? `<br>${esc(a.operator.join(", "))}` : ""}`).addTo(g);
    return () => { g.remove(); };
  }, [d, map.current]);
  const m = useMemo(() => {
    if (!d) return null;
    const [sp, , infra, mp, ct] = d as any[];
    const sub = sp.tables.by_subfunction;
    const health = sub.rows.filter((r: any) => /^7\.\d/.test(r.label) && r.values);
    const del = sp.tables.nhs_england_del;
    const delRows = del.years.map((y: string, i: number) => ({ y, nominal: del.rows.find((r: any) => r.label.startsWith("Resource DEL") && !/real/.test(r.label))?.values[i], real: del.rows.find((r: any) => /real/i.test(r.label) && r.label.includes("Resource"))?.values[i] }));
    const projects = mp.projects.filter((p: any) => p.department === "DHSC" || /hospital|NHS|health/i.test(p.name));
    const buyers = ct.buyers.filter((b: any) => isNHS(b[0]));
    const awards = ct.large_awards.filter((a: any) => isNHS(a.buyer));
    const sup: Record<string, number> = {};
    for (const a of awards) for (const s of a.suppliers) sup[s] = (sup[s] || 0) + a.value / Math.max(1, a.suppliers.length);
    return { health, sub, delRows, projects, buyers, awards, sup: Object.entries(sup).sort((a, b) => b[1] - a[1]), hospitals: infra.assets.filter((a: any) => a.type === "hospital").length };
  }, [d]);
  if (!d || !m) return <Loading />;
  const [sp, icb, infra, mp, ct, as, cs] = d as any[];
  const dhsc = cs.organisations.find((o: any) => /Health and Social Care Overall/.test(o.name));
  return <Page title="NHS" lede="Funding, structure, buildings, suppliers and performance of the health service in England. Operational NHS England and NHS Digital statistics (waiting lists, A&E, workforce, ICB allocations) are blocked from automated download, so headline performance below comes from the Institute for Government's 2026 tracker until those feeds are wired up.">
    <div className="grid g4">
      <Stat v={fmt.gbp(m.delRows.find((r: any) => r.y === "2025-26")?.nominal, "m")} l="NHS England day-to-day budget, 2025-26 plans" d={`Rising to ${fmt.gbp(m.delRows.at(-1)?.nominal, "m")} by ${m.delRows.at(-1)?.y}`} />
      <Stat v={icb.features.length} l="Integrated care boards (April 2026 boundaries)" />
      <Stat v={m.projects.length} l="Health-related major projects" d={`${m.projects.filter((p: any) => (p.dca_nista || p.dca_sro) === "RED").length} rated red`} />
      <Stat v={fmt.gbp(m.awards.reduce((a: number, x: any) => a + x.value, 0))} l="NHS contracts ≥£1m awarded in last 12 months" d={`${m.awards.length} awards on Contracts Finder`} />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="What independent analysts say" sub="Headline findings on NHS performance" source={as.source}>
        {as.nhs_facts.map((f: string, i: number) => <div key={i} className={/fell|grown|hit|met|up almost/.test(f) ? "flag good" : "flag"}>{f}</div>)}
      </Card>
      <Card title="NHS England budget" sub="Resource DEL excluding depreciation, £ million: cash and real terms (2024-25 prices)" source={sp.source}>
        <ResponsiveContainer width="100%" height={260}><LineChart data={m.delRows}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis domain={["auto", "auto"]} /><Tooltip formatter={(v: any) => fmt.gbp(v, "m")} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="nominal" name="Cash" stroke="var(--c1)" strokeWidth={2} /><Line dataKey="real" name="Real terms" stroke="var(--c2)" strokeWidth={2} /></LineChart></ResponsiveContainer>
        <h3 style={{ marginTop: 10 }}>Health spending by sub-function (£m)</h3>
        <table><thead><tr><th>Sub-function</th>{[0, m.sub.years.length - 1].map((i) => <th key={i} className="n">{m.sub.years[i]}</th>)}</tr></thead><tbody>{m.health.map((r: any) => <tr key={r.label}><td>{r.label}</td><td className="n">{fmt.n(r.values[0])}</td><td className="n">{fmt.n(r.values.at(-1))}</td></tr>)}</tbody></table>
      </Card>
    </div>
    <Card title="Integrated care boards and hospitals" sub={`${m.hospitals} hospitals mapped from Wikidata (coverage is incomplete); ICB boundaries from ONS`} style={{ marginTop: 14 }} source={[icb.source, infra.source]}>
      <div ref={el} className="map short" />
    </Card>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Health major projects" source={mp.source}>
        <Table rows={m.projects} initial="wlc" onRow={(p: any) => (location.hash = `#/projects/${encodeURIComponent(p.id)}`)} cols={[{ k: "n", h: "Project", v: (p: any) => p.name }, { k: "r", h: "Rating", v: (p: any) => p.dca_nista || p.dca_sro, f: (p: any) => <Pill v={p.dca_nista || p.dca_sro} /> }, { k: "wlc", h: "Whole-life cost", n: true, v: (p: any) => p.whole_life_cost_m, f: (p: any) => fmt.gbp(p.whole_life_cost_m, "m") }]} />
      </Card>
      <Card title="Who the NHS buys from" sub="Suppliers by value of NHS awards of £1m+ in the last 12 months (Contracts Finder)" source={ct.source}>
        <div className="scroll" style={{ maxHeight: 420 }}><table><tbody>{m.sup.slice(0, 40).map(([s, v]: any) => <tr key={s}><td>{s}</td><td className="n">{fmt.gbp(v)}</td></tr>)}</tbody></table></div>
      </Card>
    </div>
    <Card title="Biggest NHS buyers on Contracts Finder" sub="All awards in the last 12 months, any value" style={{ marginTop: 14 }} source={ct.source}>
      <Table rows={m.buyers} initial="v" cols={[{ k: "b", h: "Buyer", v: (b: any) => b[0] }, { k: "n", h: "Awards", n: true, v: (b: any) => b[1] }, { k: "v", h: "Value", n: true, v: (b: any) => b[2], f: (b: any) => fmt.gbp(b[2]) }]} max={100} />
    </Card>
    {dhsc && <p className="muted" style={{ marginTop: 10 }}>DHSC departmental group employs {fmt.n(dhsc.headcount)} civil servants (NHS staff are not civil servants and are not counted here).</p>}
  </Page>;
}
