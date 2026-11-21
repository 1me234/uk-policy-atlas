import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Loading, Page, Seg } from "../ui";

const LINK: Record<string, [string, string]> = { welfare: ["#/welfare", "Social security"], spending: ["#/spending", "Spending"], nhs: ["#/nhs", "NHS"], map: ["#/map", "Infrastructure map"], councils: ["#/councils", "Councils"], education: ["#/education", "Education"], projects: ["#/projects", "Major projects"], foreign: ["#/foreign", "Foreign affairs"], departments: ["#/departments", "Departments"], contracts: ["#/contracts", "Contracts"] };

type Pt = { x: number; y: number | null };
type Chart = { label: string; unit: string; data: Pt[]; source: any };
const yr = (s: string) => parseInt(String(s).slice(0, 4), 10);

// Build the evidence charts for each policy from the atlas's own datasets.
function charts(D: any): Record<string, Chart[]> {
  const { welfare: W, fiscal: F, nhs: N, send: S, oda: O } = D;
  const wl = (sheet: string, label: string, section?: RegExp) => {
    const t = W.sheets[sheet]; const s = t.series.find((x: any) => x.label === label && (!section || section.test(x.section)));
    return s ? t.years.map((y: string, i: number) => ({ x: yr(y), y: s.values[i] })).filter((p: Pt) => p.y != null && p.x <= 2025) : [];
  };
  const fs = (block: string, label: string) => { const b = F[block]; const v = b.series[label]; return v ? b.years.map((y: string, i: number) => ({ x: yr(y), y: v[i] })).filter((p: Pt) => p.y != null && p.x <= 2025) : []; };
  const benGdp: Chart = { label: "Benefit spending, % of GDP", unit: "%", data: wl("Benefit summary table", "Total", /^Benefit expenditure, \nas a share of Gross/).map((p: Pt) => ({ x: p.x, y: p.y != null && p.y < 1 ? p.y * 100 : p.y })), source: W.source };
  const tme: Chart = { label: "Total public spending, % of GDP", unit: "%", data: fs("pct_gdp", "Total managed expenditure"), source: F.source };
  const psni: Chart = { label: "Public sector net investment, % of GDP", unit: "%", data: fs("pct_gdp", "Public sector net investment"), source: F.source };
  const psnb: Chart = { label: "Public sector net borrowing, % of GDP", unit: "%", data: fs("pct_gdp", "Public sector net borrowing"), source: F.source };
  const debt: Chart = { label: "Public sector net debt, % of GDP", unit: "%", data: fs("pct_gdp", "Public sector net debt2"), source: F.source };
  const rtt: Chart = { label: "Hospital patients waiting under 18 weeks (%)", unit: "%", data: N.rtt_long.map((r: any) => ({ x: 2000 + parseInt(r.month.slice(4), 10) + ({ Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 } as any)[r.month.slice(0, 3)] / 12, y: r.within18_pct })), source: N.source };
  const hb: Chart = { label: "Housing benefit spending, £m (2026/27 prices)", unit: "£m", data: wl("Table 1b", "Housing benefits (exc. Universal Credit)"), source: W.source };
  return {
    "Beveridge Report": [benGdp, tme],
    "National Health Service founded": [tme],
    "Right to Buy": [hb],
    "Private Finance Initiative (PFI)": [psni],
    "Academies Act and austerity": [tme, debt],
    "Health and Social Care Act": [rtt],
    "Integrated care boards": [rtt],
    "Universal Credit": [{ label: "Universal Credit claimants (thousands)", unit: "k", data: wl("Table 1c", "Universal Credit"), source: W.source }, { label: "Universal Credit spending, £m (2026/27 prices)", unit: "£m", data: wl("Table 1b", "Universal Credit"), source: W.source }],
    "Covid-19 emergency spending": [psnb, debt],
    "EU referendum and Brexit": [tme],
    "Children and Families Act: EHC plans": [{ label: "Education, health and care plans in force (January)", unit: "", data: S.national.map((r: any) => ({ x: yr(r.year) + 1, y: r.total })), source: S.source }],
    "Aid cut from 0.7% to 0.5% of national income": [{ label: "UK aid in project-level data, £m (cash)", unit: "£m", data: O.years.map((y: number, i: number) => ({ x: y, y: O.total[i] })), source: O.source }, { label: "Aid spent in the UK on refugees and asylum seekers, £m", unit: "£m", data: O.years.map((y: number, i: number) => ({ x: y, y: O.by_sector.find((r: any) => r.label === "Refugees in Donor Countries")?.values[i] ?? null })), source: O.source }],
  };
}

