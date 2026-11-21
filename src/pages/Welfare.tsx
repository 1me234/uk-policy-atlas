import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS, fmt, useData } from "../lib";
import { Card, Loading, Page, Seg, Stat, Table } from "../ui";

export default function Welfare() {
  const d = useData("welfare");
  const [view, setView] = useState<"real" | "gdp">("real");
  const [pick, setPick] = useState<string>("Universal Credit");
  const m = useMemo(() => {
    if (!d) return null;
    const w = d[0] as any; const S = w.sheets;
    const sum = S["Benefit summary table"];
    const sec = (re: RegExp) => sum.series.filter((s: any) => re.test(s.section.replace(/\s+/g, " ")) && !/consistent/.test(s.section));
    const real = sec(/real terms/), gdp = sec(/Gross Domestic Product/);
    const years: string[] = sum.years; const firstF = years[sum.status.indexOf("Forecast")];
    const mk = (rows: any[], scale = 1) => years.map((y, i) => Object.fromEntries([["y", y], ...rows.filter((r) => ["Children", "Working age", "Pensioners"].includes(r.label)).map((r) => [r.label, r.values[i] == null ? null : +(r.values[i] * scale).toFixed(3)])]));
    const t1b = S["Table 1b"]; // real terms £m by benefit
    const t1c = S["Table 1c"]; // caseloads
    const ben = t1b.series.filter((s: any) => !/^of which/i.test(s.label) && !/total/i.test(s.label));
    const lastOut = years.indexOf(firstF) - 1;
    const idx = (y: string) => t1b.years.indexOf(y);
    const rows = ben.map((b: any) => { const c = t1c.series.find((s: any) => s.label === b.label); const v = b.values[idx(years[lastOut])], v10 = b.values[idx("2010/11")], vf = b.values.at(-1);
      return { label: b.label, now: v, v10, f: vf, cases: c?.values[t1c.years.indexOf(years[lastOut])] ?? null, series: b.values, cs: c?.values }; }).filter((r: any) => (r.now || 0) > 50 || (r.f || 0) > 50);
    return { w, real: mk(real), gdp: mk(gdp, 100), firstF, lastOutYear: years[lastOut], rows, t1b, t1c, total: real.find((r: any) => r.label === "Total")?.values[lastOut] };
  }, [d]);
  if (!d || !m) return <Loading />;
  const sel = m.rows.find((r: any) => r.label.startsWith(pick)) || m.rows[0];
  const selSeries = m.t1b.years.map((y: string, i: number) => ({ y, spend: sel.series[i] != null ? sel.series[i] / 1000 : null, cases: sel.cs?.[i] ?? null })).filter((x: any) => x.y >= "1980/81");
  return <Page title="Social security" lede="Benefit spending in Great Britain from 1948 to the latest DWP forecast: who it goes to, which benefits are growing, and how many people claim each. Pensioners take the majority; working-age health and disability benefits are the fastest-growing part.">
    <div className="grid g4">
      <Stat v={fmt.gbp(m.total, "bn")} l={`DWP benefit spending ${m.lastOutYear}, real terms (2026/27 prices)`} />
      {["Pensioners", "Working age", "Children"].map((g) => <Stat key={g} v={fmt.gbp(m.real.find((r: any) => r.y === m.lastOutYear)?.[g], "bn")} l={`${g}, ${m.lastOutYear}`} d={`Forecast ${m.real.at(-1).y}: ${fmt.gbp(m.real.at(-1)[g], "bn")}`} />)}
    </div>
    <Card title="Benefit spending since 1948" sub={<Seg opts={[["real", "£bn, 2026/27 prices"], ["gdp", "% of GDP"]]} v={view} set={setView} />} style={{ marginTop: 14 }} source={m.w.source}>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={view === "real" ? m.real : m.gdp} margin={{ left: -10 }}>
          <CartesianGrid vertical={false} /><XAxis dataKey="y" interval={7} /><YAxis />
          <Tooltip formatter={(v: any) => view === "real" ? `£${fmt.n(v, 1)}bn` : `${fmt.n(v, 2)}%`} /><Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceArea x1={m.firstF} x2={m.real.at(-1).y} fill="var(--soft)" />
          {["Pensioners", "Working age", "Children"].map((k, i) => <Area key={k} dataKey={k} stackId="1" stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.7} />)}
        </AreaChart>
      </ResponsiveContainer>
      <div className="muted" style={{ fontSize: 12 }}>Shaded: forecast. Child Benefit and tax credits moved to HMRC and are outside DWP coverage for most of this period.</div>
    </Card>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Each benefit" sub={`Real terms £m (2026/27 prices). Click a row to chart it.`} source={m.w.source}>
        <Table rows={m.rows} initial="now" onRow={(r: any) => setPick(r.label)} cols={[
          { k: "l", h: "Benefit", v: (r: any) => r.label },
          { k: "now", h: m.lastOutYear, n: true, v: (r: any) => r.now, f: (r: any) => fmt.n(r.now) },
          { k: "g", h: "vs 2010/11", n: true, v: (r: any) => r.v10 ? (r.now / r.v10 - 1) * 100 : null, f: (r: any) => r.v10 ? fmt.pct((r.now / r.v10 - 1) * 100, 0) : "–" },
          { k: "f", h: "Forecast " + m.t1b.years.at(-1), n: true, v: (r: any) => r.f, f: (r: any) => fmt.n(r.f) },
          { k: "c", h: "Caseload (000s)", n: true, v: (r: any) => r.cases, f: (r: any) => fmt.n(r.cases) },
        ]} />
      </Card>
      <Card title={sel.label} sub="Spending (£bn, real) and caseload (thousands) since 1980/81" source={m.w.source}>
        <ResponsiveContainer width="100%" height={320}><LineChart data={selSeries}><CartesianGrid vertical={false} /><XAxis dataKey="y" interval={6} /><YAxis yAxisId="a" /><YAxis yAxisId="b" orientation="right" /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceArea yAxisId="a" x1={m.firstF} x2={selSeries.at(-1).y} fill="var(--soft)" /><Line yAxisId="a" dataKey="spend" name="£bn real" stroke="var(--c1)" dot={false} strokeWidth={2} /><Line yAxisId="b" dataKey="cases" name="Caseload (000s)" stroke="var(--c2)" dot={false} /></LineChart></ResponsiveContainer>
      </Card>
    </div>
  </Page>;
}
