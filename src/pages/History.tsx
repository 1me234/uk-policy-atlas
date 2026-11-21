import { useState } from "react";
import { useData } from "../lib";
import { Card, Loading, Page, Seg } from "../ui";

const LINK: Record<string, [string, string]> = { welfare: ["#/welfare", "Social security"], spending: ["#/spending", "Spending"], nhs: ["#/nhs", "NHS"], map: ["#/map", "Infrastructure map"], councils: ["#/councils", "Councils"], education: ["#/education", "Education"], projects: ["#/projects", "Major projects"], foreign: ["#/foreign", "Foreign affairs"], departments: ["#/departments", "Departments"], contracts: ["#/contracts", "Contracts"] };
export default function History() {
  const d = useData("policy_history");
  const [dom, setDom] = useState("");
  if (!d) return <Loading />;
  const h = d[0] as any;
  const doms = [...new Set(h.policies.map((p: any) => p.domain))] as string[];
  const list = h.policies.filter((p: any) => !dom || p.domain === dom).sort((a: any, b: any) => a.year - b.year);
  return <Page title="Policy history" lede="Landmark policies: the problem they answered, what changed, what the evidence says happened, and where in this atlas to track the consequences today.">
    <div className="controls"><Seg opts={[["", "All"], ...doms.map((x) => [x, x] as [string, string])]} v={dom} set={setDom} /></div>
    <Card><div className="timeline">{list.map((p: any) => <div className="tl-item" key={p.title}>
      <div className="muted" style={{ fontSize: 12 }}>{p.year} · {p.domain}</div>
      <h2>{p.title}</h2>
      <div className="kv" style={{ gridTemplateColumns: "110px 1fr" }}><div>Context</div><div>{p.context}</div><div>What changed</div><div>{p.change}</div><div>Effects</div><div>{p.effects}</div><div>Track it</div><div>{p.track.map((t: string) => LINK[t] && <a key={t} href={LINK[t][0]} style={{ marginRight: 10 }}>{LINK[t][1]}</a>)}</div></div>
      <div className="src">Sources: {p.sources.map((s: any, i: number) => <span key={i}>{i > 0 && " · "}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></span>)}</div>
    </div>)}</div><div className="muted" style={{ fontSize: 12 }}>{h.note}</div></Card>
  </Page>;
}
