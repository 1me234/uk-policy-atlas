import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useData } from "../lib";
import { Card, Drawer, Loading, Page, Stat, Table } from "../ui";

export default function Charities() {
  const d = useData("charities", "organisations_catalogue");
  const [q, setQ] = useState(""); const [cause, setCause] = useState(""); const [sel, setSel] = useState<any>(null);
  const ch = d ? (d[0] as any) : null;
  const rows = useMemo(() => !ch ? [] : ch.charities.filter((c: any) => (!q || (c.name + " " + c.activities).toLowerCase().includes(q.toLowerCase())) && (!cause || c.causes.includes(cause))), [ch, q, cause]);
  if (!d || !ch) return <Loading />;
  const cat = d[1] as any;
  const causes = Object.entries(ch.by_cause).map(([k, v]: any) => ({ k, ...v, share: v.income ? (v.gov / v.income) * 100 : 0 })).sort((a: any, b: any) => b.income - a.income);
  const govDep = ch.charities.filter((c: any) => c.income > 5e6 && ((c.gov_contracts || 0) + (c.gov_grants || 0)) / c.income > 0.75).length;
  return <Page title="Charities & NGOs" lede="The voluntary sector that delivers a large share of public services: how big it is, which causes it serves, and how dependent each charity is on government money. Think tanks, watchdogs and campaigners that publish policy analysis are catalogued on the Sources page.">
    <div className="grid g4">
      <Stat v={fmt.n(ch.totals.registered)} l="Registered main charities (England & Wales)" />
      <Stat v={fmt.gbp(ch.totals.income)} l="Total latest annual income" />
      <Stat v={fmt.gbp(ch.totals.gov_income)} l="From government contracts and grants" d={fmt.pct((ch.totals.gov_income / ch.totals.income) * 100, 0) + " of income"} />
      <Stat v={govDep} l="Charities over £5m income getting 75%+ from government" d="Effectively outsourced public services" />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Income by cause" sub="A charity can list several causes, so totals overlap. £bn." source={ch.source}>
        <ResponsiveContainer width="100%" height={340}><BarChart data={causes.slice(0, 16)} layout="vertical" margin={{ left: 110 }}><XAxis type="number" tickFormatter={(v) => (v / 1e9).toFixed(0)} /><YAxis type="category" dataKey="k" width={210} tick={{ fontSize: 10 }} /><Tooltip formatter={(v: any) => fmt.gbp(v)} /><Bar dataKey="income" name="Income" fill="var(--c1)" /><Bar dataKey="gov" name="From government" fill="var(--c2)" /></BarChart></ResponsiveContainer>
      </Card>
      <Card title="Charities by size" source={ch.source}>
        <ResponsiveContainer width="100%" height={340}><BarChart data={Object.entries(ch.totals.income_bands).map(([k, v]) => ({ k, v }))}><XAxis dataKey="k" /><YAxis /><Tooltip /><Bar dataKey="v" name="Charities" fill="var(--c3)" /></BarChart></ResponsiveContainer>
      </Card>
    </div>
    <Card title="Charities with income of £1m or more" style={{ marginTop: 14 }} source={ch.source}>
      <div className="controls"><input type="search" placeholder="Search name or activities…" value={q} onChange={(e) => setQ(e.target.value)} /><select value={cause} onChange={(e) => setCause(e.target.value)}><option value="">All causes</option>{causes.map((c: any) => <option key={c.k}>{c.k}</option>)}</select><span className="muted">{fmt.n(rows.length)} charities</span></div>
      <Table rows={rows} initial="inc" onRow={setSel} cols={[
        { k: "n", h: "Charity", v: (c: any) => c.name },
        { k: "inc", h: "Income", n: true, v: (c: any) => c.income, f: (c: any) => fmt.gbp(c.income) },
        { k: "gov", h: "From government", n: true, v: (c: any) => (c.gov_contracts || 0) + (c.gov_grants || 0), f: (c: any) => fmt.gbp((c.gov_contracts || 0) + (c.gov_grants || 0)) },
        { k: "gs", h: "Gov share", n: true, v: (c: any) => c.income ? ((c.gov_contracts || 0) + (c.gov_grants || 0)) / c.income * 100 : null, f: (c: any) => c.income ? fmt.pct(((c.gov_contracts || 0) + (c.gov_grants || 0)) / c.income * 100, 0) : "–" },
        { k: "emp", h: "Staff", n: true, v: (c: any) => c.employees, f: (c: any) => fmt.n(c.employees) },
        { k: "res", h: "Reserves", n: true, v: (c: any) => c.reserves, f: (c: any) => fmt.gbp(c.reserves) },
      ]} />
    </Card>
    {sel && <Drawer onClose={() => setSel(null)}>
      <h2 style={{ fontSize: 20 }}>{sel.name}</h2>
      <div className="muted">Charity {sel.num} · registered {sel.registered}</div>
      <p>{sel.activities}</p>
      <div className="kv"><div>Income</div><div>{fmt.gbp(sel.income)}</div><div>Spending</div><div>{fmt.gbp(sel.spend)}</div><div>Government contracts</div><div>{fmt.gbp(sel.gov_contracts)}</div><div>Government grants</div><div>{fmt.gbp(sel.gov_grants)}</div><div>Employees</div><div>{fmt.n(sel.employees)}</div><div>Volunteers</div><div>{fmt.n(sel.volunteers)}</div><div>Reserves</div><div>{fmt.gbp(sel.reserves)}</div><div>Causes</div><div>{sel.causes.join(", ")}</div></div>
      <a href={`https://register-of-charities.charitycommission.gov.uk/charity-search/-/charity-details/${sel.num}`} target="_blank" rel="noreferrer">Charity Commission register entry</a>{sel.web && <> · <a href={sel.web.startsWith("http") ? sel.web : `https://${sel.web}`} target="_blank" rel="noreferrer">Website</a></>}
    </Drawer>}
    <p className="muted">{cat.organisations.filter((o: any) => o.type === "ngo").length} campaigning NGOs and {cat.organisations.filter((o: any) => o.type === "thinktank").length} think tanks are listed on <a href="#/sources">Sources & catalogue</a>.</p>
  </Page>;
}
