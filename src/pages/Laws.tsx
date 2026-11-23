import React, { useMemo, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Loading, Page, Seg, Source, Stat, Table } from "../ui";

type Act = { u?: string | null; t: string; y: number; n: number | string; d: string | null; s: string; a: string[] };
type Landmark = { t: string; area: string; era: string; context: string; did: string; effects: string; links?: string[]; sim?: string[] };
type Bill = { id: number; t: string; house: string; stage: string; updated: string; type: string; a: string[] };
export const actUrl = (a: Act) => `https://www.legislation.gov.uk/${a.u ?? `ukpga/${a.y}/${a.n}`}`;
const LINK_LABEL: Record<string, string> = { "#/nhs": "NHS", "#/education": "Education", "#/welfare": "Social security", "#/councils": "Councils", "#/map": "Infrastructure map", "#/projects": "Major projects", "#/spending": "Spending", "#/contracts": "Contracts", "#/departments": "Civil service", "#/simulate": "Simulator", "#/lab": "Model lab", "#/draft": "Drafting", "#/sources": "Sources" };

export function useActs() {
  const d = useData("legislation", "legislation_landmarks");
  return useMemo(() => {
    if (!d) return null;
    const [L, M] = d as [any, Landmark[]];
    const byTitle = new Map<string, Act>((L.acts as Act[]).map((a) => [a.t.toLowerCase(), a]));
    const landmarks = M.map((m) => { const y = +(m.t.match(/(\d{4})$/)?.[1] ?? 0); const a = byTitle.get(m.t.toLowerCase());
      return { ...m, year: y, url: a ? actUrl(a) : `https://www.legislation.gov.uk/search?title=${encodeURIComponent(m.t.replace(/ \d{4}$/, ""))}&year=${y}&type=ukpga`, act: a }; })
      .sort((a, b) => a.year - b.year);
    return { L, acts: L.acts as Act[], landmarks, bills: L.bills as Bill[] };
  }, [d]);
}

