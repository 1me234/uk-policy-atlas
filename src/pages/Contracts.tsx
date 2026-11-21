import { useMemo, useState } from "react";
import { fmt, useData } from "../lib";
import { Card, Loading, Page, Stat, Table } from "../ui";

export default function Contracts() {
  const d = useData("contracts");
  const [q, setQ] = useState("");
  const ct = d ? (d[0] as any) : null;
  const awards = useMemo(() => !ct ? [] : ct.large_awards.filter((a: any) => !q || `${a.title} ${a.buyer} ${a.suppliers.join(" ")} ${a.cpv}`.toLowerCase().includes(q.toLowerCase())), [ct, q]);
  if (!ct) return <Loading />;
  const total = ct.buyers.reduce((a: number, b: any) => a + b[2], 0);
  const top10 = ct.suppliers.slice(0, 10).reduce((a: number, s: any) => a + s[2], 0);
  const direct = ct.large_awards.filter((a: any) => /direct|without|negotiated/i.test(a.method || "")).length;
  return <Page title="Contracts & suppliers" lede="Who the public sector buys from: award notices published on Contracts Finder in the last 12 months. Values are as published (framework ceilings can inflate them), and since the Procurement Act some notices appear only on Find a Tender.">
    <div className="grid g4">
      <Stat v={fmt.n(ct.n_awards)} l="Award notices, last 12 months" />
      <Stat v={fmt.gbp(total)} l="Total published value" />
      <Stat v={fmt.pct((top10 / total) * 100, 0)} l="Share going to the top 10 suppliers" />
      <Stat v={fmt.n(direct)} l="£1m+ awards made without open competition" d="Direct awards and negotiated procedures, as described in notices" />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <Card title="Top suppliers" source={ct.source}><Table rows={ct.suppliers} initial="v" max={200} cols={[{ k: "s", h: "Supplier", v: (s: any) => s[0] }, { k: "n", h: "Awards", n: true, v: (s: any) => s[1] }, { k: "v", h: "Value", n: true, v: (s: any) => s[2], f: (s: any) => fmt.gbp(s[2]) }]} /></Card>
      <Card title="Top buyers" source={ct.source}><Table rows={ct.buyers} initial="v" max={200} cols={[{ k: "b", h: "Buyer", v: (s: any) => s[0] }, { k: "n", h: "Awards", n: true, v: (s: any) => s[1] }, { k: "v", h: "Value", n: true, v: (s: any) => s[2], f: (s: any) => fmt.gbp(s[2]) }]} /></Card>
    </div>
    <Card title="Awards worth £1m or more" style={{ marginTop: 14 }} source={ct.source}>
      <div className="controls"><input type="search" placeholder="Search title, buyer, supplier, category…" value={q} onChange={(e) => setQ(e.target.value)} /><span className="muted">{fmt.n(awards.length)} awards</span></div>
      <Table rows={awards} initial="v" onRow={(a: any) => window.open(`https://www.contractsfinder.service.gov.uk/Notice/${a.id.replace(/^ocds-b5fd17-/, "")}`, "_blank")} cols={[
        { k: "t", h: "Contract", v: (a: any) => a.title, f: (a: any) => <>{a.title}<div className="muted" style={{ fontSize: 11.5 }}>{a.cpv}</div></> },
        { k: "b", h: "Buyer", v: (a: any) => a.buyer }, { k: "s", h: "Supplier(s)", v: (a: any) => a.suppliers.join(", ") },
        { k: "v", h: "Value", n: true, v: (a: any) => a.value, f: (a: any) => fmt.gbp(a.value) },
        { k: "d", h: "Awarded", n: true, v: (a: any) => a.date }, { k: "m", h: "Procedure", v: (a: any) => a.method },
      ]} />
    </Card>
  </Page>;
}
