import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../lib";
import { Card, Page } from "../ui";
import { buildBaseline, LEVERS, Levers, simulate, YEARS, ZERO, RULE_YEAR } from "../sim/engine";
import { defaultParams } from "../sim/params";
import { scenarioLink } from "./Simulate";
import { useActs } from "./Laws";
import { FORBIDDEN_NOTE, forbiddenText, LeverMove, useBook, withChange } from "../law/statute";

type Clause = { id: number; heading: string; text: string; lever?: keyof Levers | ""; value?: number };
type Draft = { id: number; title: string; kind: string; stage: string; area: string; problem: string; objectives: string; evidence: string[]; amends: string[]; clauses: Clause[]; checks: Record<string, boolean>; notes: string; start: number; updated: string };
const KINDS = ["Policy paper", "Bill", "Statutory instrument", "Budget measure", "Departmental reform"];
const STAGES = ["Idea", "Evidence gathering", "Green paper (consultation)", "White paper", "Bill drafted", "First reading", "Second reading", "Committee", "Report and third reading", "Other House", "Royal Assent", "Implementation", "Post-legislative review"];
const SECTIONS: [string, string][] = [["#/spending", "Spending and fiscal"], ["#/nhs", "NHS"], ["#/education", "Education"], ["#/welfare", "Social security"], ["#/councils", "Councils"], ["#/departments", "Departments and civil service"], ["#/projects", "Major projects"], ["#/map", "Infrastructure map"], ["#/contracts", "Contracts"], ["#/charities", "Charities"], ["#/foreign", "Foreign affairs and defence"], ["#/history", "Policy history"], ["#/findings", "Findings"], ["#/laws", "Laws"]];
const CHECKS: [string, string, string][] = [
  ["psed", "Public sector equality duty considered", "Equality Act 2010, s.149: ministers must have due regard to equality effects."],
  ["echr", "Compatible with Convention rights (s.19 statement)", "Human Rights Act 1998, s.19: the minister must state that a bill is compatible, or that the government wishes to proceed anyway."],
  ["fiscal", "OBR assessment if fiscally significant", "Budget Responsibility Act 2024: measures above 1% of GDP need an OBR assessment. This is checked automatically below."],
  ["devo", "Territorial extent and legislative consent", "Does it touch devolved matters? The Sewel convention needs consent motions from Holyrood, the Senedd or Stormont."],
  ["subsidy", "Subsidy control principles met", "Subsidy Control Act 2022, where public money or assets go to businesses."],
  ["ia", "Impact assessment and Regulatory Policy Committee", "The Better Regulation Framework requires an impact assessment for regulatory measures."],
  ["data", "Data protection impact assessment", "UK GDPR, where personal data is processed in new ways."],
  ["review", "Commencement, review and sunset clauses", "When does each part start, and when will it be evaluated?"],
];
const LS = "atlas-drafts";
const blank = (id: number, title = "Untitled draft"): Draft => ({ id, title, kind: "Policy paper", stage: "Idea", area: "", problem: "", objectives: "", evidence: [], amends: [], clauses: [{ id: 1, heading: "Purpose", text: "" }], checks: {}, notes: "", start: 1, updated: new Date().toISOString() });
const load = (): Draft[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };

