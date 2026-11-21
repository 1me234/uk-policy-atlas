import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Loading, Page, Pill, Stat, Table } from "../ui";

export default function Foreign() {
  const d = useData("spending", "major_projects", "civil_service", "contracts", "oda");
  if (!d) return <Loading />;
  const [sp, mp, cs, ct, oda] = d as any[];
  const Y = oda.years, L = Y.length - 1;
  const deptTop = oda.by_department.slice(0, 5);
  const deptSeries = Y.map((y: number, i: number) => Object.fromEntries([["y", y], ...deptTop.map((r: any) => [r.label, r.values[i]]), ["Other", oda.by_department.slice(5).reduce((a: number, r: any) => a + r.values[i], 0)]]));
  const idrc = oda.by_sector.find((r: any) => r.label === "Refugees in Donor Countries");
  const ho = oda.by_department.find((r: any) => r.label === "Home Office");
  const odaRow = (cols: string) => [{ k: "l", h: cols, v: (r: any) => r.label }, { k: "a", h: String(Y[0]), n: true, v: (r: any) => r.values[0], f: (r: any) => fmt.gbp(r.values[0], "m") }, { k: "b", h: String(Y[L]), n: true, v: (r: any) => r.values[L], f: (r: any) => fmt.gbp(r.values[L], "m") }, { k: "c", h: "Change", n: true, v: (r: any) => r.values[L] - r.values[0], f: (r: any) => { const c = r.values[L] - r.values[0]; return <span style={{ color: c < 0 ? "var(--red)" : "var(--green)" }}>{c > 0 ? "+" : ""}{fmt.gbp(c, "m")}</span>; } }];
  const T = sp.tables;
  const pick = (t: any, re: RegExp) => t.rows.find((r: any) => re.test(r.label));
  const fnP = T.by_function_pct_gdp, fnR = T.by_function_real;
  const defP = pick(fnP, /^2\. Defence/), intP = pick(fnP, /international serv/);
  const series = fnP.years.map((y: string, i: number) => ({ y, defence: defP?.values[i], international: intP?.values[i] }));
  const sub = T.by_subfunction.rows.filter((r: any) => r.values && (/^2\.\d/.test(r.label) || /^1\.2 /.test(r.label) || /international|foreign/i.test(r.label)));
  const projects = mp.projects.filter((p: any) => ["MOD", "FCDO"].includes(p.department));
  const fcdo = cs.organisations.find((o: any) => /Foreign, Commonwealth.*Overall/.test(o.name)), mod = cs.organisations.find((o: any) => /Ministry of Defence Overall/.test(o.name));
  const tme = T.tme_by_department;
  const defT = pick(tme, /^Defence/), fcdoT = pick(tme, /^Foreign/), sia = pick(tme, /Single Intelligence/);
  const buyers = ct.buyers.filter((b: any) => /Defence|MOD|DE&S|Defence Equipment|Foreign|FCDO|Ministry of Defence|Dstl/i.test(b[0]));
  return <Page title="Foreign affairs & defence" lede="What the UK spends abroad and on security: the FCDO (diplomacy and aid), defence, and the intelligence agencies, plus the military capability programmes in the major projects portfolio.">
    <div className="grid g4">
      <Stat v={fmt.gbp(defT?.values.at(-1), "m")} l="Defence total spending, 2025-26 plans" />
      <Stat v={fmt.gbp(fcdoT?.values.at(-1), "m")} l="FCDO total spending, 2025-26 plans" />
      <Stat v={fmt.gbp(sia?.values.at(-1), "m")} l="Single Intelligence Account, 2025-26" />
      <Stat v={projects.length} l="MOD and FCDO major projects" d={`${projects.filter((p: any) => (p.dca_nista || p.dca_sro) === "RED").length} red · whole-life ${fmt.gbp(projects.reduce((a: number, p: any) => a + (p.whole_life_cost_m || 0), 0), "m")} (where disclosed)`} />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Defence and international services, % of GDP" sub="PESA functional classification (international services includes aid and diplomacy)" source={sp.source}>
        <ResponsiveContainer width="100%" height={260}><LineChart data={series}><CartesianGrid vertical={false} /><XAxis dataKey="y" interval={3} /><YAxis /><Tooltip formatter={(v: any) => fmt.pct(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="defence" name="Defence" stroke="var(--c1)" strokeWidth={2} dot={false} /><Line dataKey="international" name="International services" stroke="var(--c2)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </Card>
      <Card title="Sub-functions (£m)" source={sp.source}>
        <table><thead><tr><th>Line</th>{[0, T.by_subfunction.years.length - 1].map((i) => <th key={i} className="n">{T.by_subfunction.years[i]}</th>)}</tr></thead><tbody>{sub.map((r: any) => <tr key={r.label}><td>{r.label}</td><td className="n">{fmt.n(r.values[0])}</td><td className="n">{fmt.n(r.values.at(-1))}</td></tr>)}</tbody></table>
        <p className="muted" style={{ fontSize: 12.5 }}>FCDO: {fmt.n(fcdo?.headcount)} civil servants ({fmt.n(fcdo?.by_region?.Overseas)} based overseas). MOD: {fmt.n(mod?.headcount)} civil servants (armed forces not included).</p>
      </Card>
    </div>
    <h2 style={{ marginTop: 26 }}>UK aid</h2>
    <div className="grid g4">
      <Stat v={fmt.gbp(oda.headline.total_m, "m")} l={`Official development assistance, ${oda.headline.year}`} d={`${oda.headline.gni_pct}% of national income; UN target is 0.7%`} />
      <Stat v={fmt.gbp(idrc?.values[L], "m")} l={`Spent in the UK on asylum seekers and refugees, ${Y[L]}`} color="var(--amber)" d={`${fmt.pct((idrc?.values[L] / oda.headline.total_m) * 100, 0)} of all aid; ${fmt.gbp(idrc?.values[0], "m")} in ${Y[0]}`} />
      <Stat v={fmt.gbp(ho?.values[L], "m")} l="Aid spent by the Home Office" d={`${fmt.gbp(ho?.values[0], "m")} in ${Y[0]}`} />
      <Stat v={oda.by_department.filter((r: any) => r.values[L] > 0).length} l="Departments and funds spending aid" />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Who spends UK aid" sub="£ million by spending department, project-level data" source={oda.source}>
        <ResponsiveContainer width="100%" height={280}><AreaChart data={deptSeries}><CartesianGrid vertical={false} /><XAxis dataKey="y" /><YAxis tickFormatter={(v: number) => fmt.n(v)} /><Tooltip formatter={(v: any) => fmt.gbp(v, "m")} /><Legend wrapperStyle={{ fontSize: 11 }} />{[...deptTop.map((r: any) => r.label), "Other"].map((k: string, i: number) => <Area key={k} dataKey={k} name={k.replace("Foreign Commonwealth & Development Office", "FCDO").replace("Department for ", "").replace("Department of ", "")} stackId="1" stroke={`var(--c${i + 1})`} fill={`var(--c${i + 1})`} fillOpacity={0.75} />)}</AreaChart></ResponsiveContainer>
        <p className="muted" style={{ fontSize: 12 }}>The project-level file covers {fmt.gbp(oda.total[L], "m")} of the {fmt.gbp(oda.headline.total_m, "m")} headline for {Y[L]}; the rest is not broken down there.</p>
      </Card>
      <Card title="What it is spent on" sub="Broad sector" source={oda.source}>
        <Table rows={oda.by_sector} initial="b" cols={odaRow("Sector")} />
      </Card>
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Where it goes" sub="Recipient country or region (top 80)" source={oda.source}>
        <Table rows={oda.by_country} initial="b" cols={odaRow("Recipient")} max={80} />
      </Card>
      <Card title={`Largest aid projects, ${Y[L]}`} source={oda.source}>
        <Table rows={oda.top_projects} initial="v" cols={[{ k: "t", h: "Project", v: (p: any) => p.title, f: (p: any) => <><div>{p.title}</div><div className="muted" style={{ fontSize: 12 }}>{p.country} · {p.sector} · {p.department.replace("Foreign Commonwealth & Development Office", "FCDO")}</div></> }, { k: "v", h: "£m", n: true, v: (p: any) => p.value_m, f: (p: any) => fmt.n(p.value_m) }]} max={150} />
      </Card>
    </div>
    <h2 style={{ marginTop: 26 }}>Defence and diplomacy</h2>
    <Card title="Military and FCDO major projects" style={{ marginTop: 14 }} source={mp.source}>
      <Table rows={projects} initial="wlc" onRow={(p: any) => (location.hash = `#/projects/${encodeURIComponent(p.id)}`)} cols={[{ k: "n", h: "Project", v: (p: any) => p.name }, { k: "d", h: "Dept", v: (p: any) => p.department }, { k: "r", h: "Rating", v: (p: any) => p.dca_nista || p.dca_sro, f: (p: any) => <Pill v={p.dca_nista || p.dca_sro} /> }, { k: "wlc", h: "Whole-life cost", n: true, v: (p: any) => p.whole_life_cost_m, f: (p: any) => fmt.gbp(p.whole_life_cost_m, "m") }]} />
    </Card>
    <Card title="Defence and FCDO buyers on Contracts Finder" style={{ marginTop: 14 }} source={ct.source}>
      <Table rows={buyers} initial="v" cols={[{ k: "b", h: "Buyer", v: (b: any) => b[0] }, { k: "n", h: "Awards", n: true, v: (b: any) => b[1] }, { k: "v", h: "Value", n: true, v: (b: any) => b[2], f: (b: any) => fmt.gbp(b[2]) }]} />
    </Card>
    <div className="flag gap" style={{ marginTop: 14 }}>Not yet ingested: the IATI aid register (project results), NATO defence expenditure returns, and MOD's equipment plan. They are listed on the Sources page.</div>
  </Page>;
}