export default function Laws() {
  const D = useActs();
  // Deep links from the data hub: #/laws?tab=all&q=Housing%20Act%201988
  const hp = (k: string) => decodeURIComponent((location.hash.match(new RegExp(`[?&]${k}=([^&]+)`)) || [])[1] || "");
  const [tab, setTab] = useState<"landmarks" | "all" | "bills" | "volume">(() => (["landmarks", "all", "bills", "volume"].includes(hp("tab")) ? hp("tab") : "landmarks") as any);
  const [area, setArea] = useState("");
  const [q, setQ] = useState(() => hp("q"));
  const [from, setFrom] = useState(1945);
  if (!D) return <Loading />;
  const { L, acts, landmarks, bills } = D;
  const areas: string[] = L.areas;
  const match = (t: string, a: string[]) => (!area || a.includes(area)) && (!q || t.toLowerCase().includes(q.toLowerCase()));
  const vol = Object.keys(L.volume.ukpga).map(Number).filter((y) => y >= 1945).sort().map((y) => ({ y, acts: L.volume.ukpga[y] || 0, si: L.volume.uksi[y] || 0, dev: (L.volume.asp[y] || 0) + (L.volume.asc[y] || 0) + (L.volume.nia[y] || 0) }));
  const govBills = bills.filter((b) => b.type === "Government");
  const recent = acts.filter((a) => a.y >= 2024).length;
  return <Page title="Laws and legislation" lede="The Acts of Parliament that built today's state, what each changed and what followed, every Act passed since 1945, and the bills going through Parliament now. Use any of them as a starting point in the drafting workspace.">
    <div className="grid g4">
      <Stat v={fmt.n(acts.length)} l="Public General Acts since 1945" d={`${recent} since 2024`} />
      <Stat v={fmt.n(govBills.length)} l="Government bills before Parliament" d={`${bills.length} bills in all this session`} />
      <Stat v={fmt.n(vol.at(-2)?.si)} l={`Statutory instruments in ${vol.at(-2)?.y}`} d="secondary legislation made by ministers" />
      <Stat v={landmarks.length} l="Landmark Acts with context and effects" d="linked to the data sections" />
    </div>
    <div className="controls" style={{ marginTop: 14 }}>
      <Seg v={tab} set={setTab} opts={[["landmarks", "Landmark Acts"], ["all", "Every Act since 1945"], ["bills", "Bills in Parliament now"], ["volume", "Volume of law"]]} />
      {tab !== "volume" && <><select value={area} onChange={(e) => setArea(e.target.value)}><option value="">All policy areas</option>{areas.map((a) => <option key={a}>{a}</option>)}</select>
        <input type="search" placeholder="Search titles" value={q} onChange={(e) => setQ(e.target.value)} /></>}
      {tab === "all" && <label className="muted">From <select value={from} onChange={(e) => setFrom(+e.target.value)}>{[1945, 1979, 1997, 2010, 2020, 2024].map((y) => <option key={y}>{y}</option>)}</select></label>}
    </div>

    {tab === "landmarks" && <div className="timeline">{landmarks.filter((m) => match(m.t, [m.area])).map((m) => <div key={m.t} className="tl-item card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3><a href={m.url} target="_blank" rel="noreferrer">{m.t}</a></h3>
        <span className="muted" style={{ fontSize: 12 }}>{m.area} · {m.era}{m.act?.d ? ` · Royal Assent ${m.act.d}` : ""}</span></div>
      <div className="kv" style={{ gridTemplateColumns: "110px 1fr" }}><div>Context</div><div>{m.context}</div><div>What it did</div><div>{m.did}</div><div>What followed</div><div>{m.effects}</div></div>
      <div className="controls" style={{ margin: 0 }}>{(m.links || []).map((l) => <a key={l} className="pill" href={l}>{LINK_LABEL[l] ?? l}</a>)}
        <a className="pill" href={`#/draft?amend=${encodeURIComponent(m.t)}`}>Draft an amendment</a></div>
    </div>)}</div>}

    {tab === "all" && <Card title="Every UK Public General Act" sub="Click a row to open the Act on legislation.gov.uk. The long title says what the Act is for.">
      <Table rows={acts.filter((a) => a.y >= from && match(a.t + " " + a.s, a.a))} initial="y" max={300} onRow={(a) => window.open(actUrl(a), "_blank")}
        cols={[{ k: "y", h: "Year", v: (a) => a.y * 1000 + (+a.n || 0), f: (a) => `${a.y} c.${a.n}`, w: 90 }, { k: "t", h: "Act", v: (a) => a.t, f: (a) => <><b>{a.t}</b><div className="muted" style={{ fontSize: 12 }}>{a.s.slice(0, 220)}{a.s.length > 220 ? "…" : ""}</div></> }, { k: "a", h: "Policy area", v: (a) => a.a.join(", "), w: 200 }]} />
      <Source s={L.source} />
    </Card>}

    {tab === "bills" && <Card title="Bills in the current session" sub="Government and private members' bills that have not yet become law or fallen. Stage is the latest recorded by Parliament.">
      <Table rows={bills.filter((b) => match(b.t, b.a))} initial="updated" onRow={(b) => window.open(`https://bills.parliament.uk/bills/${b.id}`, "_blank")}
        cols={[{ k: "t", h: "Bill", v: (b) => b.t, f: (b) => <b>{b.t}</b> }, { k: "type", h: "Type", v: (b) => b.type }, { k: "house", h: "House", v: (b) => b.house }, { k: "stage", h: "Stage", v: (b) => b.stage }, { k: "updated", h: "Last activity", v: (b) => b.updated }, { k: "a", h: "Policy area", v: (b) => b.a.join(", ") }]} />
      <Source s={{ name: "UK Parliament Bills API", url: "https://bills.parliament.uk/" }} />
    </Card>}

    {tab === "volume" && <Card title="How much law is made each year" sub="Acts of the UK Parliament, UK statutory instruments, and Acts of the devolved legislatures. Most rules are now made by ministers as statutory instruments, with little parliamentary scrutiny.">
      <ResponsiveContainer width="100%" height={360}><ComposedChart data={vol} margin={{ left: -6 }} barCategoryGap="15%"><CartesianGrid vertical={false} /><XAxis dataKey="y" interval={4} /><YAxis yAxisId="a" /><YAxis yAxisId="b" orientation="right" /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
        <Area yAxisId="b" dataKey="si" name="Statutory instruments (right)" fill="var(--c8)" fillOpacity={0.25} stroke="var(--c8)" /><Bar yAxisId="a" dataKey="acts" name="UK Acts" stackId="x" fill="var(--c1)" /><Bar yAxisId="a" dataKey="dev" name="Devolved Acts" stackId="x" fill="var(--c2)" /></ComposedChart></ResponsiveContainer>
      <Source s={L.source} />
    </Card>}
  </Page>;
}
