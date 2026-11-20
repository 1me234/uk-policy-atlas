import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cssVar, fmt, useData } from "../lib";
import { esc, useLeaflet } from "../map";
import { Card, Loading, Page, Stat } from "../ui";

const TYPE_COLORS: Record<string, string> = {
  reservoir: "#2b5fab", dam: "#5b84c4", "railway line": "#a3425f", "railway station": "#c97a92", motorway: "#d08a0e", bridge: "#8c6d46", tunnel: "#6b5a4a",
  "power station": "#7a5ea8", "wind farm": "#3c9aa6", "nuclear power plant": "#c2362f", airport: "#0f5e63", port: "#2e8540", hospital: "#e05a7a", prison: "#555", canal: "#6b8e23", "water treatment plant": "#4aa3c9",
};
const year = (a: any) => { const s = a.opened || a.built; return s ? parseInt(s.slice(0, 4)) : null; };
export default function InfraMap() {
  const d = useData("infrastructure");
  const el = useRef<HTMLDivElement>(null);
  const map = useLeaflet(el, !!d);
  const layer = useRef<L.LayerGroup | null>(null);
  const [on, setOn] = useState<Set<string>>(new Set(["reservoir", "railway line", "motorway", "power station", "nuclear power plant", "airport", "port"]));
  const [maxYear, setMaxYear] = useState(2026);
  const [onlyDated, setOnlyDated] = useState(false);
  const assets = d ? (d[0] as any).assets as any[] : [];
  const types = useMemo(() => Object.entries(assets.reduce((a: any, x) => ((a[x.type] = (a[x.type] || 0) + 1), a), {})).sort((a: any, b: any) => b[1] - a[1]) as [string, number][], [assets]);
  const shown = useMemo(() => assets.filter((a) => on.has(a.type) && (year(a) == null ? !onlyDated : year(a)! <= maxYear)), [assets, on, maxYear, onlyDated]);
  useEffect(() => {
    if (!map.current || !d) return;
    layer.current?.remove();
    const g = L.layerGroup();
    for (const a of shown) {
      L.circleMarker([a.lat, a.lon], { radius: a.type === "railway station" || a.type === "bridge" ? 2.5 : 4.5, color: TYPE_COLORS[a.type] || "#888", weight: 1, fillOpacity: 0.75 })
        .bindPopup(`<b>${esc(a.name)}</b><br>${esc(a.type)}${a.built ? `<br>Built/inception: ${esc(a.built)}` : ""}${a.opened ? `<br>Opened: ${esc(a.opened)}` : ""}${a.cost ? `<br>Cost: ${esc(fmt.n(a.cost))} ${esc(a.cost_unit || "")}` : ""}${a.part_of?.length ? `<br>Part of: ${esc(a.part_of.join(", "))}` : ""}${a.operator?.length ? `<br>Operator: ${esc(a.operator.join(", "))}` : ""}${a.length_m ? `<br>Length: ${esc(fmt.n(a.length_m))}` : ""}<br><a target="_blank" href="https://www.wikidata.org/wiki/${esc(a.id)}">Wikidata</a>${a.wikipedia ? ` · <a target="_blank" href="${esc(a.wikipedia)}">Wikipedia</a>` : ""}`)
        .addTo(g);
    }
    g.addTo(map.current); layer.current = g;
  }, [shown, d, map.current]);
  if (!d) return <Loading />;
  const src = (d[0] as any).source;
  const decades = Array.from({ length: 18 }, (_, i) => 1850 + i * 10);
  const decadeTypes = ["reservoir", "railway line", "motorway", "power station", "airport", "hospital"];
  const perDecade = decades.map((dec) => ({ dec: `${dec}s`, ...Object.fromEntries(decadeTypes.map((t) => [t, assets.filter((a) => a.type === t && year(a) != null && year(a)! >= dec && year(a)! < dec + 10).length])) }));
  const toggle = (t: string) => { const s = new Set(on); s.has(t) ? s.delete(t) : s.add(t); setOn(s); };
  const withCost = assets.filter((a) => a.cost);
  return <Page title="Infrastructure map" lede="Roads, railways, reservoirs, power, ports, hospitals and more, with when each was built, what it cost and the bigger scheme it belonged to where known. Drag the year slider to watch the network grow, and use the decade chart to see where building has stopped.">
    <div className="grid g4">
      <Stat v={fmt.n(assets.length)} l="Mapped assets" />
      <Stat v={fmt.n(assets.filter((a) => year(a)).length)} l="With a build or opening date" />
      <Stat v={fmt.n(withCost.length)} l="With a recorded cost" d="Cost coverage is the biggest gap in open infrastructure data" />
      <Stat v={fmt.n(shown.length)} l="Showing now" />
    </div>
    <Card style={{ marginTop: 14 }} source={src}>
      <div className="controls">
        {types.map(([t, n]) => <button key={t} className={`seg ${on.has(t) ? "on" : ""}`} onClick={() => toggle(t)} style={on.has(t) ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] } : {}}>{t} ({fmt.n(n)})</button>)}
      </div>
      <div className="controls">
        <label>Built by <b>{maxYear}</b> <input type="range" min={1800} max={2026} value={maxYear} onChange={(e) => setMaxYear(+e.target.value)} style={{ width: 280, verticalAlign: "middle" }} /></label>
        <label><input type="checkbox" checked={onlyDated} onChange={(e) => setOnlyDated(e.target.checked)} /> Only assets with a known date</label>
      </div>
      <div ref={el} className="map" />
    </Card>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="What was built in each decade" sub="Count of mapped assets by build or opening date. Gaps show where building stopped (for example, no new large reservoirs for decades)." source={src}>
        <ResponsiveContainer width="100%" height={280}><BarChart data={perDecade}><XAxis dataKey="dec" interval={1} tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{decadeTypes.map((t) => <Bar key={t} dataKey={t} stackId="a" fill={TYPE_COLORS[t]} />)}</BarChart></ResponsiveContainer>
      </Card>
      <Card title="Assets with a recorded cost" sub="Largest first; costs are in the units recorded (often nominal, at the time of building)" source={src}>
        <div className="scroll" style={{ maxHeight: 280 }}><table><tbody>{withCost.sort((a, b) => b.cost - a.cost).slice(0, 60).map((a) => <tr key={a.id}><td>{a.name}<div className="muted" style={{ fontSize: 11.5 }}>{a.type}{year(a) ? ` · ${year(a)}` : ""}</div></td><td className="n">{fmt.n(a.cost)} {a.cost_unit === "pound sterling" ? "£" : a.cost_unit}</td></tr>)}</tbody></table></div>
      </Card>
    </div>
  </Page>;
}
