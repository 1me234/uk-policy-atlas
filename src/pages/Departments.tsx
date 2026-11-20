import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Drawer, Loading, Page, Stat, Table } from "../ui";

// Link Civil Service departmental groups to PESA departmental groups and GOV.UK organisation slugs.
const LINKS: [RegExp, string, string][] = [
  [/Health and Social Care/, "Health and Social Care", "department-of-health-and-social-care"],
  [/Department for Education/, "Education", "department-for-education"],
  [/Home Office/, "Home Office", "home-office"],
  [/Ministry of Justice/, "Justice", "ministry-of-justice"],
  [/Attorney General/, "Law Officers' Departments", "attorney-generals-office"],
  [/Ministry of Defence/, "Defence", "ministry-of-defence"],
  [/Foreign, Commonwealth/, "Foreign, Commonwealth and Development Office", "foreign-commonwealth-development-office"],
  [/Housing, Communities/, "MHCLG - Local Government", "ministry-of-housing-communities-local-government"],
  [/Culture, Media/, "Culture, Media and Sport", "department-for-culture-media-and-sport"],
  [/Science, Innovation/, "Science, Innovation and Technology", "department-for-science-innovation-and-technology"],
  [/Department for Transport/, "Transport", "department-for-transport"],
  [/Energy Security/, "Energy Security and Net Zero", "department-for-energy-security-and-net-zero"],
  [/Environment, Food/, "Environment, Food and Rural Affairs", "department-for-environment-food-rural-affairs"],
  [/Business and Trade/, "Business and Trade", "department-for-business-and-trade"],
  [/Work and Pensions/, "Work and Pensions", "department-for-work-pensions"],
  [/HM Revenue/, "HM Revenue and Customs", "hm-revenue-customs"],
  [/HM Treasury/, "HM Treasury", "hm-treasury"],
  [/Cabinet Office/, "Cabinet Office", "cabinet-office"],
  [/Scottish Government/, "Scottish Government", ""],
  [/Welsh Government/, "Welsh Government", ""],
];
export default function Departments() {
  const d = useData("civil_service", "spending", "organisations", "major_projects");
  const [sel, setSel] = useState<any>(null);
  const rows = useMemo(() => {
    if (!d) return [];
    const [cs, sp, orgs, mp] = d as any[];
    const tme = sp.tables.tme_by_department; const adm = sp.tables.admin_budgets;
    const bySlug = Object.fromEntries(orgs.organisations.map((o: any) => [o.id, o]));
    return cs.organisations.filter((o: any) => o.is_total && o.name !== "Overall Civil Service").map((o: any) => {
      const link = LINKS.find(([re]) => re.test(o.name));
      const pesa = link && tme.rows.find((r: any) => r.label.startsWith(link[1]));
      const admin = link && adm.rows.find((r: any) => r.label.startsWith(link[1]));
      const gov = link?.[2] ? bySlug[link[2]] : null;
      const members = cs.organisations.filter((x: any) => x.parent === o.parent && x !== o);
      const london = o.by_region?.London ?? null;
      const scs = o.by_grade?.SCS ?? null;
      const acr = gov?.acronym || "";
      return { ...o, pesa, admin, gov, members, acr, londonPct: london != null && o.headcount ? (london / o.headcount) * 100 : null, scsPct: scs != null && o.headcount ? (scs / o.headcount) * 100 : null,
        projects: mp.projects.filter((p: any) => acr && p.department.toUpperCase() === acr.toUpperCase()) };
    });
  }, [d]);
  if (!d) return <Loading />;
  const [cs, sp, orgs] = d as any[];
  const total = cs.organisations.find((o: any) => o.name === "Overall Civil Service");
  const live = orgs.organisations.filter((o: any) => o.status === "live");
  const byFormat = Object.entries(live.reduce((a: any, o: any) => ((a[o.format] = (a[o.format] || 0) + 1), a), {})).sort((a: any, b: any) => b[1] - a[1]);
  const grades = cs.grades.map((g: string) => ({ g, v: total.by_grade[g] }));
  return <Page title="Departments & civil service" lede="Who runs what: each departmental group's staff, grade mix, where staff are based, pay, budget and the bodies that sit beneath it. Click a department for detail.">
    <div className="grid g4">
      <Stat v={fmt.n(total.headcount)} l="Civil servants (headcount), 31 March 2025" />
      <Stat v={fmt.gbp(total.median_salary)} l="Median civil service salary" />
      <Stat v={fmt.pct((total.by_region.London / total.headcount) * 100, 0)} l="Share of civil servants based in London" />
      <Stat v={fmt.n(live.length)} l="Live organisations listed on GOV.UK" d={`${orgs.organisations.length} including closed bodies`} />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Departmental groups" sub="Sort by any column. Budget is total managed expenditure 2025-26 plans (£m)." source={[cs.source, sp.source]} style={{ gridColumn: "1 / -1" }}>
        <Table rows={rows} initial="hc" onRow={setSel} cols={[
          { k: "name", h: "Department", v: (r: any) => r.name.replace(/ Overall$/, "") },
          { k: "hc", h: "Staff", n: true, v: (r: any) => r.headcount, f: (r: any) => fmt.n(r.headcount) },
          { k: "pay", h: "Median pay", n: true, v: (r: any) => r.median_salary, f: (r: any) => fmt.gbp(r.median_salary) },
          { k: "scs", h: "% senior (SCS)", n: true, v: (r: any) => r.scsPct, f: (r: any) => fmt.pct(r.scsPct) },
          { k: "ldn", h: "% in London", n: true, v: (r: any) => r.londonPct, f: (r: any) => fmt.pct(r.londonPct, 0) },
          { k: "tme", h: "Budget 25-26 (£m)", n: true, v: (r: any) => r.pesa?.values.at(-1), f: (r: any) => fmt.n(r.pesa?.values.at(-1)) },
          { k: "adm", h: "Admin budget (£m)", n: true, v: (r: any) => r.admin?.values.at(-1), f: (r: any) => fmt.n(r.admin?.values.at(-1)) },
          { k: "bods", h: "Bodies beneath", n: true, v: (r: any) => r.gov?.children.length, f: (r: any) => r.gov ? r.gov.children.length : "–" },
          { k: "mp", h: "Major projects", n: true, v: (r: any) => r.projects.length },
        ]} />
      </Card>
      <Card title="Grade mix, whole civil service" sub="Headcount by responsibility level" source={cs.source}>
        <ResponsiveContainer width="100%" height={220}><BarChart data={grades}><XAxis dataKey="g" /><YAxis /><Tooltip formatter={(v: any) => fmt.n(v)} /><Bar dataKey="v" fill="var(--c1)" /></BarChart></ResponsiveContainer>
      </Card>
      <Card title="Types of public body (live)" sub="GOV.UK organisation register" source={orgs.source}>
        {byFormat.slice(0, 10).map(([k, v]: any) => <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 50px", gap: 8, padding: "3px 0" }}><span>{k}</span><b style={{ textAlign: "right" }}>{v}</b></div>)}
      </Card>
    </div>
    {sel && <Drawer onClose={() => setSel(null)}>
      <h2 style={{ fontSize: 20 }}>{sel.name.replace(/ Overall$/, "")}</h2>
      {sel.gov && <a href={sel.gov.url} target="_blank" rel="noreferrer">GOV.UK page</a>}
      <div className="kv">
        <div>Staff</div><div>{fmt.n(sel.headcount)}</div>
        <div>Median salary</div><div>{fmt.gbp(sel.median_salary)}</div>
        <div>Budget (TME)</div><div>{sel.pesa ? sp.tables.tme_by_department.years.map((y: string, i: number) => `${y}: ${fmt.gbp(sel.pesa.values[i], "m")}`).join(" · ") : "Not matched"}</div>
        <div>Spend per staff member</div><div>{sel.pesa ? fmt.gbp((sel.pesa.values.at(-1) * 1e6) / sel.headcount) : "–"} <span className="muted">(most spend is grants and transfers, not running costs)</span></div>
      </div>
      <h3>Grade mix</h3>
      {cs.grades.map((g: string) => <div key={g} style={{ display: "grid", gridTemplateColumns: "90px 1fr 60px", gap: 8, alignItems: "center", fontSize: 12.5 }}><span>{g}</span><div className="bar"><span style={{ width: `${((sel.by_grade[g] || 0) / sel.headcount) * 100}%` }} /></div><span style={{ textAlign: "right" }}>{fmt.n(sel.by_grade[g])}</span></div>)}
      <h3 style={{ marginTop: 14 }}>Where staff are based</h3>
      {Object.entries(sel.by_region || {}).filter(([, v]: any) => v).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: any) => <div key={k} style={{ display: "grid", gridTemplateColumns: "150px 1fr 60px", gap: 8, alignItems: "center", fontSize: 12.5 }}><span>{k}</span><div className="bar"><span style={{ width: `${(v / sel.headcount) * 100}%`, background: "var(--c3)" }} /></div><span style={{ textAlign: "right" }}>{fmt.n(v)}</span></div>)}
      {sel.members.length > 0 && <><h3 style={{ marginTop: 14 }}>Organisations in this group (civil service staff)</h3>
        <table><tbody>{sel.members.sort((a: any, b: any) => (b.headcount || 0) - (a.headcount || 0)).map((m: any) => <tr key={m.name}><td>{m.name}</td><td className="n">{fmt.n(m.headcount)}</td><td className="n">{fmt.gbp(m.median_salary)}</td></tr>)}</tbody></table></>}
      {sel.projects.length > 0 && <><h3 style={{ marginTop: 14 }}>Major projects</h3>{sel.projects.map((p: any) => <div key={p.id}><a href={`#/projects/${encodeURIComponent(p.id)}`}>{p.name}</a> <span className="muted">{p.dca_nista || p.dca_sro} · {fmt.gbp(p.whole_life_cost_m, "m")}</span></div>)}</>}
      {sel.gov?.children.length > 0 && <><h3 style={{ marginTop: 14 }}>Bodies listed under it on GOV.UK</h3><div className="muted" style={{ fontSize: 12.5 }}>{sel.gov.children.map((c: string) => c.replace(/-/g, " ")).join(" · ")}</div></>}
    </Drawer>}
  </Page>;
}