export default function DraftPage() {
  const [drafts, setDrafts] = useState<Draft[]>(load);
  const [cur, setCur] = useState<number | null>(() => load()[0]?.id ?? null);
  const acts = useActs();
  const sim = useData("fiscal", "spending", "nhs_performance", "welfare", "civil_service", "councils", "sim_params");
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(drafts)); } catch {} }, [drafts]);
  // "Draft an amendment" links from the laws page
  useEffect(() => {
    const o = location.hash.match(/[?&]open=(\d+)/);
    if (o && drafts.some((d) => d.id === +o[1])) { setCur(+o[1]); history.replaceState(null, "", "#/draft"); return; }
    const m = location.hash.match(/[?&]amend=([^&]+)/);
    if (!m) return;
    const t = decodeURIComponent(m[1]); const id = Date.now();
    const d = blank(id, `${t.replace(/ Act (\d{4})$/, "")} (Amendment) Bill`); d.kind = "Bill"; d.amends = [t];
    d.clauses = [{ id: 1, heading: "Amendments to the " + t, text: `(1) The ${t} is amended as follows.\n(2) ` }, { id: 2, heading: "Extent, commencement and short title", text: `(1) This Act extends to England and Wales.\n(2) This Act comes into force on such day as the Secretary of State may by regulations appoint.` }];
    setDrafts((x) => [d, ...x]); setCur(id); history.replaceState(null, "", "#/draft");
  }, []);
  const D = drafts.find((d) => d.id === cur) || null;
  const up = (f: (d: Draft) => void) => setDrafts((xs) => xs.map((d) => { if (d.id !== cur) return d; const n = structuredClone(d); f(n); n.updated = new Date().toISOString(); return n; }));
  const levers = useMemo<Levers>(() => { const L = { ...ZERO, start: D?.start ?? 1 } as Levers; for (const c of D?.clauses || []) if (c.lever && c.value) (L as any)[c.lever] += c.value; return L; }, [D]);
  const result = useMemo(() => { if (!sim || !D) return null; const B = buildBaseline(...(sim as [any, any, any, any, any, any, any])); return { B, R: simulate(B, levers, defaultParams()) }; }, [sim, levers]);
  const anyLever = LEVERS.some((l) => levers[l.k]);
  const [book, setBook] = useBook();
  const passed = D ? book.find((c) => c.act === D.title && c.action === "enact") : undefined;
  const lawBlocked = D ? forbiddenText([D.title, D.objectives, ...D.clauses.map((c) => `${c.heading} ${c.text}`)].join(" ")) : false;
  const pass = () => { if (!D) return; const custom: LeverMove[] = D.clauses.filter((c) => c.lever && c.value).map((c) => ({ k: c.lever as LeverMove["k"], v: c.value! }));
    setBook((b) => withChange(b, { act: D.title, action: "enact", t: D.start, text: D.objectives || D.problem || undefined, custom: custom.length ? custom : undefined })); };
  const fiscalSig = result ? result.R.dPsnb.some((x, t) => Math.abs(x) > 0.01 * result.B.gdp[t]) : false;

  return <Page title="Drafting workspace" lede="Write policy papers, bills and reforms. Link each one to the evidence and to the laws it changes. Give clauses a measurable effect, and see the effect in the simulator as you write. Drafts are saved in this browser."
    right={<div className="controls" style={{ margin: 0 }}><button className="seg on" onClick={() => { const id = Date.now(); setDrafts((x) => [blank(id), ...x]); setCur(id); }}>New draft</button></div>}>
    <div className="sim">
      <aside className="card sim-levers">
        <h3>Your drafts</h3>
        {drafts.length === 0 && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>No drafts yet. Start one, or open a landmark Act in the laws section and choose "Draft an amendment".</div>}
        {drafts.map((d) => <div key={d.id} className={`lever ${d.id === cur ? "on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setCur(d.id)}>
          <div className="lever-head"><span>{d.title}</span></div><div className="muted" style={{ fontSize: 12 }}>{d.kind} · {d.stage}</div></div>)}
      </aside>
      {!D ? <Card title="Start a draft">Use <b>New draft</b>, or go to <a href="#/laws">Laws</a> and pick an Act to amend.</Card> :
      <div className="sim-out">
        <Card>
          <input className="sim-name" style={{ fontSize: 22 }} value={D.title} onChange={(e) => up((d) => { d.title = e.target.value; })} aria-label="Title" />
          <div className="controls" style={{ marginTop: 10 }}>
            <select value={D.kind} onChange={(e) => up((d) => { d.kind = e.target.value; })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <select value={D.stage} onChange={(e) => up((d) => { d.stage = e.target.value; })}>{STAGES.map((k) => <option key={k}>{k}</option>)}</select>
            <label className="muted">Takes effect <select value={D.start} onChange={(e) => up((d) => { d.start = +e.target.value; })}>{YEARS.map((y, i) => <option key={y} value={i}>{y}</option>)}</select></label>
            <button className="seg" onClick={() => download(D)}>Export as text</button>
            <button className="seg" onClick={() => { if (confirmDelete(D)) { setDrafts((x) => x.filter((d) => d.id !== D.id)); setCur(null); } }}>Delete</button>
          </div>
          <div className="stagebar">{STAGES.map((s, i) => <span key={s} className={i <= STAGES.indexOf(D.stage) ? "on" : ""} title={s} />)}</div>
        </Card>
        <div className="grid g2" style={{ marginTop: 14 }}>
          <Card title="The problem"><textarea rows={5} value={D.problem} placeholder="What is going wrong, for whom, and how do we know?" onChange={(e) => up((d) => { d.problem = e.target.value; })} /></Card>
          <Card title="Objectives"><textarea rows={5} value={D.objectives} placeholder="What will be different, by when, and how it will be measured" onChange={(e) => up((d) => { d.objectives = e.target.value; })} /></Card>
        </div>
        <div className="grid g2" style={{ marginTop: 14 }}>
          <Card title="Evidence" sub="Sections of this app, or any web page">
            {D.evidence.map((e, i) => <div key={i} className="controls" style={{ margin: "0 0 6px" }}><a href={e} target={e.startsWith("#") ? undefined : "_blank"} rel="noreferrer">{SECTIONS.find((s) => s[0] === e)?.[1] ?? e}</a><button className="seg" style={{ padding: "1px 7px" }} onClick={() => up((d) => { d.evidence.splice(i, 1); })}>×</button></div>)}
            <div className="controls" style={{ margin: 0 }}><select value="" onChange={(e) => e.target.value && up((d) => { d.evidence.push(e.target.value); })}><option value="">Link a section…</option>{SECTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input type="search" placeholder="or paste a URL and press Enter" onKeyDown={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (e.key === "Enter" && v) { up((d) => { d.evidence.push(v); }); (e.target as HTMLInputElement).value = ""; } }} /></div>
          </Card>
          <Card title="Laws it changes" sub="Pick from every Act since 1945">
            {D.amends.map((a, i) => <div key={i} className="controls" style={{ margin: "0 0 6px" }}><a href={acts?.landmarks.find((l) => l.t === a)?.url ?? (() => { const x = acts?.acts.find((z) => z.t === a); return x ? `https://www.legislation.gov.uk/ukpga/${x.y}/${x.n}` : "#/laws"; })()} target="_blank" rel="noreferrer">{a}</a><button className="seg" style={{ padding: "1px 7px" }} onClick={() => up((d) => { d.amends.splice(i, 1); })}>×</button></div>)}
            <input list="acts-list" type="search" placeholder="Type an Act's name and press Enter" onKeyDown={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (e.key === "Enter" && v) { up((d) => { d.amends.push(v); }); (e.target as HTMLInputElement).value = ""; } }} />
            <datalist id="acts-list">{acts?.acts.slice(-3000).map((a) => <option key={a.t + a.n} value={a.t} />)}</datalist>
          </Card>
        </div>
        <Card title="Clauses" sub="Write each clause. To make a clause measurable, give it an effect on a simulator lever; the effects add together below." style={{ marginTop: 14 }}>
          {D.clauses.map((c, i) => <div key={c.id} className="clause">
            <div className="controls" style={{ margin: 0 }}><b>{i + 1}</b><input type="search" value={c.heading} placeholder="Heading" onChange={(e) => up((d) => { d.clauses[i].heading = e.target.value; })} style={{ flex: 1 }} />
              <button className="seg" style={{ padding: "1px 7px" }} disabled={i === 0} onClick={() => up((d) => { const [x] = d.clauses.splice(i, 1); d.clauses.splice(i - 1, 0, x); })}>↑</button>
              <button className="seg" style={{ padding: "1px 7px" }} onClick={() => up((d) => { d.clauses.splice(i, 1); })}>×</button></div>
            <textarea rows={4} value={c.text} onChange={(e) => up((d) => { d.clauses[i].text = e.target.value; })} placeholder="(1) …" />
            <div className="controls" style={{ margin: 0 }}><span className="muted">Effect:</span>
              <select value={c.lever || ""} onChange={(e) => up((d) => { d.clauses[i].lever = e.target.value as any; d.clauses[i].value = d.clauses[i].value || 0; })}><option value="">None (not modelled)</option>{LEVERS.map((l) => <option key={l.k} value={l.k}>{l.group.split(" (")[0]}: {l.label} ({l.unit})</option>)}</select>
              {c.lever && <input type="number" value={c.value ?? 0} step={LEVERS.find((l) => l.k === c.lever)?.step ?? 1} onChange={(e) => up((d) => { d.clauses[i].value = +e.target.value; })} style={{ width: 90 }} />}
            </div>
          </div>)}
          <button className="seg" onClick={() => up((d) => { d.clauses.push({ id: Date.now(), heading: "", text: "" }); })}>Add clause</button>
        </Card>
        <div className="grid g2" style={{ marginTop: 14 }}>
          <Card title="Modelled effect" sub={anyLever ? `Clause effects combined, from ${YEARS[D.start]}` : "Give at least one clause an effect to see it here."}>
            {result && anyLever && <><table><tbody>
              <tr><td>Change in borrowing, {YEARS.at(-1)}</td><td className="n">{sgn(result.R.dPsnb.at(-1)!)}bn</td></tr>
              <tr><td>Debt, % of GDP, {YEARS.at(-1)}</td><td className="n">{result.R.psndPct.at(-1)!.toFixed(1)}%</td></tr>
              <tr><td>Real GDP level, {YEARS.at(-1)}</td><td className="n">{sgn(result.R.gdpPct.at(-1)!, 2)}%</td></tr>
              <tr><td>NHS waiting list, {YEARS.at(-1)}</td><td className="n">{(result.R.waiting.at(-1)! / 1e6).toFixed(2)}m</td></tr>
              <tr><td>Stability rule, {RULE_YEAR}</td><td className="n" style={{ color: result.R.rules.stability.met ? "var(--green)" : "var(--red)" }}>{result.R.rules.stability.met ? "Met" : "Broken"}</td></tr>
            </tbody></table>
              <a className="seg on" style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }} href={scenarioLink({ name: D.title, levers, params: {} })}>Open in the simulator</a></>}
            <div style={{ marginTop: 10, fontSize: 13 }}>
              {lawBlocked ? <div className="flag" style={{ fontSize: 12.5 }}>{FORBIDDEN_NOTE}</div>
                : <><button className="seg" onClick={pass}>{passed ? "Pass again (updates your statute book)" : "Pass into my statute book"}</button>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{passed ? <>In force from {YEARS[passed.t]}. <a href="#/laws?tab=book">See your statute book</a>.</> : "Enacts this draft as an Act from its start year, with its clause effects, so it runs in the simulator. Add powers on the Laws page."}</div></>}
            </div>
          </Card>
          <Card title="Legal and procedural checks">
            {CHECKS.map(([k, l, help]) => <label key={k} className="check" title={help}><input type="checkbox" checked={!!D.checks[k]} onChange={(e) => up((d) => { d.checks[k] = e.target.checked; })} /> <span>{l}{k === "fiscal" && anyLever && <b style={{ color: fiscalSig ? "var(--red)" : "var(--green)" }}> {fiscalSig ? " (above 1% of GDP: OBR assessment needed)" : " (below the 1% threshold)"}</b>}<div className="muted" style={{ fontSize: 11.5 }}>{help}</div></span></label>)}
          </Card>
        </div>
        <Card title="Notes" style={{ marginTop: 14 }}><textarea rows={4} value={D.notes} onChange={(e) => up((d) => { d.notes = e.target.value; })} placeholder="Stakeholders, risks, alternatives considered, implementation plan" /></Card>
      </div>}
    </div>
  </Page>;
}
const sgn = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${v < 0 && d === 1 ? "£" : v > 0 && d === 1 ? "£" : ""}${Math.abs(v).toFixed(d)}`;
function confirmDelete(d: Draft) { return d.clauses.every((c) => !c.text) && !d.problem ? true : window.confirm(`Delete "${d.title}"?`); }
function download(d: Draft) {
  const isBill = d.kind === "Bill";
  const lines = [isBill ? `A BILL\n\nTO\n\n${d.objectives ? d.objectives.split("\n")[0] : "make provision about " + d.title}.\n` : `# ${d.title}\n\n${d.kind} · ${d.stage}\n`,
    `## Problem\n\n${d.problem}\n`, `## Objectives\n\n${d.objectives}\n`,
    d.amends.length ? `## Legislation amended\n\n${d.amends.map((a) => `- ${a}`).join("\n")}\n` : "",
    `## ${isBill ? "Clauses" : "Proposals"}\n\n${d.clauses.map((c, i) => `${i + 1} ${c.heading}\n\n${c.text}\n`).join("\n")}`,
    d.evidence.length ? `## Evidence\n\n${d.evidence.map((e) => `- ${e.startsWith("#") ? location.href.split("#")[0] + e : e}`).join("\n")}\n` : "",
    `## Checks\n\n${CHECKS.map(([k, l]) => `- [${d.checks[k] ? "x" : " "}] ${l}`).join("\n")}\n`, d.notes ? `## Notes\n\n${d.notes}\n` : ""];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${d.title.replace(/[^\w\- ]+/g, "").trim() || "draft"}.md`; a.click();
}
