import React, { useEffect, useMemo, useState } from "react";
import { fmt, useData } from "../lib";
import { Card, Drawer, Loading, Page } from "../ui";
import { LEVERS, PRESETS, ZERO } from "../sim/engine";
import { PARAMS } from "../sim/params";
import { actUrl } from "./Laws";
import { scenarioLink } from "./Simulate";

// ---------- The index ----------
type Kind = "dataset" | "page" | "model" | "lever" | "param" | "preset" | "act" | "bill" | "project" | "org" | "research" | "history" | "backlog" | "draft" | "scenario" | "campaign" | "law" | "mine";
const KINDS: [Kind, string][] = [
  ["dataset", "Datasets"], ["page", "Atlas pages"], ["model", "Models"], ["lever", "Simulator levers"], ["param", "Model parameters"], ["preset", "Preset scenarios"],
  ["act", "Acts"], ["bill", "Bills"], ["project", "Major projects"], ["org", "Government bodies"], ["research", "Research and scrutiny"], ["history", "Policy history"],
  ["backlog", "Data still to add"], ["draft", "My drafts"], ["scenario", "My scenarios"], ["campaign", "My campaigns"], ["law", "My law changes"], ["mine", "My own items"],
];
const ORDER = Object.fromEntries(KINDS.map(([k], i) => [k, i])) as Record<Kind, number>;
const KIND_LABEL = Object.fromEntries(KINDS.map(([k, l]) => [k, l.replace(/s$/, "").replace(/^My /, "")])) as Record<Kind, string>;
type Item = { key: string; kind: Kind; title: string; sub?: string; href?: string; ext?: string; body?: React.ReactNode; subjects: string[]; links: string[]; hay: string; year?: number };

// One subject vocabulary for everything: the areas used for Acts, plus places and civil society.
const AREAS = ["Health and care", "Education and skills", "Social security and pensions", "Tax and public finance", "Local government and devolution", "Housing and planning", "Transport and infrastructure", "Energy and environment", "Justice, policing and security", "Immigration and borders", "Defence and foreign affairs", "Employment and business", "Constitution and government", "Culture, media and digital"];
const SUBJ: Record<string, string> = {
  nhs: AREAS[0], "public-health": AREAS[0], "social-care": AREAS[0], education: AREAS[1], children: AREAS[1], "social-mobility": AREAS[1],
  welfare: AREAS[2], poverty: AREAS[2], "living-standards": AREAS[2], spending: AREAS[3], fiscal: AREAS[3], tax: AREAS[3], economy: AREAS[3], audit: AREAS[3], contracts: AREAS[3], procurement: AREAS[3],
  councils: AREAS[4], housing: AREAS[5], infrastructure: AREAS[6], transport: AREAS[6], projects: AREAS[6], water: AREAS[7], justice: AREAS[8], migration: AREAS[9], immigration: AREAS[9], asylum: AREAS[9], borders: AREAS[9],
  defence: AREAS[10], foreign: AREAS[10], "foreign-affairs": AREAS[10], aid: AREAS[10], employment: AREAS[11], "civil-service": AREAS[12], integrity: AREAS[12],
  geography: "Places and population", population: "Places and population", charities: "Charities and civil society", ngo: "Charities and civil society",
};
const subj = (xs: string[]) => [...new Set(xs.map((x) => SUBJ[x] ?? (AREAS.includes(x) ? x : "")).filter(Boolean))];
const LEVER_SUBJ: Record<string, string[]> = { "Asylum and borders": [AREAS[9]], "Immigration and nationality law": [AREAS[9], AREAS[12]], Tax: [AREAS[3]], "Health and care": [AREAS[0]], "Schools and children": [AREAS[1]], "Social security": [AREAS[2]], "Councils and housing": [AREAS[4], AREAS[5]], Justice: [AREAS[8]], "Defence, investment and other spending": [AREAS[10], AREAS[6]], "Machinery of government": [AREAS[12]], "Shocks and population": [AREAS[3], AREAS[9]] };
const projSubj = (c: string) => /military|defen/i.test(c) ? [AREAS[10]] : /infra|construct/i.test(c) ? [AREAS[6]] : [AREAS[12]];
const MODELS = [
  { id: "simulate", title: "Policy simulator", href: "#/simulate", sub: "Ten-year model of tax, spending, services, the economy and the public finances", subjects: [AREAS[3], AREAS[0], AREAS[1], AREAS[2]], data: ["fiscal", "spending", "nhs_performance", "welfare", "civil_service", "councils", "sim_params", "major_projects"] },
  { id: "sandbox", title: "Sandbox campaign", href: "#/sandbox", sub: "Play ten years from today's data, setting policy each year", subjects: [AREAS[3]], data: ["fiscal", "spending", "nhs_performance", "welfare", "civil_service", "councils", "sim_params", "major_projects"] },
  { id: "migration", title: "Asylum, removals and immigration law", href: "#/migration?tab=levers", sub: "Asylum stock and flow model with enforcement, ECHR, settlement, citizenship deprivation, entry and sentencing levers, inside the policy simulator", subjects: [AREAS[9], AREAS[8], AREAS[12]], data: ["migration"] },
  { id: "cycle", title: "Bubble, seizure and relocation cycle", href: "#/lab?m=cycle", sub: "Model lab: a state-orchestrated cycle across sectors", subjects: [AREAS[11], AREAS[3]], data: [] },
  { id: "reorg", title: "Civil service reorganisation", href: "#/lab?m=reorg", sub: "Model lab: mergers, relocation, spans of control and automation, as a Monte Carlo", subjects: [AREAS[12]], data: ["civil_service"] },
  { id: "structure", title: "Management structure", href: "#/lab?m=structure", sub: "Model lab: spans and layers of management", subjects: [AREAS[12]], data: ["civil_service"] },
];

