import { useState } from "react";
import { useData } from "../lib";
import { Card, Loading, Page, Table } from "../ui";

const INGESTED = ["spending", "fiscal", "organisations", "civil_service", "major_projects", "councils", "population", "lookup", "geo_lad", "geo_icb", "geo_region", "schools", "welfare", "charities", "contracts", "infrastructure", "assessments", "nhs_performance", "oda", "send"];
export default function Sources() {
  const d = useData(...INGESTED, "organisations_catalogue", "datasets_backlog");
  const [dom, setDom] = useState("");
  if (!d) return <Loading />;
  const files = d.slice(0, INGESTED.length) as any[];
  const cat = d[INGESTED.length] as any, back = d[INGESTED.length + 1] as any;
  const srcs = files.flatMap((f: any, i: number) => [f.source, f.source_ks4].filter(Boolean).map((s: any) => ({ key: INGESTED[i], ...s })));
  const doms = [...new Set(cat.organisations.flatMap((o: any) => o.domains))].sort() as string[];
  return <Page title="Sources & catalogue" lede="Everything in this atlas comes from the files below, rebuilt by the scripts in the repository's pipeline folder. The catalogue lists outside organisations that publish analysis on the same questions, and the backlog lists the official data still to wire in.">
    <Card title={`Ingested datasets (${srcs.length})`}>
      <Table rows={srcs} initial="name" cols={[{ k: "key", h: "File", v: (s: any) => `${s.key}.json` }, { k: "name", h: "Source", v: (s: any) => s.name, f: (s: any) => <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> }, { k: "file", h: "Raw file", v: (s: any) => s.file || (s.files ? s.files.length + " files" : ""), f: (s: any) => s.file ? <a href={s.file} target="_blank" rel="noreferrer">download</a> : s.files ? `${Object.keys(s.files).length} files` : "–" }, { k: "note", h: "Caveats", v: (s: any) => s.note || s.licence || "" }]} />
    </Card>
    <Card title={`Organisations publishing UK policy analysis (${cat.organisations.length})`} sub={cat.note} style={{ marginTop: 14 }}>
      <div className="controls"><select value={dom} onChange={(e) => setDom(e.target.value)}><option value="">All areas</option>{doms.map((x) => <option key={x}>{x}</option>)}</select></div>
      <Table rows={cat.organisations.filter((o: any) => !dom || o.domains.includes(dom) || o.domains.includes("all"))} initial="type" cols={[{ k: "name", h: "Organisation", v: (o: any) => o.name, f: (o: any) => <a href={o.url} target="_blank" rel="noreferrer">{o.name}</a> }, { k: "type", h: "Type", v: (o: any) => o.type }, { k: "dom", h: "Areas", v: (o: any) => o.domains.join(", ") }, { k: "pub", h: "Publishes", v: (o: any) => o.publishes }]} />
    </Card>
    <Card title={`Data backlog (${back.datasets.length})`} sub={back.note} style={{ marginTop: 14 }}>
      <Table rows={back.datasets} initial="domain" cols={[{ k: "domain", h: "Area", v: (x: any) => x.domain }, { k: "name", h: "Dataset", v: (x: any) => x.name, f: (x: any) => <a href={x.url} target="_blank" rel="noreferrer">{x.name}</a> }, { k: "pub", h: "Publisher", v: (x: any) => x.publisher }, { k: "status", h: "Status", v: (x: any) => x.status }]} />
    </Card>
  </Page>;
}
