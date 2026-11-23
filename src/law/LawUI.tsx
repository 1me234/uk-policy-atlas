import React, { useMemo, useState } from "react";
import { LEVERS, YEARS } from "../sim/engine";
import { ACTION_LABEL, Action, ActEffects, cleanTitle, DIM_LABEL, Dim, effectOf, isRepealedInLaw, Knock, LawChange, LawEffects, statusAt, withChange } from "./statute";

const DIMS: Dim[] = ["legal", "fiscal", "diplomatic", "social"];
const leverLabel = (k: string) => LEVERS.find((l) => l.k === k)?.label ?? k;

export function KnockList({ knock }: { knock: Knock[] }) {
  return <div className="knock">{DIMS.filter((d) => knock.some((k) => k.dim === d)).map((d) => <div key={d} className={`knock-${d}`}>
    <div className="knock-h">{DIM_LABEL[d]}</div>{knock.filter((k) => k.dim === d).map((k, i) => <p key={i}>{k.text}</p>)}</div>)}</div>;
}

export function StatusPill({ s }: { s: string }) {
  return <span className={`pill law-${s.replace(" ", "")}`}>{s}</span>;
}

/** Repeal, amend or restore one Act. `fixedYear` locks the year (campaigns change law in the year being played). */
export function LawEditor({ title, url, E, fx, book, setBook, fixedYear, minYear = 0, onDone }: {
  title: string; url?: string; E: LawEffects; fx?: ActEffects; book: LawChange[]; setBook: (f: (b: LawChange[]) => LawChange[]) => void; fixedYear?: number; minYear?: number; onDone?: () => void;
}) {
  const act = cleanTitle(title);
  const [t, setT] = useState(fixedYear ?? minYear);
  const status = statusAt(title, book, YEARS.length, fx);
  const startsRepealed = isRepealedInLaw(title, fx);
  const options: Action[] = status === "repealed" ? ["restore"] : ["repeal", "amend"];
  const [action, setAction] = useState<Action>(options[0]);
  const [option, setOption] = useState(fx?.amend?.[0]?.id ?? "");
  const [text, setText] = useState("");
  const draft: LawChange = { act, action, t, option: action === "amend" && option !== "free" ? option || undefined : undefined, text: action === "amend" && (option === "free" || !fx?.amend?.length) ? text : undefined };
  const preview = effectOf(draft, E, fx);
  const mine = book.filter((c) => c.act === act).sort((a, b) => a.t - b.t);
  const canApply = action !== "amend" || !!draft.option || !!text.trim();
  return <div>
    <div className="muted" style={{ fontSize: 12 }}>Act of Parliament · <StatusPill s={status} />{startsRepealed && status === "repealed" && mine.length === 0 ? " in real life" : mine.length ? " in your statute book" : ""}</div>
    <h2 style={{ margin: "4px 0 6px" }}>{act}</h2>
    {fx?.summary && <p style={{ fontSize: 13.5 }}>{fx.summary}</p>}
    {fx?.supersededBy && (statusAt(fx.supersededBy, book, YEARS.length) === "repealed"
      ? <div className="flag" style={{ fontSize: 13 }}>You have repealed the {fx.supersededBy} in this statute book, so this Act's protections are not otherwise in force. Restoring it would bring them back, in its original, narrower form.</div>
      : <div className="flag gap" style={{ fontSize: 13 }}>Its protections now sit in the {fx.supersededBy}. Changing this Act on its own has little effect while that Act is in force.</div>)}
    <div className="controls" style={{ margin: "8px 0" }}>{url && <a className="seg" href={url} target="_blank" rel="noreferrer">Read it on legislation.gov.uk ↗</a>}<a className="seg" href={`#/draft?amend=${encodeURIComponent(act)}`}>Draft an amending bill</a></div>

    {mine.length > 0 && <><h4>Your changes</h4>{mine.map((c, i) => { const e = effectOf(c, E, fx); return <div key={i} className="controls" style={{ margin: "3px 0", justifyContent: "space-between", flexWrap: "nowrap" }}>
      <span style={{ fontSize: 13 }}><b>{YEARS[c.t]}</b> · {e.label}</span>
      {(fixedYear == null || c.t === fixedYear) && <button className="hub-x" title="Remove this change" onClick={() => setBook((b) => b.filter((x) => x !== c))}>×</button>}</div>; })}</>}

    <h4 style={{ marginTop: 12 }}>Change this law</h4>
    <div className="controls" style={{ margin: "0 0 8px" }}>
      {options.map((a) => <button key={a} className={`seg ${action === a ? "on" : ""}`} onClick={() => setAction(a)}>{ACTION_LABEL[a]}</button>)}
      {fixedYear == null ? <label className="muted">from <select value={t} onChange={(e) => setT(+e.target.value)}>{YEARS.map((y, i) => i >= minYear && <option key={y} value={i}>{y}</option>)}</select></label> : <span className="muted">from {YEARS[fixedYear]}</span>}
    </div>
    {action === "amend" && <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
      {!!fx?.amend?.length && <select value={option} onChange={(e) => setOption(e.target.value)}>{fx.amend.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}<option value="free">Something else: describe it</option></select>}
      {(option === "free" || !fx?.amend?.length) && <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the amendment does, for example: remove section 149" />}
    </div>}
    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>What follows{fx ? "" : " (this Act has no specific knock-ons in the atlas yet, so these are general)"}:</div>
    <KnockList knock={preview.knock} />
    {preview.levers.length > 0 && <div className="flag gap" style={{ fontSize: 12.5 }}>In the model: {preview.levers.map((m) => `${leverLabel(m.k)} ${m.v > 0 ? "+" : ""}${m.v}${m.years ? ` for ${m.years} years` : ""}${m.basis ? ` (${m.basis})` : ""}`).join("; ")}.</div>}
    <button className="seg on" style={{ marginTop: 10 }} disabled={!canApply} onClick={() => { setBook((b) => withChange(b, draft)); onDone?.(); }}>{ACTION_LABEL[action]} {fixedYear == null ? `from ${YEARS[t]}` : "this year"}</button>
  </div>;
}

/** Every change in a book, with its knock-ons. */
export function LawChanges({ book, E, find, setBook, upTo, editable = true }: { book: LawChange[]; E: LawEffects; find: (t: string) => ActEffects | undefined; setBook?: (f: (b: LawChange[]) => LawChange[]) => void; upTo?: number; editable?: boolean | ((c: LawChange) => boolean) }) {
  const [open, setOpen] = useState<number | null>(null);
  const rows = useMemo(() => [...book].filter((c) => upTo == null || c.t <= upTo).sort((a, b) => a.t - b.t), [book, upTo]);
  if (!rows.length) return <div className="muted" style={{ fontSize: 13 }}>No laws changed.</div>;
  return <div>{rows.map((c, i) => { const e = effectOf(c, E, find(c.act)); const can = typeof editable === "function" ? editable(c) : editable;
    return <div key={i} className="law-row">
      <div className="controls" style={{ margin: 0, justifyContent: "space-between", flexWrap: "nowrap" }}>
        <button className="hub-f" onClick={() => setOpen(open === i ? null : i)} style={{ flex: 1 }}><span><b>{YEARS[c.t]}</b> · <span className={`pill law-${c.action}`}>{ACTION_LABEL[c.action]}</span> {c.act}{c.action === "amend" ? <span className="muted"> · {e.label}</span> : null}</span><span className="muted">{open === i ? "▾" : "▸"}</span></button>
        {setBook && can && <button className="hub-x" title="Remove" onClick={() => setBook((b) => b.filter((x) => x !== c))}>×</button>}
      </div>
      {open === i && <div style={{ padding: "4px 6px 8px" }}><KnockList knock={e.knock} />{e.levers.length > 0 && <div className="muted" style={{ fontSize: 12 }}>In the model: {e.levers.map((m) => `${leverLabel(m.k)} ${m.v > 0 ? "+" : ""}${m.v}${m.years ? ` for ${m.years} years` : ""}`).join("; ")}.</div>}</div>}
    </div>; })}</div>;
}

/** Find an Act by title (for the campaign's law panel). */
export function ActSearch({ acts, onPick }: { acts: { t: string; y: number }[]; onPick: (t: string) => void }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => { const s = q.toLowerCase().trim(); return s.length < 3 ? [] : acts.filter((a) => a.t.toLowerCase().includes(s)).sort((a, b) => b.y - a.y).slice(0, 8); }, [q, acts]);
  return <div><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an Act, e.g. Equality Act" style={{ width: "100%", boxSizing: "border-box" }} />
    {hits.map((a) => <div key={a.t}><a href="#/sandbox" style={{ fontSize: 13 }} onClick={(e) => { e.preventDefault(); onPick(a.t); setQ(""); }}>{a.t}</a></div>)}</div>;
}
