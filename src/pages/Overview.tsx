import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Loading, Page, Pill, Stat } from "../ui";

export default function Overview() {
  const d = useData("fiscal", "spending", "civil_service", "major_projects", "charities", "contracts");
  if (!d) return <Loading />;
  const [fiscal, spend, cs, mp, ch, ct] = d as any[];
  const s = fiscal.since_1900;
  const series = s.years.map((y: string, i: number) => ({ y, receipts: s.series["Total receipts (PSCR)"][i], spending: s.series["Total spending (TME)"][i], debt: s.series["Public sector net debt (PSND)"][i] }));
  const firstForecast = "2026-27";
  const tme = spend.tables.tme_by_department.rows.find((r: any) => r.values && r.label.startsWith("Total Managed Expenditure"));
  const fn = spend.tables.by_function;
  const last = fn.years.length - 1;
  const fnRows = fn.rows.filter((r: any) => /^\d+\./.test(r.label)).map((r: any) => ({ name: r.label.replace(/^\d+\.\s*/, "").replace(/\(.*\)/, ""), v: r.values[last] })).sort((a: any, b: any) => b.v - a.v);
  const projects = mp.projects as any[];
  const rag = (p: any) => p.dca_nista || p.dca_sro;
  const red = projects.filter((p) => rag(p) === "RED");
  const debtNow = series.filter((x: any) => x.y < firstForecast).at(-1);
  const csTotal = cs.organisations.find((o: any) => o.name === "Overall Civil Service");
  return <Page title="The UK state at a glance" lede="A working atlas of what government spends, how it is organised, what it is building and how services perform, built from official open data. Every figure links to the file it came from.">
    <div className="grid g4">
      <Stat v={fmt.gbp(tme.values.at(-1), "m")} l="Total managed expenditure, 2025-26 plans" d={`Outturn 2024-25: ${fmt.gbp(tme.values.at(-2), "m")}`} />
      <Stat v={fmt.pct(debtNow.debt, 0)} l={`Public sector net debt, % of GDP (${debtNow.y})`} d={`Spending ${fmt.pct(debtNow.spending, 1)} vs receipts ${fmt.pct(debtNow.receipts, 1)} of GDP`} />
      <Stat v={fmt.n(csTotal.headcount)} l="Civil servants (headcount, March 2025)" d={`Median salary ${fmt.gbp(csTotal.median_salary)}`} />
      <Stat v={`${projects.length}`} l="Government major projects" d={<><span style={{ color: "var(--red)" }}>{red.length} rated red</span>, whole-life cost {fmt.gbp(projects.reduce((a, p) => a + (p.whole_life_cost_m || 0), 0), "m")}</>} />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Spending, receipts and debt since 1900" sub="Per cent of GDP. Shaded years are OBR forecasts." source={fiscal.source}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={series} margin={{ left: -10, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="y" interval={14} tickFormatter={(y) => y.slice(0, 4)} />
            <YAxis yAxisId="a" domain={[0, 80]} />
            <YAxis yAxisId="b" orientation="right" domain={[0, 280]} hide />
            <Tooltip formatter={(v: any) => fmt.pct(v)} />
            <ReferenceArea yAxisId="a" x1={firstForecast} x2={series.at(-1).y} fill="var(--soft)" />
            <Line yAxisId="a" dataKey="spending" name="Spending (TME)" stroke="var(--c1)" dot={false} strokeWidth={2} />
            <Line yAxisId="a" dataKey="receipts" name="Receipts" stroke="var(--c2)" dot={false} strokeWidth={2} />
            <Line yAxisId="b" dataKey="debt" name="Net debt (right scale, 0–280%)" stroke="var(--c4)" dot={false} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
        <div className="legend"><span><i style={{ background: "var(--c1)" }} />Spending</span><span><i style={{ background: "var(--c2)" }} />Receipts</span><span><i style={{ background: "var(--c4)" }} />Net debt (own scale, peaks ~250% after WW2)</span></div>
      </Card>
      <Card title={`Where the money goes, ${fn.years[last]}`} sub="Public sector expenditure on services by function, £ billion" source={spend.source}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={fnRows} layout="vertical" margin={{ left: 70, right: 16 }}>
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={150} />
            <Tooltip formatter={(v: any) => `£${v}bn`} />
            <Bar dataKey="v" name="£bn" fill="var(--c1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
    <div className="grid g3" style={{ marginTop: 14 }}>
      <Card title="Largest red-rated major projects" sub="Delivery confidence RED: successful delivery appears unachievable without urgent action" source={mp.source}>
        {red.sort((a, b) => (b.whole_life_cost_m || 0) - (a.whole_life_cost_m || 0)).slice(0, 8).map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--soft)" }}><span><a href={`#/projects/${encodeURIComponent(p.id)}`}>{p.name}</a> <span className="muted">· {p.department}</span></span><b>{fmt.gbp(p.whole_life_cost_m, "m")}</b></div>)}
      </Card>
      <Card title="Charities and NGOs" sub="Registered charities in England and Wales" source={ch.source}>
        <div className="grid g2"><div className="stat"><div className="v">{fmt.n(ch.totals.registered)}</div><div className="l">registered charities</div></div><div className="stat"><div className="v">{fmt.gbp(ch.totals.gov_income)}</div><div className="l">income from government contracts and grants (latest returns)</div></div></div>
        <p className="muted">That is {fmt.pct((ch.totals.gov_income / ch.totals.income) * 100, 0)} of total charity income of {fmt.gbp(ch.totals.income)}. Only {fmt.n(ch.totals.income_bands["£100m+"])} charities have income over £100m.</p>
      </Card>
      <Card title="Public contracts, last 12 months" sub="Award notices on Contracts Finder" source={ct.source}>
        <div className="stat"><div className="v">{fmt.n(ct.n_awards)}</div><div className="l">awards published, {fmt.n(ct.large_awards.length)} worth £1m or more</div></div>
        {ct.suppliers.slice(0, 5).map((s: any) => <div key={s[0]} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>{s[0]}</span><b>{fmt.gbp(s[2])}</b></div>)}
      </Card>
    </div>
  </Page>;
}