const read = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };

// ---------- What the user adds ----------
type Cat = { id: string; name: string; color: string };
type Mine = { id: string; title: string; url?: string; note?: string };
type Filing = { cats?: string[]; tags?: string[]; note?: string; links?: string[]; star?: boolean };
type HubUser = { cats: Cat[]; items: Record<string, Filing>; mine: Mine[] };
const LS = "atlas-hub";
const PALETTE = ["#2a6f97", "#c44536", "#5a8f29", "#b5838d", "#e09f3e", "#6d597a", "#38a3a5", "#7f5539"];
const newId = () => Math.random().toString(36).slice(2, 9);

export default function Hub() {
  const d = useData("hub", "legislation", "legislation_landmarks", "major_projects", "organisations", "organisations_catalogue", "policy_history", "datasets_backlog");
  const [U, setU] = useState<HubUser>(() => ({ cats: [], items: {}, mine: [], ...read(LS, {}) }));
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(U)); } catch {} }, [U]);
  const [q, setQ] = useState(() => decodeURIComponent((location.hash.match(/[?&]q=([^&]+)/) || [])[1] || ""));
  const [kinds, setKinds] = useState<Set<Kind>>(new Set());
  const [cat, setCat] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [filed, setFiled] = useState(false);
  const [sel, setSel] = useState<string | null>(() => decodeURIComponent((location.hash.match(/[?&]item=([^&]+)/) || [])[1] || "") || null);
  const [limit, setLimit] = useState(100);

  const items = useMemo(() => {
    if (!d) return null;
    const [hub, leg, marks, mp, orgs, cat, hist, back] = d as any[];
    const out: Item[] = [];
    const push = (x: Omit<Item, "hay" | "links" | "subjects"> & { links?: string[]; subjects?: string[]; extra?: string }) =>
      out.push({ ...x, links: x.links ?? [], subjects: x.subjects ?? [], hay: `${x.title} ${x.sub ?? ""} ${x.extra ?? ""}`.toLowerCase() });
    // Datasets and pages
    const pageOf: Record<string, string[]> = {};
    for (const s of hub.datasets) {
      const rec = s.tables.reduce((m: number, t: any) => Math.max(m, t.n), 0);
      for (const p of s.pages) (pageOf[p.key] ||= []).push(`dataset:${s.file}`);
      push({ key: `dataset:${s.file}`, kind: "dataset", title: s.source ?? s.file, sub: `${s.file}.json · ${fmt.n(s.bytes / 1024, 0)} KB${rec ? ` · ${fmt.n(rec)} records in the largest table` : ""}`, href: `./data/${s.file}.json`, ext: s.url,
        subjects: subj(s.domains), links: s.pages.filter((p: any) => p.key !== "sources").map((p: any) => `page:${p.key}`), extra: `${s.file} ${s.note ?? ""} ${s.tables.map((t: any) => t.name + " " + t.fields.join(" ")).join(" ")}`,
        body: <>{s.note && <p className="muted">{s.note}</p>}{s.more_sources.map((m: any) => <div key={m.name} className="muted" style={{ fontSize: 12.5 }}>Also: {m.url ? <a href={m.url} target="_blank" rel="noreferrer">{m.name}</a> : m.name}</div>)}
          <table style={{ marginTop: 8 }}><thead><tr><th>Table</th><th className="n">Records</th><th>Fields</th></tr></thead><tbody>{s.tables.map((t: any) => <tr key={t.name}><td>{t.name}</td><td className="n">{fmt.n(t.n)}</td><td className="muted" style={{ fontSize: 12 }}>{t.fields.slice(0, 12).join(", ")}{t.fields.length > 12 ? "…" : ""}</td></tr>)}</tbody></table></> });
    }
    for (const p of hub.pages) push({ key: `page:${p.key}`, kind: "page", title: p.label, sub: `${p.group} section of the atlas`, href: `#/${p.key}`, links: pageOf[p.key] ?? [] });
    for (const m of MODELS) push({ key: `model:${m.id}`, kind: "model", title: m.title, sub: m.sub, href: m.href, subjects: m.subjects, links: m.data.map((f) => `dataset:${f}`) });
    for (const l of LEVERS) push({ key: `lever:${l.k}`, kind: "lever", title: l.label, sub: `${l.group} · ${l.unit} · from ${l.min} to ${l.max}`, href: `#/simulate`, body: l.help ? <p>{l.help}</p> : undefined, subjects: LEVER_SUBJ[l.group] ?? [], links: ["model:simulate", "model:sandbox"], extra: l.help });
    for (const p of PARAMS) push({ key: `param:${p.id}`, kind: "param", title: p.label, sub: `${p.group} · ${p.value} ${p.unit} · ${p.kind}`, href: "#/simulate", ext: p.url, links: ["model:simulate"], extra: `${p.id} ${p.source ?? ""} ${p.note ?? ""}`,
      body: <>{p.source && <p className="muted">Source: {p.source}</p>}{p.note && <p>{p.note}</p>}</> });
    PRESETS.forEach((p, i) => push({ key: `preset:${i}`, kind: "preset", title: p.name, sub: p.note, href: scenarioLink({ name: p.name, levers: { ...ZERO, ...p.levers }, params: {} }), links: ["model:simulate", ...Object.keys(p.levers).map((k) => `lever:${k}`)] }));
    // Law
    const mark: Record<string, any> = Object.fromEntries((marks as any[]).map((m) => [m.t, m]));
    const book = read("atlas-statute", []) as any[];
    const lastChange: Record<string, any> = {}; for (const c of [...book].sort((a, b) => a.t - b.t)) lastChange[c.act] = c;
    for (const a of leg.acts) { const m = mark[a.t];
      push({ key: `act:${a.u ?? `${a.y}/${a.n}`}`, kind: "act", title: a.t, sub: `${a.y} c. ${a.n}${a.a?.length ? ` · ${a.a.join(", ")}` : ""}${m ? " · landmark" : ""}${lastChange[a.t.replace(/\s*\(repealed\)$/i, "")] ? ` · ${{ repeal: "repealed", amend: "amended", restore: "restored" }[lastChange[a.t.replace(/\s*\(repealed\)$/i, "")].action as string]} in your statute book` : ""}`, ext: actUrl(a), href: `#/laws?tab=all&q=${encodeURIComponent(a.t)}`, year: a.y, subjects: a.a ?? [], extra: m ? `${m.context} ${m.did} ${m.effects ?? ""}` : "",
        body: m ? <><p><b>Context.</b> {m.context}</p><p><b>What it did.</b> {m.did}</p>{m.effects && <p><b>Effects.</b> {m.effects}</p>}</> : undefined }); }
    for (const b of leg.bills) push({ key: `bill:${b.id}`, kind: "bill", title: b.t, sub: `${b.type} bill · ${b.stage} (${b.house}) · updated ${b.updated}`, ext: `https://bills.parliament.uk/bills/${b.id}`, href: `#/laws?tab=bills&q=${encodeURIComponent(b.t)}`, subjects: b.a ?? [] });
    // The state
    for (const p of mp.projects) push({ key: `project:${p.id}`, kind: "project", title: p.name, sub: `${p.department} · ${p.category}${p.dca_nista || p.dca_sro ? ` · ${p.dca_nista || p.dca_sro}` : ""}${p.whole_life_cost_m ? ` · ${fmt.gbp(p.whole_life_cost_m, "m")}` : ""}`, href: `#/projects/${encodeURIComponent(p.id)}`, subjects: projSubj(p.category), links: ["dataset:major_projects"], extra: p.description });
    for (const o of orgs.organisations) push({ key: `org:${o.id}`, kind: "org", title: o.name, sub: `${o.format}${o.acronym ? ` · ${o.acronym}` : ""}${o.status !== "live" ? ` · ${o.status}` : ""}`, ext: o.url, href: "#/departments", subjects: [AREAS[12]], links: [...(o.parents ?? []), ...(o.superseded_by ?? [])].map((x: string) => `org:${x}`) });
    for (const o of cat.organisations) push({ key: `research:${o.name}`, kind: "research", title: o.name, sub: `${o.type} · ${o.publishes ?? ""}`, ext: o.url, href: "#/sources", subjects: subj(o.domains) });
    for (const p of hist.policies) push({ key: `history:${p.year}:${p.title}`, kind: "history", title: `${p.title} (${p.year})`, sub: p.context, href: "#/history", year: p.year, subjects: subj([p.domain]), extra: `${p.change ?? ""} ${p.effect ?? ""}` });
    for (const b of back.datasets) push({ key: `backlog:${b.name}`, kind: "backlog", title: b.name, sub: `${b.publisher} · ${b.status}`, ext: b.url, href: "#/sources", subjects: subj([b.domain]), extra: b.note, body: b.note ? <p>{b.note}</p> : undefined });
    // The user's own work, kept in this browser
    const actByTitle: Record<string, string> = Object.fromEntries(leg.acts.flatMap((a: any) => [[a.t, `act:${a.u ?? `${a.y}/${a.n}`}`], [a.t.replace(/\s*\(repealed\)$/i, ""), `act:${a.u ?? `${a.y}/${a.n}`}`]]));
    const YRS = ["2026-27", "2027-28", "2028-29", "2029-30", "2030-31", "2031-32", "2032-33", "2033-34", "2034-35", "2035-36"];
    const lawItem = (c: any, where: string, href: string, id: string) => push({ key: `law:${id}`, kind: "law", title: `${{ repeal: "Repeal", amend: "Amend", restore: "Restore" }[c.action as string]}: ${c.act}`, sub: `${where} · from ${YRS[c.t]}${c.text ? ` · ${c.text}` : c.option ? ` · ${c.option}` : ""}`, href, links: [actByTitle[c.act]].filter(Boolean), subjects: [], extra: c.text });
    book.forEach((c, i) => lawItem(c, "Statute book for the simulator", "#/laws?tab=book", `book:${i}:${c.act}`));
    for (const x of read("atlas-drafts", []) as any[]) push({ key: `draft:${x.id}`, kind: "draft", title: x.title, sub: `${x.kind} · ${x.stage}${x.area ? ` · ${x.area}` : ""}`, href: `#/draft?open=${x.id}`, subjects: x.area ? [x.area] : [], extra: `${x.problem} ${x.objectives} ${x.notes}`,
      links: [...(x.amends ?? []).map((t: string) => actByTitle[t]).filter(Boolean), ...[...new Set((x.clauses ?? []).map((c: any) => c.lever).filter(Boolean))].map((k) => `lever:${k}`)] });
    for (const x of read("atlas-scenarios", []) as any[]) push({ key: `scenario:${x.name}`, kind: "scenario", title: x.name, sub: "Saved simulator scenario", href: scenarioLink(x), links: ["model:simulate", ...LEVERS.filter((l) => x.levers?.[l.k]).map((l) => `lever:${l.k}`)] });
    for (const x of read("atlas-campaigns", []) as any[]) { const L = x.turns?.at(-1)?.levers ?? {};
      (x.laws ?? []).forEach((c: any, i: number) => lawItem(c, `Campaign “${x.name}”`, `#/sandbox?g=${x.id}`, `${x.id}:${i}:${c.act}`));
      push({ key: `campaign:${x.id}`, kind: "campaign", title: x.name, sub: `${x.done ? "Finished" : "In progress"} · ${x.turns?.length ?? 0} budgets`, href: `#/sandbox?g=${x.id}`, links: ["model:sandbox", ...LEVERS.filter((l) => L[l.k]).map((l) => `lever:${l.k}`)] }); }
    return out;
  }, [d]);

  const byKey = useMemo(() => new Map((items ?? []).map((x) => [x.key, x])), [items]);
  const allItems = useMemo(() => [...(items ?? []), ...U.mine.map<Item>((m) => ({ key: `mine:${m.id}`, kind: "mine", title: m.title, sub: m.url, ext: m.url, subjects: [], links: [], hay: `${m.title} ${m.note ?? ""} ${m.url ?? ""}`.toLowerCase() }))], [items, U.mine]);
  const get = (k: string) => byKey.get(k) ?? allItems.find((x) => x.key === k);
  const filing = (k: string): Filing => U.items[k] ?? {};
  const file = (k: string, f: (x: Filing) => Filing) => setU((u) => { const n = f({ ...(u.items[k] ?? {}) }); const items = { ...u.items }; if (!n.cats?.length && !n.tags?.length && !n.note && !n.links?.length && !n.star) delete items[k]; else items[k] = n; return { ...u, items }; });
  const tags = useMemo(() => { const c: Record<string, number> = {}; Object.values(U.items).forEach((f) => f.tags?.forEach((t) => (c[t] = (c[t] ?? 0) + 1))); return Object.entries(c).sort((a, b) => b[1] - a[1]); }, [U.items]);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const r = allItems.filter((x) => {
      if (kinds.size && !kinds.has(x.kind)) return false;
      const f = U.items[x.key];
      if (filed && !f) return false;
      if (cat && !(cat === "*star" ? f?.star : f?.cats?.includes(cat))) return false;
      if (tag && !f?.tags?.includes(tag)) return false;
      if (subject && !x.subjects.includes(subject)) return false;
      const hay = f ? `${x.hay} ${(f.tags ?? []).join(" ")} ${f.note ?? ""}`.toLowerCase() : x.hay;
      return terms.every((t) => hay.includes(t));
    });
    const t0 = terms.join(" "); r.sort((a, b) => (t0 ? +b.title.toLowerCase().includes(t0) - +a.title.toLowerCase().includes(t0) : 0) || ORDER[a.kind] - ORDER[b.kind] || ((b.year ?? 0) - (a.year ?? 0)));
    return r;
  }, [allItems, q, kinds, cat, tag, subject, filed, U.items]);
  useEffect(() => setLimit(100), [q, kinds, cat, tag, subject, filed]);

  if (!items) return <Loading />;
  const kindCount = (k: Kind) => allItems.filter((x) => x.kind === k).length;
  const catCount = (id: string) => Object.values(U.items).filter((f) => f.cats?.includes(id)).length;
  const toggleKind = (k: Kind) => setKinds((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const subjects = [...AREAS, "Places and population", "Charities and civil society"];
  const S = sel ? get(sel) : null;

  return <Page title="Data hub" lede={<>One index of everything in the atlas: {kindCount("dataset")} datasets, {fmt.n(kindCount("act"))} Acts and {kindCount("bill")} bills, {kindCount("project")} major projects, {fmt.n(kindCount("org"))} government bodies, the models with their levers and parameters, and your own drafts, scenarios and campaigns. File anything into your own categories, tag it, annotate it and link it to anything else. Your filing is saved in this browser; export it to keep it.</>}
    right={<HubIO U={U} setU={setU} />}>
    <div className="hub">
      <aside className="card hub-side">
        <h4>My categories</h4>
        <NewCat onAdd={(name) => setU((u) => ({ ...u, cats: [...u.cats, { id: newId(), name, color: PALETTE[u.cats.length % PALETTE.length] }] }))} />
        <button className={`hub-f ${cat === "*star" ? "on" : ""}`} onClick={() => setCat(cat === "*star" ? null : "*star")}><span>★ Starred</span><span className="muted">{Object.values(U.items).filter((f) => f.star).length}</span></button>
        {U.cats.map((c) => <div key={c.id} className="hub-cat">
          <button className={`hub-f ${cat === c.id ? "on" : ""}`} onClick={() => setCat(cat === c.id ? null : c.id)}><span><i className="dot" style={{ background: c.color }} />{c.name}</span><span className="muted">{catCount(c.id)}</span></button>
          <button className="hub-x" title="Rename" onClick={() => { const n = prompt("Rename category", c.name); if (n?.trim()) setU((u) => ({ ...u, cats: u.cats.map((x) => x.id === c.id ? { ...x, name: n.trim() } : x) })); }}>✎</button>
          <button className="hub-x" title="Delete" onClick={() => { if (confirm(`Delete the category “${c.name}”? Items stay in the hub.`)) { setU((u) => ({ ...u, cats: u.cats.filter((x) => x.id !== c.id), items: Object.fromEntries(Object.entries(u.items).map(([k, f]) => [k, { ...f, cats: f.cats?.filter((x) => x !== c.id) }])) })); if (cat === c.id) setCat(null); } }}>×</button>
        </div>)}
        {U.cats.length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>Make categories for your own projects, such as “Housing white paper” or “Evidence on SEND”, then file any item into them.</div>}
        {tags.length > 0 && <><h4>Tags</h4><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{tags.map(([t, n]) => <button key={t} className={`seg ${tag === t ? "on" : ""}`} style={{ fontSize: 12, padding: "2px 8px" }} onClick={() => setTag(tag === t ? null : t)}>#{t} <span className="muted">{n}</span></button>)}</div></>}
        <h4>Subjects</h4>
        {subjects.map((s) => <button key={s} className={`hub-f ${subject === s ? "on" : ""}`} onClick={() => setSubject(subject === s ? null : s)}><span>{s}</span></button>)}
        <h4>Add your own item</h4>
        <NewMine onAdd={(m) => { setU((u) => ({ ...u, mine: [...u.mine, m] })); setSel(`mine:${m.id}`); }} />
      </aside>
      <div>
        <input type="search" className="hub-q" placeholder="Search datasets, Acts, bills, projects, bodies, levers, your drafts…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="hub-kinds">{KINDS.filter(([k]) => kindCount(k) > 0).map(([k, l]) => <button key={k} className={`seg ${kinds.has(k) ? "on" : ""}`} onClick={() => toggleKind(k)}>{l} <span className="muted">{fmt.n(kindCount(k))}</span></button>)}</div>
        <div className="controls" style={{ justifyContent: "space-between", margin: "8px 0" }}>
          <span className="muted" style={{ fontSize: 13 }}>{fmt.n(results.length)} item{results.length === 1 ? "" : "s"}{kinds.size || cat || tag || subject || filed ? <> · <a href="#/hub" onClick={(e) => { e.preventDefault(); setKinds(new Set()); setCat(null); setTag(null); setSubject(null); setFiled(false); }}>clear filters</a></> : null}</span>
          <span className="controls" style={{ margin: 0 }}>
            <label className="muted" style={{ fontSize: 13 }}><input type="checkbox" checked={filed} onChange={(e) => setFiled(e.target.checked)} /> Only items I've filed</label>
            {U.cats.length > 0 && results.length > 0 && results.length <= 500 && <select value="" onChange={(e) => { const id = e.target.value; if (!id) return; results.forEach((x) => file(x.key, (f) => ({ ...f, cats: [...new Set([...(f.cats ?? []), id])] }))); }}><option value="">File all {results.length} into…</option>{U.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          </span>
        </div>
        <div className="card" style={{ padding: 0 }}>
          {results.slice(0, limit).map((x) => { const f = U.items[x.key]; return <button key={x.key} className="hub-row" onClick={() => setSel(x.key)}>
            <span className={`pill k-${x.kind}`}>{KIND_LABEL[x.kind]}</span>
            <span className="hub-t"><b>{f?.star ? "★ " : ""}{x.title}</b>{x.sub && <span className="muted"> · {x.sub}</span>}</span>
            <span className="hub-m">{f?.cats?.map((id) => { const c = U.cats.find((y) => y.id === id); return c ? <i key={id} className="dot" title={c.name} style={{ background: c.color }} /> : null; })}{f?.tags?.slice(0, 3).map((t) => <span key={t} className="muted" style={{ fontSize: 11.5 }}>#{t}</span>)}</span>
          </button>; })}
          {results.length === 0 && <div className="muted" style={{ padding: 14 }}>Nothing matches.</div>}
          {results.length > limit && <button className="hub-row" style={{ justifyContent: "center" }} onClick={() => setLimit((l) => l + 200)}>Show more ({fmt.n(results.length - limit)} left)</button>}
        </div>
      </div>
    </div>
    {S && <Drawer onClose={() => setSel(null)}><Detail x={S} U={U} f={filing(S.key)} file={(fn) => file(S.key, fn)} get={get} open={setSel} all={allItems}
      backlinks={allItems.filter((y) => y.key !== S.key && (y.links.includes(S.key) || U.items[y.key]?.links?.includes(S.key)))}
      addCat={(name) => { const id = newId(); setU((u) => ({ ...u, cats: [...u.cats, { id, name, color: PALETTE[u.cats.length % PALETTE.length] }] })); return id; }}
      removeMine={S.kind === "mine" ? () => { setU((u) => ({ ...u, mine: u.mine.filter((m) => `mine:${m.id}` !== S.key) })); file(S.key, () => ({})); setSel(null); } : undefined} /></Drawer>}
  </Page>;
}

function Detail({ x, U, f, file, get, open, all, backlinks, addCat, removeMine }: { x: Item; U: HubUser; f: Filing; file: (fn: (f: Filing) => Filing) => void; get: (k: string) => Item | undefined; open: (k: string) => void; all: Item[]; backlinks: Item[]; addCat: (name: string) => string; removeMine?: () => void }) {
  const [tagIn, setTagIn] = useState("");
  const [linkQ, setLinkQ] = useState("");
  const mine = x.kind === "mine" ? U.mine.find((m) => `mine:${m.id}` === x.key) : null;
  const linkHits = useMemo(() => { const t = linkQ.toLowerCase().trim(); return t.length < 2 ? [] : all.filter((y) => y.key !== x.key && y.hay.includes(t)).slice(0, 8); }, [linkQ, all, x.key]);
  const auto = x.links.map(get).filter(Boolean) as Item[];
  const my = (f.links ?? []).map(get).filter(Boolean) as Item[];
  const addTag = () => { const t = tagIn.trim().replace(/^#/, "").toLowerCase(); if (t) file((g) => ({ ...g, tags: [...new Set([...(g.tags ?? []), t])] })); setTagIn(""); };
  const Row = ({ y, rm }: { y: Item; rm?: () => void }) => <div className="controls" style={{ margin: "2px 0", justifyContent: "space-between", flexWrap: "nowrap" }}><a href="#/hub" onClick={(e) => { e.preventDefault(); open(y.key); }} style={{ fontSize: 13 }}><span className={`pill k-${y.kind}`}>{KIND_LABEL[y.kind]}</span> {y.title}</a>{rm && <button className="hub-x" onClick={rm}>×</button>}</div>;
  return <div>
    <div className="muted" style={{ fontSize: 12 }}>{KIND_LABEL[x.kind]}</div>
    <h2 style={{ margin: "2px 0 4px" }}>{x.title}</h2>
    {x.sub && <div className="muted" style={{ fontSize: 13 }}>{x.sub}</div>}
    <div className="controls" style={{ margin: "10px 0" }}>
      {x.href && <a className="seg on" href={x.href} target={x.href.startsWith("#") ? undefined : "_blank"} rel="noreferrer">{x.kind === "dataset" ? "Download JSON" : "Open in the atlas"}</a>}
      {x.ext && <a className="seg" href={x.ext} target="_blank" rel="noreferrer">Source ↗</a>}
      <button className={`seg ${f.star ? "on" : ""}`} onClick={() => file((g) => ({ ...g, star: !g.star }))}>{f.star ? "★ Starred" : "☆ Star"}</button>
      <button className="seg" onClick={() => navigator.clipboard?.writeText(`${location.href.split("#")[0]}#/hub?item=${encodeURIComponent(x.key)}`)}>Copy link</button>
    </div>
    {x.subjects.length > 0 && <div className="muted" style={{ fontSize: 12.5 }}>Subjects: {x.subjects.join(", ")}</div>}
    {x.body && <div style={{ fontSize: 13.5, marginTop: 8 }}>{x.body}</div>}
    {mine && <p style={{ fontSize: 13.5 }}>{mine.note}</p>}

    <h4 style={{ marginTop: 16 }}>Filed under</h4>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {U.cats.map((c) => { const on = f.cats?.includes(c.id); return <button key={c.id} className={`seg ${on ? "on" : ""}`} onClick={() => file((g) => ({ ...g, cats: on ? g.cats?.filter((y) => y !== c.id) : [...(g.cats ?? []), c.id] }))}><i className="dot" style={{ background: c.color }} />{c.name}</button>; })}
      <button className="seg" onClick={() => { const n = prompt("New category"); if (n?.trim()) { const id = addCat(n.trim()); file((g) => ({ ...g, cats: [...(g.cats ?? []), id] })); } }}>+ New category</button>
    </div>
    <h4 style={{ marginTop: 14 }}>Tags</h4>
    <div className="controls" style={{ margin: 0 }}>{f.tags?.map((t) => <span key={t} className="pill">#{t} <button className="hub-x" onClick={() => file((g) => ({ ...g, tags: g.tags?.filter((y) => y !== t) }))}>×</button></span>)}
      <input value={tagIn} onChange={(e) => setTagIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }} onBlur={addTag} placeholder="Add a tag" style={{ width: 120 }} /></div>
    <h4 style={{ marginTop: 14 }}>Notes</h4>
    <textarea rows={4} value={f.note ?? ""} onChange={(e) => file((g) => ({ ...g, note: e.target.value }))} placeholder="Why this matters, what to check, where it fits in your argument" />

    <h4 style={{ marginTop: 14 }}>Linked items</h4>
    {my.map((y) => <Row key={y.key} y={y} rm={() => file((g) => ({ ...g, links: g.links?.filter((k) => k !== y.key) }))} />)}
    <input type="search" value={linkQ} onChange={(e) => setLinkQ(e.target.value)} placeholder="Link to another item: search" style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }} />
    {linkHits.map((y) => <div key={y.key}><a href="#/hub" style={{ fontSize: 13 }} onClick={(e) => { e.preventDefault(); file((g) => ({ ...g, links: [...new Set([...(g.links ?? []), y.key])] })); setLinkQ(""); }}>+ <span className={`pill k-${y.kind}`}>{KIND_LABEL[y.kind]}</span> {y.title}</a></div>)}
    {auto.length > 0 && <><h4 style={{ marginTop: 14 }}>Connected in the atlas</h4>{auto.map((y) => <Row key={y.key} y={y} />)}</>}
    {backlinks.length > 0 && <><h4 style={{ marginTop: 14 }}>Linked from</h4>{backlinks.slice(0, 40).map((y) => <Row key={y.key} y={y} />)}{backlinks.length > 40 && <div className="muted">and {backlinks.length - 40} more</div>}</>}
    {removeMine && <button className="seg" style={{ marginTop: 16 }} onClick={() => { if (confirm("Delete this item?")) removeMine(); }}>Delete this item</button>}
  </div>;
}

function NewCat({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  return <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }} className="controls" style={{ margin: "0 0 6px", flexWrap: "nowrap" }}><input value={v} onChange={(e) => setV(e.target.value)} placeholder="New category" style={{ flex: 1, minWidth: 0 }} /><button className="seg">Add</button></form>;
}
function NewMine({ onAdd }: { onAdd: (m: Mine) => void }) {
  const [t, setT] = useState(""), [u, setUrl] = useState(""), [n, setN] = useState("");
  return <form onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd({ id: newId(), title: t.trim(), url: u.trim() || undefined, note: n.trim() || undefined }); setT(""); setUrl(""); setN(""); } }} style={{ display: "grid", gap: 4 }}>
    <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Title: a report, a source, an idea" />
    <input value={u} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional)" />
    <textarea rows={2} value={n} onChange={(e) => setN(e.target.value)} placeholder="Note (optional)" />
    <button className="seg">Add to the hub</button>
  </form>;
}
function HubIO({ U, setU }: { U: HubUser; setU: (u: HubUser) => void }) {
  return <div className="controls" style={{ margin: 0 }}>
    <button className="seg" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(U, null, 1)], { type: "application/json" })); a.download = "atlas-hub.json"; a.click(); }}>Export my filing</button>
    <label className="seg" style={{ cursor: "pointer" }}>Import<input type="file" accept=".json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const x = JSON.parse(await f.text()); if (Array.isArray(x.cats) && x.items) { if (confirm("Merge this file into your hub? Matching categories and items are combined.")) setU({ cats: [...U.cats, ...x.cats.filter((c: Cat) => !U.cats.some((y) => y.id === c.id))], items: { ...x.items, ...Object.fromEntries(Object.entries(U.items).map(([k, v]) => [k, { ...x.items[k], ...v, cats: [...new Set([...(x.items[k]?.cats ?? []), ...(v.cats ?? [])])], tags: [...new Set([...(x.items[k]?.tags ?? []), ...(v.tags ?? [])])] }])) }, mine: [...U.mine, ...(x.mine ?? []).filter((m: Mine) => !U.mine.some((y) => y.id === m.id))] }); } } catch { alert("That file is not a hub export."); } }} /></label>
  </div>;
}
