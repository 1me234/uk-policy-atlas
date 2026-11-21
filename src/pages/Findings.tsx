import { useEffect, useMemo, useState } from "react";
import { fmt, useData } from "../lib";
import { Card, Loading, Page } from "../ui";

type Note = { id: number; area: string; problem: string; evidence: string; idea: string; status: string };
const RANK: Record<string, number> = { GREEN: 1, AMBER: 2, RED: 3 };
export default function Findings() {
  const d = useData("major_projects", "councils", "civil_service", "schools", "welfare", "charities", "infrastructure", "contracts", "assessments", "population", "send", "nhs_performance", "oda", "efs");
  const [notes, setNotes] = useState<Note[]>(() => { try { return JSON.parse(localStorage.getItem("atlas-notes") || "[]"); } catch { return []; } });
  const [draft, setDraft] = useState<Note>({ id: 0, area: "", problem: "", evidence: "", idea: "", status: "Investigating" });
  useEffect(() => { try { localStorage.setItem("atlas-notes", JSON.stringify(notes)); } catch {} }, [notes]);
  const f = useMemo(() => {
    if (!d) return null;
    const [mp, c, cs, sc, w, ch, inf, ct, , , send, nhs, oda, efs] = d as any[];
    const out: { area: string; kind: "bad" | "good" | "gap"; text: string; link: string }[] = [];
    const P = mp.projects;
    const red = P.filter((p: any) => (p.dca_nista || p.dca_sro) === "RED");
    out.push({ area: "Major projects", kind: "bad", link: "#/projects", text: `${red.length} of ${P.length} major projects are rated red, with a combined whole-life cost of ${fmt.gbp(red.reduce((a: number, p: any) => a + (p.whole_life_cost_m || 0), 0), "m")} where disclosed.` });
    const sroOnly = P.filter((p: any) => !RANK[p.dca_nista] && RANK[p.dca_sro]);
    out.push({ area: "Major projects", kind: "gap", link: "#/projects", text: `${sroOnly.length} projects carry only the department's own (senior responsible owner) rating, with no independent NISTA rating published, so their status is self-assessed.` });
    const exempt = P.filter((p: any) => String(p.dca_nista || p.dca_sro || "").startsWith("Exempt")).length;
    out.push({ area: "Major projects", kind: "gap", link: "#/projects", text: `${exempt} projects withhold their rating under FOI exemptions (commercial interests, national security, policy formulation).` });
    const cols: string[] = c.columns; const gi = (s: string) => cols.findIndex((x) => x.includes(s));
    const dsg = gi("dedicated schools grant adjustment account level at 31 March"), nre = gi("NET REVENUE EXPENDITURE");
    const LA = c.authorities.filter((a: any) => a.class !== "O" && a.class !== "Eng");
    const def = LA.filter((a: any) => (a.values[dsg] || 0) < 0);
    const big = def.filter((a: any) => a.values[nre] && -a.values[dsg] > 0.25 * a.values[nre]);
    out.push({ area: "Councils", kind: "bad", link: "#/councils", text: `${def.length} councils carry special-needs (DSG) deficits totalling ${fmt.gbp(-def.reduce((s: number, a: any) => s + a.values[dsg], 0), "k")}; in ${big.length} the deficit exceeds a quarter of their entire net revenue budget.` });
    const ri = (s: string) => gi(s);
    const resA = ["Estimated other earmarked financial reserves level at 1 April", "Estimated unallocated financial reserves level at 1 April"].map(ri), resB = ["Estimated other earmarked financial reserves level at 31 March", "Estimated unallocated financial reserves level at 31 March"].map(ri);
    const drew = LA.filter((a: any) => { const x = resA.reduce((s, i) => s + (a.values[i] || 0), 0), y = resB.reduce((s, i) => s + (a.values[i] || 0), 0); return x > 0 && y < x * 0.85; });
    out.push({ area: "Councils", kind: "bad", link: "#/councils", text: `${drew.length} councils ran down more than 15% of their usable reserves during 2025-26, a sign of budgets balanced with one-off money.` });
    const sn = send.national, s0 = sn[0], s1 = sn.at(-1);
    out.push({ area: "Special needs", kind: "bad", link: "#/councils", text: `EHC plans have doubled, from ${fmt.n(s0.total)} in ${s0.year} to ${fmt.n(s1.total)} in ${s1.year} (+${((s1.total / s0.total - 1) * 100).toFixed(0)}%). Places in independent special schools rose ${((s1.special_independent / s0.special_independent - 1) * 100).toFixed(0)}%, and only ${fmt.pct(send.national_within20_pct.at(-1), 0)} of new plans were issued within the 20-week legal limit in ${send.timeliness_years.at(-1)}. Paying for these plans is what the high-needs (DSG) deficits above are made of.` });
    const nl = nhs.rtt_monthly.at(-1), n0 = nhs.rtt_monthly[0];
    out.push({ area: "NHS", kind: "bad", link: "#/nhs", text: `${(nl.waiting / 1e6).toFixed(1)}m waits for planned hospital treatment (${nl.month}); ${fmt.pct(nl.within18_pct)} within 18 weeks against a 92% standard last met in 2016. Cancer 62-day performance is ${fmt.pct(nhs.cancer.d62_pct)} (standard 85%), and ${fmt.pct(nhs.diagnostics.over6w_pct)} of patients wait 6+ weeks for a diagnostic test (standard 1%).` });
    out.push({ area: "NHS", kind: "good", link: "#/nhs", text: `Year-long waits fell from ${fmt.n(n0.over52)} to ${fmt.n(nl.over52)} between ${n0.month} and ${nl.month}, and the share seen within 18 weeks rose from ${fmt.pct(n0.within18_pct)} to ${fmt.pct(nl.within18_pct)}.` });
    const idrc = oda.by_sector.find((r: any) => r.label === "Refugees in Donor Countries"), L = oda.years.length - 1;
    out.push({ area: "Aid", kind: "bad", link: "#/foreign", text: `${fmt.gbp(idrc.values[L], "m")} of UK aid in ${oda.years[L]} (${fmt.pct((idrc.values[L] / oda.headline.total_m) * 100, 0)}) was spent in the UK on asylum accommodation and support, up from ${fmt.gbp(idrc.values[0], "m")} in ${oda.years[0]}, while aid for health, education and infrastructure abroad fell.` });
    const E = Object.values(efs.councils) as any[]; const ey = (y: string) => E.reduce((t: number, e: any) => t + (e.years[y]?.m || 0), 0);
    out.push({ area: "Councils", kind: "bad", link: "#/councils", text: `${E.length} councils have needed exceptional financial support (permission to pay day-to-day costs from borrowing or asset sales) since 2020-21. The amount agreed rose from ${fmt.gbp(ey("2022-23"), "m")} for 2022-23 to ${fmt.gbp(ey("2026-27"), "m")} for 2026-27.` });
    const tot = cs.organisations.find((o: any) => o.name === "Overall Civil Service");
    out.push({ area: "Civil service", kind: "gap", link: "#/departments", text: `${fmt.pct((tot.by_region.London / tot.headcount) * 100, 0)} of civil servants (${fmt.n(tot.by_region.London)}) are based in London, where pay and property costs are highest.` });
    const S = sc.schools.map((r: any[]) => Object.fromEntries(sc.fields.map((k: string, i: number) => [k, r[i]])));
    const prim = S.filter((s: any) => s.phase === "Primary" && s.capacity && s.pupils != null);
    const surplus = prim.reduce((a: number, s: any) => a + Math.max(0, s.capacity - s.pupils), 0);
    out.push({ area: "Education", kind: "gap", link: "#/education", text: `Primary schools report about ${fmt.n(surplus)} unfilled places as rolls fall; ${prim.filter((s: any) => s.pupils < s.capacity * 0.75).length} primaries are under three-quarters full.` });
    const a8 = S.filter((s: any) => s.attainment8 != null);
    const low = a8.filter((s: any) => s.attainment8 < 35);
    if (a8.length) out.push({ area: "Education", kind: "bad", link: "#/education", text: `${low.length} of ${a8.length} secondary schools have an Attainment 8 score below 35 (roughly a grade 3.5 average across eight GCSEs). Progress 8 is not published for 2025-26 because the KS2 baseline was cancelled in 2020, so value-added comparison is currently missing.` });
    const t1b = w.sheets["Table 1b"]; const firstF = w.sheets["Benefit summary table"].status.indexOf("Forecast"); const yN = w.sheets["Benefit summary table"].years[firstF - 1];
    const i10 = t1b.years.indexOf("2010/11"), iN = t1b.years.indexOf(yN);
    const growth = t1b.series.filter((s: any) => !/of which|total/i.test(s.label) && s.values[i10] > 1000 && s.values[iN]).map((s: any) => ({ l: s.label, g: (s.values[iN] / s.values[i10] - 1) * 100, v: s.values[iN] })).sort((a: any, b: any) => b.g - a.g);
    out.push({ area: "Social security", kind: "bad", link: "#/welfare", text: `Fastest-growing benefits in real terms since 2010/11: ${growth.slice(0, 3).map((g: any) => `${g.l} (${g.g > 0 ? "+" : ""}${g.g.toFixed(0)}%)`).join(", ")}.` });
    const gd = ch.charities.filter((x: any) => x.income > 5e6 && ((x.gov_contracts || 0) + (x.gov_grants || 0)) / x.income > 0.75);
    out.push({ area: "NGOs", kind: "gap", link: "#/charities", text: `${gd.length} charities with income over £5m get more than 75% of it from government: in effect outsourced public services with less transparency than public bodies.` });
    const res = inf.assets.filter((a: any) => a.type === "reservoir" && (a.built || a.opened));
    const yr = (a: any) => parseInt((a.opened || a.built).slice(0, 4));
    out.push({ area: "Infrastructure", kind: "bad", link: "#/map", text: `Of ${res.length} dated reservoirs, ${res.filter((a: any) => yr(a) >= 1990).length} were built since 1990, against ${res.filter((a: any) => yr(a) >= 1950 && yr(a) < 1990).length} in 1950–1989, while the population has grown by over 10 million.` });
    out.push({ area: "Infrastructure", kind: "gap", link: "#/map", text: `Only ${inf.assets.filter((a: any) => a.cost).length} of ${fmt.n(inf.assets.length)} mapped assets have any recorded build cost in open data: there is no public register of what infrastructure cost to build.` });
    const top10 = ct.suppliers.slice(0, 10).reduce((a: number, s: any) => a + s[2], 0), all = ct.suppliers.reduce((a: number, s: any) => a + s[2], 0);
    out.push({ area: "Contracts", kind: "gap", link: "#/contracts", text: `The ten largest suppliers account for ${fmt.pct((top10 / all) * 100, 0)} of contract value published on Contracts Finder in the last year.` });
    return out;
  }, [d]);
  if (!d || !f) return <Loading />;
  const as = d[8] as any;
  const add = () => { if (!draft.problem) return; setNotes([{ ...draft, id: Date.now() }, ...notes]); setDraft({ ...draft, problem: "", evidence: "", idea: "" }); };
  const exportMd = () => { const md = "# Policy atlas notes\n\n" + notes.map((n) => `## ${n.area || "General"}: ${n.problem}\n\n- Status: ${n.status}\n- Evidence: ${n.evidence}\n- Idea / strategy: ${n.idea}\n`).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" })); a.download = "policy-atlas-notes.md"; a.click(); };
  return <Page title="Findings & plan" lede="What the data says is going wrong, what is working, and where the evidence is missing. Findings are computed live from the datasets; independent ratings come from the Institute for Government. Use the workbench to build your own diagnosis and strategy.">
    <div className="grid g2">
      <Card title="Computed from the data">
        {f.map((x, i) => <div key={i} className={`flag ${x.kind === "good" ? "good" : x.kind === "gap" ? "gap" : ""}`}><b>{x.area}.</b> {x.text} <a href={x.link}>Explore</a></div>)}
        <div className="legend"><span><i style={{ background: "var(--red)" }} />Problem</span><span><i style={{ background: "var(--amber)" }} />Gap or risk</span></div>
      </Card>
      <Card title="Independent ratings of public services" sub="Performance change 2010–24, progress 2024–26, and expected change to 2029" source={as.source}>
        <table><thead><tr><th>Service</th><th>2010–24</th><th>2024–26</th><th>To 2029</th></tr></thead><tbody>{as.services.map((s: any) => <tr key={s.service} title={s.why}><td>{s.service}<div className="muted" style={{ fontSize: 11.5 }}>{s.why}</div></td><td>{s["2010_24"]}</td><td>{s["2024_26"]}</td><td>{s.outlook_2029}</td></tr>)}</tbody></table>
      </Card>
    </div>
    <Card title="Strategy workbench" sub="Your notes stay in this browser only. Export them as Markdown to keep or share." style={{ marginTop: 14 }}>
      <div className="grid g2">
        <div style={{ display: "grid", gap: 8 }}>
          <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}><option value="">Area…</option>{["Spending", "Civil service", "Major projects", "Infrastructure", "Councils", "NHS", "Education", "Social security", "NGOs", "Contracts", "Foreign affairs"].map((a) => <option key={a}>{a}</option>)}</select>
          {(["problem", "evidence", "idea"] as const).map((k) => <textarea key={k} placeholder={{ problem: "What is going wrong (or right)?", evidence: "Evidence: which figures, which source?", idea: "What could be done? Who would do it? What would it cost?" }[k]} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} rows={k === "problem" ? 2 : 3} style={{ font: "inherit", padding: 8, borderRadius: 7, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)" }} />)}
          <div className="controls"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{["Investigating", "Diagnosed", "Strategy drafted", "Ready to propose"].map((s) => <option key={s}>{s}</option>)}</select><button className="seg on" onClick={add}>Add note</button><button className="seg" onClick={exportMd} disabled={!notes.length}>Export Markdown</button></div>
        </div>
        <div className="scroll" style={{ maxHeight: 420 }}>{notes.length === 0 ? <p className="muted">No notes yet. Start from a finding on the left.</p> : notes.map((n) => <div key={n.id} className="card" style={{ marginBottom: 8, boxShadow: "none" }}><div className="muted" style={{ fontSize: 12 }}>{n.area || "General"} · {n.status} <button className="seg" style={{ float: "right", padding: "1px 7px" }} onClick={() => setNotes(notes.filter((x) => x.id !== n.id))}>Remove</button></div><b>{n.problem}</b>{n.evidence && <p style={{ margin: "4px 0" }}><span className="muted">Evidence:</span> {n.evidence}</p>}{n.idea && <p style={{ margin: "4px 0" }}><span className="muted">Strategy:</span> {n.idea}</p>}</div>)}</div>
      </div>
    </Card>
  </Page>;
}