function Mini({ c, at }: { c: Chart; at: number }) {
  if (!c.data.length) return null;
  return <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
    <ResponsiveContainer width="100%" height={150}><LineChart data={c.data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}><CartesianGrid vertical={false} /><XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => String(Math.floor(v))} allowDecimals={false} /><YAxis width={52} tickFormatter={(v: number) => (c.unit === "%" ? `${v}%` : fmt.n(v))} /><Tooltip labelFormatter={(v: any) => String(Math.floor(v))} formatter={(v: any) => (c.unit === "%" ? fmt.pct(v) : c.unit === "£m" ? fmt.gbp(v, "m") : c.unit === "k" ? fmt.n(v * 1000) : fmt.n(v))} /><ReferenceLine x={at} stroke="var(--red)" strokeDasharray="4 3" /><Line dataKey="y" stroke="var(--c1)" strokeWidth={2} dot={false} connectNulls /></LineChart></ResponsiveContainer>
    <div className="muted" style={{ fontSize: 11 }}>Source: <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.name.split(",")[0]}</a></div>
  </div>;
}

export default function History() {
  const d = useData("policy_history", "welfare", "fiscal", "nhs_performance", "send", "oda", "major_projects");
  const [dom, setDom] = useState("");
  if (!d) return <Loading />;
  const [h, welfare, fiscal, nhs, send, oda, mp] = d as any[];
  const C = charts({ welfare, fiscal, nhs, send, oda });
  const doms = [...new Set(h.policies.map((p: any) => p.domain))] as string[];
  const list = h.policies.filter((p: any) => !dom || p.domain === dom).sort((a: any, b: any) => a.year - b.year);
  const proj = (re: string) => mp.projects.filter((p: any) => new RegExp(re, "i").test(p.name));
  return <Page title="Policy history" lede="Landmark policies: the problem they answered, what changed, what the evidence says happened, and the atlas data that tracks the consequences. The red dashed line on each chart marks the year of the policy.">
    <div className="controls"><Seg opts={[["", "All"], ...doms.map((x) => [x, x] as [string, string])]} v={dom} set={setDom} /></div>
    <Card><div className="timeline">{list.map((p: any) => {
      const cs = C[p.title] || []; const pr = p.projects ? proj(p.projects) : [];
      return <div className="tl-item" key={p.title}>
        <div className="muted" style={{ fontSize: 12 }}>{p.year} · {p.domain}</div>
        <h2>{p.title}</h2>
        <div className="kv" style={{ gridTemplateColumns: "110px 1fr" }}><div>Context</div><div>{p.context}</div><div>What changed</div><div>{p.change}</div><div>Effects</div><div>{p.effects}</div>{p.cost && <><div>Cost</div><div>{p.cost}</div></>}<div>Track it</div><div>{p.track.map((t: string) => LINK[t] && <a key={t} href={LINK[t][0]} style={{ marginRight: 10 }}>{LINK[t][1]}</a>)}</div></div>
        {cs.length > 0 && <div className="grid g2" style={{ marginTop: 10 }}>{cs.map((c) => <Mini key={c.label} c={c} at={p.year} />)}</div>}
        {pr.length > 0 && <div style={{ marginTop: 8, fontSize: 13 }}><b>In the major projects portfolio today:</b> {pr.map((x: any, i: number) => <span key={x.id}>{i > 0 && " · "}<a href={`#/projects/${encodeURIComponent(x.id)}`}>{x.name}</a> ({x.dca_nista || x.dca_sro}, whole-life {fmt.gbp(x.whole_life_cost_m, "m")})</span>)}</div>}
        <div className="src">Sources: {p.sources.map((s: any, i: number) => <span key={i}>{i > 0 && " · "}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></span>)}</div>
      </div>;
    })}</div><div className="muted" style={{ fontSize: 12 }}>{h.note}</div></Card>
  </Page>;
}
