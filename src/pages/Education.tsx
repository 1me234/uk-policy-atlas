import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { esc, useLeaflet } from "../map";
import { Card, Loading, Page, Seg, Stat, Table } from "../ui";

type Mode = "util" | "p8" | "fsm" | "ofsted";
const OFC: Record<string, string> = { concern: "#c2362f", weak: "#d08a0e", good: "#7fb8b1", strong: "#0f5e63" };
const colorFor = (mode: Mode, s: any) => {
  if (mode === "util") { if (!s.capacity || s.pupils == null) return "#999"; const u = s.pupils / s.capacity; return u > 1.05 ? "#c2362f" : u > 0.95 ? "#d08a0e" : u < 0.75 ? "#2b5fab" : "#2e8540"; }
  if (mode === "p8") { const p = s.attainment8; if (p == null) return null; return p < 35 ? "#c2362f" : p < 45 ? "#d08a0e" : p < 55 ? "#7fb8b1" : "#0f5e63"; }
  if (mode === "ofsted") return s.ofsted ? OFC[s.ofsted] : null;
  const f = s.fsm_pct; if (f == null) return "#999"; return f >= 40 ? "#a3425f" : f >= 25 ? "#d08a0e" : f >= 12 ? "#7fb8b1" : "#0f5e63";
};
const LEG: Record<Mode, [string, string][]> = {
  util: [["#c2362f", "Over capacity (>105%)"], ["#d08a0e", "Near full (95–105%)"], ["#2e8540", "75–95% full"], ["#2b5fab", "Under 75% full (surplus places)"], ["#999", "No capacity data"]],
  p8: [["#c2362f", "Attainment 8 under 35"], ["#d08a0e", "35 to 45"], ["#7fb8b1", "45 to 55"], ["#0f5e63", "55 or more"]],
  ofsted: [["#c2362f", "Serious concern (inadequate, urgent improvement or special measures)"], ["#d08a0e", "Needs attention / requires improvement"], ["#7fb8b1", "Good / expected standard"], ["#0f5e63", "Strong / outstanding"]],
  fsm: [["#a3425f", "≥40% pupils on free school meals"], ["#d08a0e", "25–40%"], ["#7fb8b1", "12–25%"], ["#0f5e63", "<12%"]],
};
export default function Education() {
  const d = useData("schools", "spending", "assessments");
  const [mode, setMode] = useState<Mode>("util");
  const [phase, setPhase] = useState("Primary");
  const el = useRef<HTMLDivElement>(null);
  const map = useLeaflet(el, !!d);
  const layer = useRef<L.LayerGroup | null>(null);
  const schools = useMemo(() => {
    if (!d) return [];
    const s = d[0] as any; const F = s.fields as string[];
    return s.schools.map((r: any[]) => Object.fromEntries(F.map((f, i) => [f, r[i]])));
  }, [d]);
  const state = schools.filter((s: any) => s.type !== "Independent schools" && s.type !== "Welsh schools");
  useEffect(() => {
    if (!map.current || !d) return;
    layer.current?.remove();
    const g = L.layerGroup();
    for (const s of state) {
      if (phase && !(s.phase || "").includes(phase)) continue;
      const c = colorFor(mode, s); if (!c) continue;
      L.circleMarker([s.lat, s.lon], { radius: 3, color: c, weight: 0.5, fillOpacity: 0.85 })
        .bindPopup(`<b>${esc(s.name)}</b><br>${esc(s.phase)} · ${esc(s.type)}${s.trust ? `<br>Trust: ${esc(s.trust)}` : ""}<br>Pupils ${esc(fmt.n(s.pupils))} / capacity ${esc(fmt.n(s.capacity))}<br>Free school meals: ${esc(fmt.pct(s.fsm_pct))}${s.attainment8 != null ? `<br>Attainment 8: ${esc(s.attainment8)}${s.progress8 != null ? ` · Progress 8: ${esc(s.progress8)}` : ""} · 5+ in English & maths: ${esc(fmt.pct(s.engmath_5plus_pct))} (${esc(String(s.ks4_year).replace(/(\d{4})(\d\d)/, "$1-$2"))})` : ""}${s.ofsted_detail ? `<br>Ofsted (${esc(s.ofsted_date)}): ${esc(s.ofsted_detail)}` : ""}<br><a target="_blank" href="https://get-information-schools.service.gov.uk/Establishments/Establishment/Details/${esc(s.urn)}">GIAS record</a>`)
        .addTo(g);
    }
    g.addTo(map.current); layer.current = g;
  }, [d, mode, phase, map.current]);
  if (!d) return <Loading />;
  const [sc, sp, as] = d as any[];
  const pupils = state.reduce((a: number, s: any) => a + (s.pupils || 0), 0), cap = state.reduce((a: number, s: any) => a + (s.capacity && s.pupils != null ? s.capacity : 0), 0);
  const over = state.filter((s: any) => s.capacity && s.pupils > s.capacity * 1.05).length, under = state.filter((s: any) => s.capacity && s.pupils != null && s.pupils < s.capacity * 0.75).length;
  const edu = sp.tables.by_subfunction.rows.filter((r: any) => /^9\.\d/.test(r.label) && r.values);
  const types = Object.entries(state.reduce((a: any, s: any) => ((a[s.type] = (a[s.type] || 0) + 1), a), {})).map(([k, v]) => ({ k, v })).sort((a: any, b: any) => b.v - a.v);
  const trusts = Object.entries(state.reduce((a: any, s: any) => { if (s.trust) { a[s.trust] = a[s.trust] || { n: 0, p: 0, p8: [] }; a[s.trust].n++; a[s.trust].p += s.pupils || 0; if (s.attainment8 != null) a[s.trust].p8.push(s.attainment8); } return a; }, {})).map(([k, v]: any) => ({ k, n: v.n, p: v.p, p8: v.p8.length ? v.p8.reduce((a: number, b: number) => a + b, 0) / v.p8.length : null }));
  const rating = as.services.find((s: any) => s.domain === "education");
  return <Page title="Education" lede="Every open school in England on a map: how full it is, how disadvantaged its intake is and its GCSE results. Falling primary rolls are leaving surplus places in some areas while others are over capacity.">
    <div className="grid g4">
      <Stat v={fmt.n(state.length)} l="Open state-funded schools and colleges" d={`plus ${fmt.n(schools.length - state.length)} independent and Welsh`} />
      <Stat v={fmt.n(pupils)} l="Pupils on roll" d={`${fmt.pct((pupils / cap) * 100, 0)} of reported capacity`} />
      <Stat v={fmt.n(over)} l="Schools over 105% capacity" color="var(--red)" />
      <Stat v={fmt.n(under)} l="Schools under 75% full" color="var(--blue)" d="Surplus places cost money per pupil and threaten viability" />
    </div>
    <Card style={{ marginTop: 14 }} source={[sc.source, sc.source_ks4, sc.source_ofsted]}>
      <div className="controls"><Seg opts={[["util", "How full"], ["p8", "GCSE results (Attainment 8)"], ["fsm", "Free school meals"], ["ofsted", "Ofsted"]]} v={mode} set={(m) => { setMode(m); if (m === "p8") setPhase("Secondary"); }} /><Seg opts={[["Primary", "Primary"], ["Secondary", "Secondary"], ["", "All phases"]]} v={phase as any} set={setPhase} /></div>
      <div ref={el} className="map" />
      <div className="legend">{LEG[mode].map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>
    </Card>
    <Card title="Ofsted outcomes" sub="Latest inspection of each open state-funded school, grouped into four bands, with the share of pupils in each" style={{ marginTop: 14 }} source={sc.source_ofsted}>
      <table><thead><tr><th>Band</th>{["Primary", "Secondary", "All"].map((ph) => <th key={ph} className="n">{ph}: schools (pupils)</th>)}</tr></thead><tbody>{["concern", "weak", "good", "strong"].map((b) => <tr key={b}><td><i style={{ display: "inline-block", width: 10, height: 10, background: OFC[b], marginRight: 6, borderRadius: 2 }} />{LEG.ofsted[["concern", "weak", "good", "strong"].indexOf(b)][1]}</td>{["Primary", "Secondary", ""].map((ph) => { const S = state.filter((x: any) => x.ofsted && (!ph || x.phase === ph)); const B = S.filter((x: any) => x.ofsted === b); const pp = (z: any[]) => z.reduce((a: number, x: any) => a + (x.pupils || 0), 0); return <td key={ph} className="n">{fmt.n(B.length)} ({fmt.pct((pp(B) / Math.max(1, pp(S))) * 100, 0)})</td>; })}</tr>)}</tbody></table>
      <p className="muted" style={{ fontSize: 12 }}>{fmt.n(state.filter((x: any) => !x.ofsted).length)} schools have no inspection outcome on record (mostly new or recently converted schools).</p>
    </Card>
    <div className="grid g3" style={{ marginTop: 14 }}>
      <Card title="Independent assessment" source={as.source}>{rating && <><div className="kv"><div>2010–24</div><div>{rating["2010_24"]}</div><div>2024–26</div><div>{rating["2024_26"]}</div><div>Outlook to 2029</div><div>{rating.outlook_2029}</div></div><p>{rating.why}</p></>}</Card>
      <Card title="Education spending by sub-function (£m)" source={sp.source}><table><tbody>{edu.map((r: any) => <tr key={r.label}><td>{r.label}</td><td className="n">{fmt.n(r.values.at(-1))}</td></tr>)}</tbody></table></Card>
      <Card title="School types" source={sc.source}><ResponsiveContainer width="100%" height={230}><BarChart data={types} layout="vertical" margin={{ left: 60 }}><XAxis type="number" /><YAxis type="category" dataKey="k" width={170} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="v" fill="var(--c3)" /></BarChart></ResponsiveContainer></Card>
    </div>
    <Card title="Academy trusts" sub="Schools, pupils and average Attainment 8 of their secondary schools (2025-26)" style={{ marginTop: 14 }} source={[sc.source, sc.source_ks4]}>
      <Table rows={trusts} initial="n" cols={[{ k: "k", h: "Trust", v: (t: any) => t.k }, { k: "n", h: "Schools", n: true, v: (t: any) => t.n }, { k: "p", h: "Pupils", n: true, v: (t: any) => t.p, f: (t: any) => fmt.n(t.p) }, { k: "p8", h: "Avg Attainment 8", n: true, v: (t: any) => t.p8, f: (t: any) => t.p8 == null ? "–" : t.p8.toFixed(1) }]} max={200} />
    </Card>
  </Page>;
}
