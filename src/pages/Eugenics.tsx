import { useData } from "../lib";
import { Card, Loading, Page, Source } from "../ui";

export default function Eugenics() {
  const d = useData("eugenics_history");
  if (!d) return <Loading />;
  const [E] = d as any[];
  return <Page title="Eugenics and sterilisation" lede="A history of the British eugenics movement and state sterilisation programmes abroad: what they did, the harm they caused, why they were abandoned, and the law that now forbids them. History and analysis only; nothing here is a simulator option.">
    <div className="flag gap">{E.intro}</div>
    <Card title="Britain" sub="Segregation was law; sterilisation was proposed but never passed"><div className="timeline">{(E.uk as any[]).map((e) => <div className="tl-item" key={e.title}><div className="muted" style={{ fontSize: 12 }}>{e.year}</div><h2>{e.title}</h2><div style={{ fontSize: 13.5 }}>{e.text}</div></div>)}</div></Card>
    <Card title="State sterilisation programmes elsewhere" style={{ marginTop: 14 }}>
      <table><thead><tr><th style={{ width: 150 }}>Country</th><th style={{ width: 220 }}>Scale</th><th>What happened</th></tr></thead><tbody>{(E.abroad as any[]).map((r) => <tr key={r.country}><td><b>{r.country}</b><div className="muted" style={{ fontSize: 12 }}>{r.period}</div></td><td>{r.scale}</td><td>{r.text} <a href={r.source.url} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 12 }}>Source</a></td></tr>)}</tbody></table>
    </Card>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Effects"><ul style={{ paddingLeft: 18, fontSize: 13.5, margin: 0 }}>{(E.effects as string[]).map((x) => <li key={x} style={{ marginBottom: 6 }}>{x}</li>)}</ul></Card>
      <Card title="Why it was abandoned">{(E.abandoned as any[]).map((x) => <div key={x.title} style={{ marginBottom: 10 }}><b>{x.title}.</b> <span style={{ fontSize: 13.5 }}>{x.text}</span></div>)}</Card>
    </div>
    <Card title="The law now" sub="Forced or non-consensual sterilisation is unlawful in the UK and, at scale, an international crime" style={{ marginTop: 14 }}>
      <table><thead><tr><th style={{ width: 260 }}>Law</th><th>Effect</th></tr></thead><tbody>{(E.law_now as any[]).map((r) => <tr key={r.law}><td><b>{r.law}</b></td><td>{r.text}</td></tr>)}</tbody></table>
      <Source s={E.sources} />
    </Card>
    <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{E.note} Related: <a href="#/migration?tab=levers">chemical suppression for sex offenders</a>, which is reversible medication and is in the simulator, and <a href="#/history">policy history</a>.</div>
  </Page>;
}
