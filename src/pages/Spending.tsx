import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS, fmt, useData } from "../lib";
import { Card, Loading, Page, Seg, Table } from "../ui";

export default function Spending() {
  const d = useData("spending", "fiscal");
  const [mode, setMode] = useState<"by_function" | "by_function_real" | "by_function_pct_gdp">("by_function_pct_gdp");
  const [tax, setTax] = useState(false);
  if (!d) return <Loading />;
  const [sp, fiscal] = d as any[];
  const T = sp.tables;
  const fn = T[mode];
  const groups = fn.rows.filter((r: any) => /^\d+\./.test(r.label));
  const fnSeries = fn.years.map((y: string, i: number) => Object.fromEntries([["y", y], ...groups.map((g: any) => [g.label.replace(/^\d+\.\s*/, "").replace(/\s*\(.*$/, ""), g.values[i]])]));
  const keys = groups.map((g: any) => g.label.replace(/^\d+\.\s*/, "").replace(/\s*\(.*$/, ""));
  const dep = T.tme_by_department;
  const depRows = dep.rows.filter((r: any) => r.values && !/Total|Accounting|Reserves|allowance|Adjustment|Fund|gross debt|depreciation|Locally|transfers|own-fin/i.test(r.label));
  const rd = fiscal.receipts_bn;
  const taxes = Object.keys(rd.series).filter((k) => !/total|current receipts/i.test(k));
  const latestIdx = rd.years.indexOf("2025-26");
  const taxRows = taxes.map((k) => ({ name: k, v: rd.series[k][latestIdx] })).filter((x) => x.v && x.v > 3).sort((a, b) => b.v - a.v);
  const sub = T.by_subfunction;
  const lr = T.aggregates_long_run.series;
  return <Page title="Spending & fiscal" lede="How much the state spends, on what, by which department, and how it is paid for. PESA is the Treasury's own breakdown; OBR supplies the long run and the forecasts.">
    <Card title="Spending by function since 2002-03" sub={<Seg opts={[["by_function_pct_gdp", "% of GDP"], ["by_function_real", "Real terms £bn (2024-25 prices)"], ["by_function", "Cash £bn"]]} v={mode} set={setMode} />} source={sp.source}>
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={fnSeries} margin={{ left: -10 }}>
          <CartesianGrid vertical={false} /><XAxis dataKey="y" interval={3} /><YAxis />
          <Tooltip formatter={(v: any) => mode === "by_function_pct_gdp" ? fmt.pct(v) : `£${fmt.n(v, 1)}bn`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {keys.map((k: string, i: number) => <Area key={k} dataKey={k} stackId="1" stroke={COLORS[i % 8]} fill={COLORS[i % 8]} fillOpacity={0.75} />)}
        </AreaChart>
      </ResponsiveContainer>
    </Card>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Total managed expenditure by department" sub="£ million, 2020-21 to 2025-26 (plans). Click a column to sort." source={sp.source}>
        <Table rows={depRows} initial="v5" cols={[{ k: "l", h: "Department", v: (r: any) => r.label }, ...dep.years.map((y: string, i: number) => ({ k: `v${i}`, h: y, n: true, v: (r: any) => r.values[i], f: (r: any) => fmt.n(r.values[i]) }))]} />
      </Card>
      <Card title={tax ? "Receipts by tax, 2025-26 (£bn)" : "Investment vs current spending since 1982-83"} sub={<Seg opts={[["0", "Investment"], ["1", "Taxes"]]} v={tax ? "1" : "0"} set={(x) => setTax(x === "1")} />} source={tax ? fiscal.source : sp.source}>
        {tax ? <ResponsiveContainer width="100%" height={330}><BarChart data={taxRows.slice(0, 16)} layout="vertical" margin={{ left: 120 }}><XAxis type="number" /><YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="v" fill="var(--c2)" name="£bn" /></BarChart></ResponsiveContainer>
          : <ResponsiveContainer width="100%" height={330}><LineChart data={lr} margin={{ left: -10 }}><CartesianGrid vertical={false} /><XAxis dataKey="year" interval={6} /><YAxis yAxisId="a" /><YAxis yAxisId="b" orientation="right" /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Line yAxisId="a" dataKey="psce_pct_gdp" name="Current spending % GDP" stroke="var(--c1)" dot={false} /><Line yAxisId="b" dataKey="psni_pct_gdp" name="Net investment % GDP (right)" stroke="var(--c4)" dot={false} /></LineChart></ResponsiveContainer>}
      </Card>
    </div>
    <Card title="Spending by sub-function (COFOG)" sub="£ million. The finest public breakdown of what money is spent on across all of the public sector." source={sp.source} style={{ marginTop: 14 }}>
      <Table rows={sub.rows.filter((r: any) => r.values)} initial={`v${sub.years.length - 1}`} cols={[{ k: "l", h: "Sub-function", v: (r: any) => r.label }, ...sub.years.map((y: string, i: number) => ({ k: `v${i}`, h: y, n: true, v: (r: any) => r.values[i], f: (r: any) => fmt.n(r.values[i]) })), { k: "g", h: "Change since 2020-21", n: true, v: (r: any) => r.values[0] ? (r.values.at(-1) / r.values[0] - 1) * 100 : null, f: (r: any) => r.values[0] ? fmt.pct((r.values.at(-1) / r.values[0] - 1) * 100, 0) : "–" }]} />
    </Card>
  </Page>;
}
