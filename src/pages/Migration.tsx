import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { LEVERS, PRESETS, ZERO } from "../sim/engine";
import { Card, Loading, Page, Seg, Source, Stat, Table } from "../ui";
import { scenarioLink } from "./Simulate";

type Tab = "data" | "law" | "remigration" | "levers";
const LAST = (a: any[]) => a[a.length - 1];
const isYear = (y: string) => /^\d{4}$/.test(y);

// Wide table → rows of calendar years with the chosen series
function yearly(t: { years: string[]; series: Record<string, (number | null)[]> }, keys: Record<string, string>) {
  return t.years.map((y, i) => ({ y, ...Object.fromEntries(Object.entries(keys).map(([k, label]) => [k, t.series[label]?.[i] ?? null])) })).filter((r) => isYear(r.y));
}
const latest = (t: { years: string[]; series: Record<string, (number | null)[]> }, label: string, back = 0): any => t.series[label]?.[t.years.length - 1 - back];

export default function Migration() {
  const d = useData("migration", "migration_context");
  const [tab, setTab] = useState<Tab>(() => (location.hash.match(/[?&]tab=(\w+)/)?.[1] as Tab) || "data");
  useEffect(() => { const f = () => setTab((location.hash.match(/[?&]tab=(\w+)/)?.[1] as Tab) || "data"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  if (!d) return <Loading />;
  const [M, C] = d as any[];
  const A = M.asylum, lastYr = LAST(A.years);
  return <Page title="Borders, asylum and removals" lede={<>Irregular arrivals, the asylum system, detention and returns: what happens, what it costs, the laws that constrain it, and the proposals in public debate, including 'remigration'. Data: {M.source.name}.</>}>
    <div className="controls"><Seg v={tab} set={setTab} opts={[["data", "The numbers"], ["law", "Policy history and law"], ["remigration", "Remigration debate"], ["levers", "Model it"]]} /></div>
    {tab === "data" && <Data M={M} C={C} lastYr={lastYr} />}
    {tab === "law" && <Law C={C} />}
    {tab === "remigration" && <Remigration C={C} M={M} />}
    {tab === "levers" && <Levers C={C} />}
  </Page>;
}

function Data({ M, C, lastYr }: { M: any; C: any; lastYr: string }) {
  const A = M.asylum;
  const sb = latest(M.arrivals_by_method, "Small boat arrivals"), sbPrev = latest(M.arrivals_by_method, "Small boat arrivals", 1);
  const claims = latest(A, "People claiming asylum"), awaiting = latest(A, "People awaiting an initial decision");
  const sup = latest(A, "Asylum seekers in receipt of support"), hotels = latest(A, "Of which accommodated in hotels");
  const retCols = M.returns.cols as string[], retRows = M.returns.rows as any[][];
  const ci = (s: string) => retCols.findIndex((c) => c.startsWith(s));
  const retLast = LAST(retRows);
  const asylumRows = yearly(A, { claims: "People claiming asylum", decisions: "People receiving initial decisions", awaiting: "People awaiting an initial decision" });
  const grantRows = yearly(A, { rate: "Grant rate at initial decision" }).map((r: any) => ({ ...r, rate: r.rate != null ? +(r.rate * 100).toFixed(1) : null }));
  const supRows = yearly(A, { support: "Asylum seekers in receipt of support", hotels: "Of which accommodated in hotels" });
  const methodRows = yearly(M.arrivals_by_method, { boats: "Small boat arrivals", air: "Inadequately documented air arrivals", inland: "Recorded detections in the UK", ports: "Recorded detections at UK ports" });
  const monthly = (M.boats_monthly as any[]).map((r) => ({ m: `${r.y}-${String(r.m).padStart(2, "0")}`, arrivals: r.arrivals, perBoat: r.boats ? +(r.arrivals / r.boats).toFixed(1) : null }));
  const retYearly = retRows.filter((r) => isYear(r[0])).map((r) => ({ y: r[0], enforced: r[ci("Enforced returns, total")], voluntary: r[ci("Voluntary returns, total")], port: r[ci("Refused entry at port")] }));
  const sbRet = (M.small_boat_returns as any[]).map((r) => ({ y: String(r.y), n: r.n }));
  const det = (M.detention.rows as any[][]).filter((r) => isYear(r[0])).map((r) => ({ y: r[0], entering: r[1], held: r[7] }));
  const dl = M.detention_leaving, dlRows = (dl.rows as any[][]).filter((r) => isYear(r[0])).map((r) => ({ y: r[0], returned: r[1], bailedSoS: r[3], bailedIJ: r[4], other: (r[2] ?? 0) + (r[5] ?? 0) }));
  const inad = M.inadmissibility, inadRows = inad.years.filter((y: string) => /Q/.test(y)).map((y: string) => { const i = inad.years.indexOf(y); return { q: y, considered: inad.series["Total identified for consideration on inadmissibility grounds"][i], removals: inad.series["Removals"][i] }; });
  const nat = M.boats_by_nationality, ni = nat.years.length - 1;
  const natRows = Object.entries(nat.series).filter(([k]) => k !== "Total").map(([k, v]: [string, any]) => ({ k, last: v[ni], prev: v[ni - 1], y2022: v[nat.years.indexOf("2022")] }));
  const sbo = M.small_boat_outcomes.rows as any[][];
  const settle = yearly(M.settlement, { total: "Total Grants of settlement", work: "Total Work grants", family: "Total Family grants", refugee: "Total Refugee grants" });
  const cit = yearly(M.citizenship, { grants: "Total grants" });
  const src = M.source;
  return <>
    <div className="grid g4">
      <Stat v={fmt.n(sb)} l={`Small boat arrivals, ${lastYr.toLowerCase()}`} d={`${sb < sbPrev ? "down" : "up"} ${fmt.pct(Math.abs((sb / sbPrev - 1) * 100), 0)} on the year before`} color="var(--c4)" />
      <Stat v={fmt.n(claims)} l="People claiming asylum" d={`${fmt.n(latest(A, "People receiving initial decisions"))} initial decisions; grant rate ${fmt.pct(latest(A, "Grant rate at initial decision") * 100, 0)}`} />
      <Stat v={fmt.n(awaiting)} l="Awaiting an initial decision" d={`Peak ${fmt.n(Math.max(...A.series["People awaiting an initial decision"].filter((x: any) => x != null)))} at end of 2022`} />
      <Stat v={fmt.n(sup)} l="In asylum support" d={`${fmt.n(hotels)} in hotels`} color="var(--amber)" />
    </div>
    <div className="grid g4" style={{ marginTop: 14 }}>
      <Stat v={fmt.n(retLast[ci("Enforced returns, total")])} l="Enforced returns" d={lastYr} />
      <Stat v={fmt.n(retLast[ci("Voluntary returns, total")])} l="Voluntary returns" d={lastYr} />
      <Stat v={fmt.n(latest(A, "Asylum-related returns"))} l="Of which asylum-related" d={`${fmt.n(latest(A, "Enforced"))} enforced`} />
      <Stat v={fmt.n(LAST(M.detention.rows)[7])} l={`In immigration detention, ${lastYr.replace("Year ending ", "").toLowerCase()}`} d={`${fmt.n(LAST(M.detention.rows)[1])} entered in the ${lastYr.toLowerCase()}`} />
    </div>

    <h2 style={{ marginTop: 26 }}>Arrivals</h2>
    <div className="grid g2">
      <Card title="Small boat arrivals by month" sub="People detected arriving; people per boat in the tooltip" source={src}>
        <ResponsiveContainer width="100%" height={260}><BarChart data={monthly}><CartesianGrid vertical={false} /><XAxis dataKey="m" interval={11} tick={{ fontSize: 11 }} /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any, n: any) => [fmt.n(v, n === "perBoat" ? 1 : 0), n === "perBoat" ? "People per boat" : "Arrivals"]} /><Bar dataKey="arrivals" fill="var(--c1)" /><Bar dataKey="perBoat" hide /></BarChart></ResponsiveContainer>
        <p className="muted" style={{ fontSize: 12.5 }}>Boats have become more crowded: {monthly.at(-1)?.perBoat} people per boat in the latest month against about 13 in 2020, which makes each crossing more dangerous.</p>
      </Card>
      <Card title="Detected irregular arrivals by route" sub="People a year" source={src}>
        <ResponsiveContainer width="100%" height={260}><AreaChart data={methodRows}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
          <Area dataKey="boats" name="Small boats" stackId="1" stroke="var(--c1)" fill="var(--c1)" fillOpacity={0.75} /><Area dataKey="air" name="Air, inadequately documented" stackId="1" stroke="var(--c2)" fill="var(--c2)" fillOpacity={0.75} /><Area dataKey="inland" name="Detected in the UK (lorries etc.)" stackId="1" stroke="var(--c3)" fill="var(--c3)" fillOpacity={0.75} /><Area dataKey="ports" name="Detected at UK ports" stackId="1" stroke="var(--c4)" fill="var(--c4)" fillOpacity={0.75} /></AreaChart></ResponsiveContainer>
        <p className="muted" style={{ fontSize: 12.5 }}>Total detected irregular arrivals were similar in 2018 and 2025; the route moved from lorries to boats. Detections only cover people who are caught or who claim asylum; overstayers are not counted.</p>
      </Card>
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Who arrives by small boat" sub={`By nationality, ${nat.years[ni].toLowerCase()}`} source={src}>
        <Table rows={natRows} initial="last" cols={[{ k: "k", h: "Nationality", v: (r: any) => r.k }, { k: "last", h: nat.years[ni].replace("Year ending ", "YE "), n: true, v: (r: any) => r.last, f: (r: any) => fmt.n(r.last) }, { k: "prev", h: nat.years[ni - 1].replace("Year ending ", "YE "), n: true, v: (r: any) => r.prev, f: (r: any) => fmt.n(r.prev) }, { k: "y2022", h: "2022", n: true, v: (r: any) => r.y2022, f: (r: any) => fmt.n(r.y2022) }]} />
        <p className="muted" style={{ fontSize: 12.5 }}>Albanians (in 'all other nationalities') were about 12,000 of the 2022 total; after the December 2022 returns agreement the number fell to under 1,000.</p>
      </Card>
      <Card title="What happens to small boat arrivals' claims" sub="Initial decisions by outcome date, people" source={src}>
        <table><thead><tr><th>Outcome</th><th className="n">{M.small_boat_outcomes.cols[3]?.replace(" (people)", "")}</th><th className="n">{M.small_boat_outcomes.cols[4]?.replace(" (people)", "")}</th></tr></thead>
          <tbody>{sbo.filter((r) => /^(Grants|Grant of Protection|Refused|3rd Country Refusal|Withdrawn|Administrative Outcome|Total outcomes)$/.test(r[0])).map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="n">{fmt.n(r[3])}</td><td className="n">{fmt.n(r[4])}</td></tr>)}
            {sbo.filter((r) => r[0] === "Grant rate").map((r) => <tr key="gr"><td><b>Grant rate (cases)</b></td><td className="n">{fmt.pct(r[1] * 100, 0)}</td><td className="n">{fmt.pct(r[2] * 100, 0)}</td></tr>)}</tbody></table>
        <p className="muted" style={{ fontSize: 12.5 }}>'3rd country refusals' are people refused because they can be sent to a safe third country, the 'one in, one out' returns to France.</p>
      </Card>
    </div>

    <h2 style={{ marginTop: 26 }}>The asylum system</h2>
    <div className="grid g2">
      <Card title="Claims, decisions and the backlog" sub="People a year; backlog at year end" source={src}>
        <ResponsiveContainer width="100%" height={260}><LineChart data={asylumRows}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="claims" name="People claiming" stroke="var(--c1)" strokeWidth={2} dot={false} /><Line dataKey="decisions" name="Initial decisions" stroke="var(--c3)" strokeWidth={2} dot={false} /><Line dataKey="awaiting" name="Awaiting a decision" stroke="var(--c4)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        <p className="muted" style={{ fontSize: 12.5 }}>Decisions collapsed after 2019 while claims rose, so the backlog reached 161,000 people at the end of 2022. A drive to clear it from 2023 brought it down, with more refusals and more withdrawals.</p>
      </Card>
      <Card title="Grant rate at initial decision" sub="% of decisions that grant protection or other leave" source={src}>
        <ResponsiveContainer width="100%" height={260}><LineChart data={grantRows}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis unit="%" /><Tooltip formatter={(v: any) => fmt.pct(v)} /><Line dataKey="rate" name="Grant rate" stroke="var(--c2)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </Card>
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="People in asylum support and in hotels" sub="At the end of each year" source={src}>
        <ResponsiveContainer width="100%" height={260}><LineChart data={supRows}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="support" name="In support" stroke="var(--c1)" strokeWidth={2} dot={false} /><Line dataKey="hotels" name="In hotels" stroke="var(--c4)" strokeWidth={2} dot={false} connectNulls /></LineChart></ResponsiveContainer>
      </Card>
      <Card title="What it costs">
        <div className="kv" style={{ gridTemplateColumns: "1fr auto" }}>{(C.costs as any[]).map((c) => <><div key={c.label + "l"}>{c.label}<div className="muted" style={{ fontSize: 12 }}>{c.detail}</div></div><div key={c.label + "v"} style={{ fontWeight: 700, textAlign: "right" }}>{c.link ? <a href={c.link}>{c.value}</a> : c.value}</div></>)}</div>
        <Source s={(C.costs as any[]).filter((c) => c.source).map((c) => c.source)} />
      </Card>
    </div>

    <h2 style={{ marginTop: 26 }}>Detention and returns</h2>
    <div className="grid g2">
      <Card title="Returns from the UK" sub="People a year, 2004 onwards" source={src}>
        <ResponsiveContainer width="100%" height={260}><AreaChart data={retYearly}><CartesianGrid vertical={false} /><XAxis dataKey="y" interval={2} /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area dataKey="enforced" name="Enforced" stackId="1" stroke="var(--c4)" fill="var(--c4)" fillOpacity={0.75} /><Area dataKey="voluntary" name="Voluntary" stackId="1" stroke="var(--c1)" fill="var(--c1)" fillOpacity={0.75} /><Area dataKey="port" name="Refused entry at port, then left" stackId="1" stroke="var(--c7)" fill="var(--c7)" fillOpacity={0.6} /></AreaChart></ResponsiveContainer>
        <p className="muted" style={{ fontSize: 12.5 }}>Enforced returns fell from over 21,000 in 2004 to under 3,000 in 2021 and have recovered to about {fmt.n(Math.round(retLast[ci("Enforced returns, total")] / 1000) * 1000)}. Most voluntary returns are people whose visas ended, not asylum seekers.</p>
      </Card>
      <Card title="Small boat arrivals returned" sub="People a year (2026: January to June)" source={src}>
        <ResponsiveContainer width="100%" height={260}><BarChart data={sbRet}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Bar dataKey="n" name="Returned" fill="var(--c2)" /></BarChart></ResponsiveContainer>
        <p className="muted" style={{ fontSize: 12.5 }}>Against {fmt.n(latest(M.arrivals_by_method, "Small boat arrivals"))} arrivals in the latest year. Most are Albanians and other nationals of countries with returns arrangements.</p>
      </Card>
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Immigration detention" sub="Entries a year and people held at year end" source={src}>
        <ResponsiveContainer width="100%" height={240}><LineChart data={det}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis yAxisId="a" tickFormatter={(v: number) => fmt.n(v)} /><YAxis yAxisId="b" orientation="right" tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line yAxisId="a" dataKey="entering" name="Entering detention (left axis)" stroke="var(--c1)" strokeWidth={2} dot={false} /><Line yAxisId="b" dataKey="held" name="Held at year end (right axis)" stroke="var(--c4)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </Card>
      <Card title="How people leave detention" sub="People a year" source={src}>
        <ResponsiveContainer width="100%" height={240}><AreaChart data={dlRows}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area dataKey="returned" name="Returned from the UK" stackId="1" stroke="var(--c1)" fill="var(--c1)" fillOpacity={0.75} /><Area dataKey="bailedSoS" name="Bailed by the Home Office" stackId="1" stroke="var(--c2)" fill="var(--c2)" fillOpacity={0.75} /><Area dataKey="bailedIJ" name="Bailed by a judge" stackId="1" stroke="var(--c4)" fill="var(--c4)" fillOpacity={0.75} /><Area dataKey="other" name="Granted leave or other" stackId="1" stroke="var(--c7)" fill="var(--c7)" fillOpacity={0.6} /></AreaChart></ResponsiveContainer>
        <p className="muted" style={{ fontSize: 12.5 }}>Fewer than half of people detained are removed; the rest are released, usually because removal is not imminent.</p>
      </Card>
    </div>
    <Card title="Inadmissibility: people considered and removed" sub="By quarter. Most people considered were later admitted to the UK process because no third country would take them" source={src} style={{ marginTop: 14 }}>
      <ResponsiveContainer width="100%" height={220}><BarChart data={inadRows}><CartesianGrid vertical={false} /><XAxis dataKey="q" interval={3} tick={{ fontSize: 11 }} /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="considered" name="Considered for inadmissibility" fill="var(--c3)" /><Bar dataKey="removals" name="Removed to a third country" fill="var(--c4)" /></BarChart></ResponsiveContainer>
    </Card>

    <h2 style={{ marginTop: 26 }}>Settlement and citizenship</h2>
    <div className="grid g2">
      <Card title="Grants of settlement (indefinite leave to remain)" sub="People a year, by route" source={src}>
        <ResponsiveContainer width="100%" height={240}><AreaChart data={settle}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area dataKey="work" name="Work" stackId="1" stroke="var(--c1)" fill="var(--c1)" fillOpacity={0.75} /><Area dataKey="family" name="Family" stackId="1" stroke="var(--c2)" fill="var(--c2)" fillOpacity={0.75} /><Area dataKey="refugee" name="Refugees" stackId="1" stroke="var(--c3)" fill="var(--c3)" fillOpacity={0.75} /></AreaChart></ResponsiveContainer>
      </Card>
      <Card title="Grants of British citizenship" sub="People a year" source={src}>
        <ResponsiveContainer width="100%" height={240}><BarChart data={cit}><CartesianGrid vertical={false} /><XAxis dataKey="y" interval={2} /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.n(v)} /><Bar dataKey="grants" name="Grants" fill="var(--c1)" /></BarChart></ResponsiveContainer>
      </Card>
    </div>
    <div className="flag gap" style={{ marginTop: 14 }}>Not published: the number of people living in the UK without status, the asylum appeals backlog since 2023 (now in Ministry of Justice tribunal statistics), and costs per removal. The model's assumptions for these are on the Model it tab and editable in the simulator.</div>
  </>;
}

