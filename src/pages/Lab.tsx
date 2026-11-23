import React, { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "../lib";
import { Card, Page, Seg } from "../ui";
import { ReorgLab, StructureLab } from "./LabReorg";
import { CP, CycleParams, defaultCycleParams, Dist, monteCarlo, Route, sensitivity, STAGES } from "../lab/cycle";

const PRESETS: { name: string; note: string; p: Partial<CycleParams>; route?: Route }[] = [
  { name: "Central assumptions", note: "The defaults: middling values where evidence is thin.", p: {} },
  { name: "Best case for the cycle", note: "Most staff relocate, little IP leaves the country, foreign buyers keep paying a premium, the courts uphold seizure, no retaliation.", route: "statute", p: { talent: 75, offshore0: 0, offshoreLearn: 3, premium0: 150, premiumLearn: 5, pLegal: 5, pRetal: 5, eta: 90, iota: 90, kappa: 15, threat: 90, multiplier: 2, transfer: 30 } },
  { name: "Grok's objections", note: "Champions and firms move their crown jewels abroad ahead of time, senior staff will not move, foreign governments retaliate, and investors anticipate the cycle.", route: "statute", p: { talent: 15, offshore0: 30, offshoreLearn: 25, pRetal: 70, retalCost: 40, kappa: 90, pLegal: 40, premiumLearn: 35 } },
  { name: "Crash induced by the state", note: "Central assumptions, but the state helps trigger the crash.", p: { induced: 1 } },
];
const METRICS = [["net", "Net cash to the state"], ["natCap", "National capability"], ["capability", "Champion capability"], ["jobs", "Jobs in lagging regions"]] as const;
type Metric = (typeof METRICS)[number][0];
const SENS_IDS = ["talent", "offshore0", "offshoreLearn", "premium0", "premiumLearn", "strategic", "statPrice", "insolPrice", "pLegal", "pRetal", "retalCost", "kappa", "eta", "iota", "opex", "relocCost", "decay", "threat", "transfer", "alpha"];

const gbp = (v: number) => `${v < 0 ? "−" : ""}£${Math.abs(v).toFixed(1)}bn`;
const show = (m: Metric, v: number) => m === "jobs" ? fmt.n(v) : m === "net" ? gbp(v) : v.toFixed(0);
const D = ({ d, m }: { d: Dist; m: Metric }) => <><b>{show(m, d.p50)}</b><div className="muted" style={{ fontSize: 11.5 }}>{show(m, d.p10)} to {show(m, d.p90)}</div></>;

function CycleLab() {
  const [P, setP] = useState<CycleParams>(defaultCycleParams);
  const [route, setRoute] = useState<Route>("statute");
  const [stage, setStage] = useState("seize");
  const [metric, setMetric] = useState<Metric>("net");
  const [sens, setSens] = useState<ReturnType<typeof sensitivity> | null>(null);
  const [preset, setPreset] = useState(0);
  const cyc = useMemo(() => monteCarlo(P, route, "cycle"), [P, route]);
  const lf = useMemo(() => monteCarlo(P, route, "laissez"), [P, route]);
  const dir = useMemo(() => monteCarlo(P, route, "directed"), [P, route]);
  const c1 = cyc.perCycle[0];
  const setv = (id: string, v: number) => { setP((x) => ({ ...x, [id]: v })); setSens(null); };
  const stageVal: Record<string, string> = {
    boom: `${gbp(c1.invest.p50)} invested in year 1`, consolidate: `${gbp(c1.failedK.p50)} of capital fails`, seize: `${gbp(c1.acq.p50)} paid`, triage: `${gbp(c1.sales.p50)} of sales`,
    relocate: `${fmt.n(cyc.perCycle[0].jobs.p50)} jobs`, specialise: `${gbp(c1.kept.p50)} kept`, reintegrate: `champion ${c1.capability.p50.toFixed(0)}`, repeat: `investment ×${cyc.investDrop.p50.toFixed(2)} by last sector`,
  };
  const per = cyc.perCycle.map((c, i) => ({ c: `Sector ${c.c}`, invest: +c.invest.p50.toFixed(2), investLf: +lf.perCycle[i].invest.p50.toFixed(2), net: +c.net.p50.toFixed(2), premium: +(c.premium.p50 * 100).toFixed(0), offshored: +c.offshored.p50.toFixed(2), cap: +c.natCap.p50.toFixed(1), capLf: +lf.perCycle[i].natCap.p50.toFixed(1), capDir: +dir.perCycle[i].natCap.p50.toFixed(1) }));

  return <>
    <Card title="Bubble, seizure and reintegration cycle" sub="Your proposal: let private capital race in a new sector until one champion dominates and the rest fail, take the failed firms' assets, sell the non-strategic part abroad, move the rest to a lagging region, repurpose it for a narrow state use, hand it to the champion, and repeat in the next sector. The legal, talent-flight, retaliation and anticipation risks raised against it are all variables here.">
      <div className="stages">{STAGES.map((s) => <button key={s.id} className={`stage ${stage === s.id ? "on" : ""}`} onClick={() => setStage(s.id)} title={s.d}>
        <span className="stage-n">{s.n}</span><span className="stage-t">{s.t}</span><span className="stage-v">{stageVal[s.id]}</span></button>)}</div>
      <div className="muted" style={{ fontSize: 12 }}>Medians across 400 runs, first sector, for the cycle under the chosen seizure route. Click a stage to edit its parameters.</div>
    </Card>

    <div className="sim" style={{ marginTop: 14 }}>
      <aside className="card sim-levers">
        <h3>Assumptions</h3>
        <select value={preset} onChange={(e) => { const i = +e.target.value, p = PRESETS[i]; setPreset(i); setP({ ...defaultCycleParams(), ...p.p } as CycleParams); if (p.route) setRoute(p.route); setSens(null); }} style={{ width: "100%", marginTop: 6 }}>{PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}</select>
        <div className="muted" style={{ fontSize: 12, margin: "6px 0 10px" }}>{PRESETS[preset].note}</div>
        <div className="nav-group" style={{ padding: "4px 0" }}>Seizure route</div>
        <Seg v={route} set={(v) => { setRoute(v); setSens(null); }} opts={[["insolvency", "Insolvency purchase"], ["statute", "Statutory acquisition"]]} />
        <div className="nav-group" style={{ padding: "12px 0 2px" }}>Stage {STAGES.find((s) => s.id === stage)!.n}: {STAGES.find((s) => s.id === stage)!.t}</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{STAGES.find((s) => s.id === stage)!.d}</div>
        {CP.filter((p) => p.stage === stage).map((p) => <div key={p.id} className={`lever ${P[p.id] !== defaultCycleParams()[p.id] ? "on" : ""}`}>
          <div className="lever-head"><span>{p.label}</span><span className="lever-v">{p.unit === "£bn" ? `£${P[p.id]}bn` : `${P[p.id]}${p.unit && p.unit !== "£bn" ? (p.unit.startsWith("%") ? "%" : ` ${p.unit}`) : ""}`}</span></div>
          <input type="range" min={p.min} max={p.max} step={p.step} value={P[p.id]} onChange={(e) => setv(p.id, +e.target.value)} aria-label={p.label} />
          {p.note && <div className="muted" style={{ fontSize: 11.5 }}>{p.note}</div>}
        </div>)}
        <div className="controls" style={{ marginTop: 10 }}>{STAGES.map((s) => <button key={s.id} className={`seg ${stage === s.id ? "on" : ""}`} style={{ padding: "3px 8px" }} onClick={() => setStage(s.id)}>{s.n}</button>)}</div>
        <button className="seg" onClick={() => { setP(defaultCycleParams()); setPreset(0); setSens(null); }}>Reset all</button>
      </aside>

      <div className="sim-out">
        <Card title="Outcome against the alternatives" sub={`Totals over ${P.cycles} sectors. Bold is the median of 400 runs; below it, the 10th to 90th percentile range. Capability is an index in £bn of productive capital.`}>
          <div className="scroll"><table><thead><tr><th></th><th className="n">This cycle ({route === "statute" ? "statutory" : "insolvency"})</th><th className="n">Laissez-faire</th><th className="n">Directed consolidation</th></tr></thead><tbody>
            {METRICS.map(([k, l]) => <tr key={k}><td>{l}{k === "net" && <div className="muted" style={{ fontSize: 11.5 }}>Sales and transfer fees, minus purchase, legal, relocation, running, crash and retaliation costs.</div>}{k === "natCap" && <div className="muted" style={{ fontSize: 11.5 }}>Champion, surviving firms and redeployed assets that stay in the UK.</div>}</td>
              <td className="n"><D d={cyc[k]} m={k} /></td><td className="n"><D d={lf[k]} m={k} /></td><td className="n"><D d={dir[k]} m={k} /></td></tr>)}
            <tr><td>Private investment in the last sector, relative to the first</td><td className="n">×{cyc.investDrop.p50.toFixed(2)}</td><td className="n">×{lf.investDrop.p50.toFixed(2)}</td><td className="n">×{dir.investDrop.p50.toFixed(2)}</td></tr>
            <tr><td>Chance the state ends up cash-positive</td><td className="n">{fmt.pct(cyc.pNetPositive * 100, 0)}</td><td className="n">–</td><td className="n">{fmt.pct(dir.pNetPositive * 100, 0)}</td></tr>
          </tbody></table></div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Laissez-faire: the same booms and crashes, but failed firms go through ordinary insolvency and the market redeploys what it can. Directed consolidation: the weaker firms are merged into the champion at the peak with compensation, with no crash and no resale. This is roughly the Chinese pattern the critique describes.</div>
        </Card>

        <div className="grid g2" style={{ marginTop: 14 }}>
          <Card title="Sector by sector" sub="Median private investment in year 1 of each boom (£bn). Anticipation lowers it under the cycle.">
            <ResponsiveContainer width="100%" height={220}><LineChart data={per} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="c" /><YAxis /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="invest" name="Cycle" stroke="var(--c1)" strokeWidth={2} dot /><Line dataKey="investLf" name="Laissez-faire" stroke="var(--muted)" strokeDasharray="4 4" dot={false} /></LineChart></ResponsiveContainer>
          </Card>
          <Card title="Learning by the other side" sub="Foreign buyers' price as a % of asset value, and £bn of IP moved offshore before seizure (medians).">
            <ResponsiveContainer width="100%" height={220}><LineChart data={per} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="c" /><YAxis yAxisId="a" /><YAxis yAxisId="b" orientation="right" /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine yAxisId="a" y={100} stroke="var(--line)" /><Line yAxisId="a" dataKey="premium" name="Foreign price %" stroke="var(--c2)" strokeWidth={2} /><Line yAxisId="b" dataKey="offshored" name="Offshored £bn (right)" stroke="var(--c4)" strokeWidth={2} /></LineChart></ResponsiveContainer>
          </Card>
          <Card title="National capability over time" sub="Cumulative index (£bn of productive capital kept in the UK), medians.">
            <ResponsiveContainer width="100%" height={220}><LineChart data={per} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="c" /><YAxis /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="cap" name="Cycle" stroke="var(--c1)" strokeWidth={2} /><Line dataKey="capLf" name="Laissez-faire" stroke="var(--muted)" strokeDasharray="4 4" /><Line dataKey="capDir" name="Directed" stroke="var(--c3)" strokeDasharray="2 3" /></LineChart></ResponsiveContainer>
          </Card>
          <Card title="Cash to the state, each sector" sub="£bn, median.">
            <ResponsiveContainer width="100%" height={220}><BarChart data={per} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="c" /><YAxis domain={[(m: number) => Math.min(0, m), (m: number) => Math.max(0, m)]} /><Tooltip /><ReferenceLine y={0} stroke="var(--muted)" /><Bar dataKey="net" name="Net £bn" fill="var(--c1)" /></BarChart></ResponsiveContainer>
          </Card>
        </div>

        <Card title="What decides the result" sub="Each assumption moved to half and then one and a half times its current value, one at a time. Bars show the change in the median against the current settings; the longest bars are what the idea depends on." style={{ marginTop: 14 }}>
          <div className="controls"><Seg v={metric} set={(m) => { setMetric(m); setSens(null); }} opts={METRICS.map(([k, l]) => [k, l] as [Metric, string])} />
            <button className="seg on" onClick={() => setSens(sensitivity(P, route, metric, SENS_IDS))}>{sens ? "Re-run" : "Run sensitivity"}</button></div>
          {sens && <div className="tornado">{sens.slice(0, 12).map((s) => { const mx = Math.max(...sens.map((x) => Math.max(Math.abs(x.dLo), Math.abs(x.dHi)))) || 1;
            const bar = (v: number, c: string) => <span style={{ position: "absolute", top: 3, bottom: 3, left: `${50 + Math.min(0, v) / mx * 50}%`, width: `${Math.abs(v) / mx * 50}%`, background: c, borderRadius: 3 }} />;
            return <div key={s.id} className="tor-row"><div className="tor-l">{s.label}</div><div className="tor-bar">{bar(s.dLo, "var(--c3)")}{bar(s.dHi, "var(--c2)")}<span className="tor-mid" /></div><div className="tor-v muted">{show(metric, s.dLo)} / {show(metric, s.dHi)}</div></div>; })}
            <div className="legend"><span><i style={{ background: "var(--c3)" }} />at half the value</span><span><i style={{ background: "var(--c2)" }} />at 1.5 times the value</span></div></div>}
        </Card>
      </div>
    </div>

    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="How it could be done in UK law">
        <div className="prose" style={{ fontSize: 13 }}>
          <p><b>Insolvency purchase.</b> Failed firms go into administration under the <a href="https://www.legislation.gov.uk/ukpga/1986/45/contents" target="_blank" rel="noreferrer">Insolvency Act 1986</a>, and the state or a state vehicle bids for the assets like any buyer. This is slow and the price is set by the administrator, but there is little legal risk.</p>
          <p><b>Statutory acquisition.</b> Parliament passes a specific Act, as with the <a href="https://www.legislation.gov.uk/ukpga/2008/2/contents" target="_blank" rel="noreferrer">Banking (Special Provisions) Act 2008</a> used for Northern Rock and Bradford &amp; Bingley. Compensation must respect A1P1 of the ECHR, but in <i>Grainger v UK</i> (2012) the Strasbourg court accepted valuing Northern Rock shares as if there were no state support, which put them close to nil.</p>
          <p><b>Resale abroad.</b> Sales of sensitive assets to foreign buyers fall under the <a href="https://www.legislation.gov.uk/ukpga/2021/25/contents" target="_blank" rel="noreferrer">National Security and Investment Act 2021</a>, which can block or condition them. That is why the share sellable abroad is a parameter.</p>
          <p><b>Relocation and running.</b> A state-owned company, or the <a href="https://www.nationalwealthfund.org.uk/" target="_blank" rel="noreferrer">National Wealth Fund</a> and British Business Bank family, could hold and run the assets. Subsidy rules under the <a href="https://www.legislation.gov.uk/ukpga/2022/23/contents" target="_blank" rel="noreferrer">Subsidy Control Act 2022</a> apply to any below-market hand-over to the champion.</p>
        </div>
      </Card>
      <Card title="Historical parallels">
        <div className="prose" style={{ fontSize: 13 }}>
          <p><b>Rolls-Royce, 1971.</b> The company went bankrupt over the RB211 engine. The state took over the aero-engine business as Rolls-Royce (1971) Ltd, the car division was floated off separately in 1973, and the aero business was privatised in 1987. This is the closest UK case of "seize, keep the strategic core, sell the rest".</p>
          <p><b>Bradford &amp; Bingley, 2008.</b> The branches and deposits were sold to Santander, and the mortgage book was kept in public hands and run down. The state split good assets from bad ones and sold the saleable part.</p>
          <p><b>British Leyland, 1975.</b> After the Ryder Report the state rescued a forced merger of national champions. Output and market share kept falling, a warning about the integration step.</p>
          <p><b>Japan's MITI, 1960s.</b> MITI tried to consolidate the car industry into a few champions. Honda resisted and became one of the most successful firms, an example of the cost of pruning the wrong firms.</p>
          <p><b>South Korea's "Big Deals", 1998.</b> After the Asian financial crisis the government brokered asset swaps between the big conglomerates (chaebol), for example in semiconductors, where LG Semicon went to Hyundai and became Hynix. The results were mixed: Hynix needed creditor rescues but survives today as SK Hynix.</p>
        </div>
      </Card>
    </div>
    <Card title="What the model leaves out" style={{ marginTop: 14 }}>
      <div className="prose muted" style={{ fontSize: 13 }}>
        <p>This is a stylised model of mechanisms, not a forecast of any real sector. Capital and capability are single numbers, and "capability" counts productive capital, not innovation quality. It does not model consumer harm from monopoly pricing, the political economy of who decides what counts as strategic, the domestic financial-stability cost of a crash beyond the contagion parameter, or whether foreign states copy the strategy. The laissez-faire arm leaves out a competition authority. Use it to find which assumptions the idea stands or falls on, then look for evidence on those.</p>
      </div>
    </Card>
  </>;
}

export default function Lab() {
  const init = (location.hash.match(/[?&]m=(\w+)/) || [])[1];
  const [m, setM] = useState<"cycle" | "reorg" | "structure">(init === "reorg" || init === "structure" ? init : "cycle");
  return <Page title="Model lab" lede="Mini-simulations for narrower questions. Each one makes every assumption a parameter, runs many times with random shocks where the evidence is uncertain, and sets the idea against alternatives, so you can find the conditions under which it works and where it breaks.">
    <div className="controls"><Seg v={m} set={setM} opts={[["cycle", "Bubble, seizure and reintegration cycle"], ["reorg", "Civil service reorganisation"], ["structure", "Management structure"]]} /></div>
    {m === "cycle" && <CycleLab />}{m === "reorg" && <ReorgLab />}{m === "structure" && <StructureLab />}
  </Page>;
}