function Law({ C }: { C: any }) {
  return <>
    <Card title="How the policy got here"><div className="timeline">{(C.timeline as any[]).map((e) => <div className="tl-item" key={e.title}><div className="muted" style={{ fontSize: 12 }}>{e.year}</div><h2>{e.title}</h2><div style={{ fontSize: 13.5 }}>{e.text}</div></div>)}</div></Card>
    <Card title="What constrains removals" sub="The legal and practical limits any policy has to deal with" style={{ marginTop: 14 }}>
      <Table rows={C.constraints} initial="t" cols={[{ k: "t", h: "Constraint", v: (r: any) => r.title, f: (r: any) => <b>{r.title}</b>, w: 170 }, { k: "l", h: "Law", v: (r: any) => r.law, w: 230 }, { k: "e", h: "Effect", v: (r: any) => r.effect }]} />
      <Source s={C.sources} />
    </Card>
  </>;
}

function Remigration({ C, M }: { C: any; M: any }) {
  const R = C.remigration;
  return <>
    <div className="flag gap">{R.summary}</div>
    <div className="grid g3">{(R.meanings as any[]).map((m) => <Card key={m.title} title={m.title} sub={m.who}><p style={{ fontSize: 13.5 }}>{m.what}</p><p className="muted" style={{ fontSize: 12.5 }}>{m.numbers}</p></Card>)}</div>
    <h2 style={{ marginTop: 26 }}>The plans on the table</h2>
    <div className="grid g3">{(R.plans as any[]).map((p) => <Card key={p.party} title={p.party} source={p.source}><ul style={{ paddingLeft: 18, fontSize: 13.5, margin: 0 }}>{p.points.map((x: string) => <li key={x} style={{ marginBottom: 4 }}>{x}</li>)}</ul></Card>)}</div>
    <Card title="The arithmetic" sub="What removal at scale would take, from the Home Office data on the first tab" style={{ marginTop: 14 }} source={M.source}>
      <ul style={{ paddingLeft: 18, fontSize: 13.5, margin: 0 }}>{(R.arithmetic as string[]).map((x) => <li key={x} style={{ marginBottom: 6 }}>{x}</li>)}</ul>
    </Card>
    <div className="controls" style={{ marginTop: 14 }}>
      {PRESETS.filter((p) => /asylum|ECHR|Inadmissib/.test(p.name)).map((p) => <a key={p.name} className="seg" href={scenarioLink({ name: p.name, levers: { ...ZERO, ...p.levers } as any, params: {} })}>Run in the simulator: {p.name}</a>)}
    </div>
  </>;
}

function Levers({ C }: { C: any }) {
  const keys = ["asyCaseworkers", "asyAppeals", "returnsCapacity", "detentionPlaces", "returnDeals", "dispersalPlaces", "arrivalsShock", "echr", "asylumInadmissible", "appealsRoute", "settlementExtra", "deprivation", "descentEntry", "nationalityBan", "returnsPenalty", "chemCast", "chemExtend"];
  const S = C.sentencing;
  return <>
    <p className="lede" style={{ marginTop: 0 }}>These levers are in the <a href="#/simulate">policy simulator</a> and the <a href="#/sandbox">sandbox campaign</a>, under 'Asylum and borders', 'Immigration and nationality law' and 'Justice'. Each one runs through the same model as tax and spending: costs, population, labour supply, borrowing, and new scores for the asylum system, legal challenge risk and diplomatic friction. Every assumption is editable on the simulator's Parameters tab.</p>
    <Card title="Levers">
      <Table rows={LEVERS.filter((l) => keys.includes(l.k))} initial="g" max={50} cols={[{ k: "g", h: "Group", v: (l) => l.group, w: 140 }, { k: "l", h: "Lever", v: (l) => l.label, f: (l) => <><b>{l.label}</b><div className="muted" style={{ fontSize: 12 }}>{l.opts ? l.opts.join(" · ") : `${l.min} to ${l.max} ${l.unit}`}</div></> }, { k: "h", h: "What it does", v: (l) => l.help ?? "" }]} />
    </Card>
    <div className="grid g2" style={{ marginTop: 14 }}>{(C.law_levers as any[]).map((l) => <Card key={l.id} title={l.title}><div className="muted" style={{ fontSize: 12.5 }}>{l.options.join(" · ")}</div><p style={{ fontSize: 13.5 }}>{l.notes}</p></Card>)}</div>
    <Card title={S.title} style={{ marginTop: 14 }} source={S.source}>
      <p style={{ fontSize: 13.5 }}>{S.text}</p>
      <div className="kv"><div>Evidence</div><div>{S.evidence}</div><div>Law</div><div>{S.law}</div><div>Elsewhere</div><div><ul style={{ margin: 0, paddingLeft: 18 }}>{S.comparators.map((x: string) => <li key={x}>{x}</li>)}</ul></div></div>
    </Card>
    <div className="flag gap" style={{ marginTop: 14 }}>The model does not include levers for removing citizens or lawful residents, for removal by ethnicity, or for sterilisation. Those are covered as history and analysis: see the Remigration debate tab and <a href="#/eugenics">Eugenics and sterilisation</a>.</div>
  </>;
}
