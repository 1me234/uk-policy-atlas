import React, { useMemo, useState } from "react";
import { LEVERS, NumKey, YEARS } from "../sim/engine";
import { ACTION_LABEL, Action, ActEffects, cleanTitle, democracyAt, DIM_LABEL, Dim, effectOf, FORBIDDEN_NOTE, forbiddenText, inForceAt, isRepealedInLaw, Knock, LawChange, LawEffects, LeverMove, Power, powerLabel, statusAt, withChange } from "./statute";

const DIMS: Dim[] = ["legal", "fiscal", "diplomatic", "social"];
const leverLabel = (k: string) => LEVERS.find((l) => l.k === k)?.label ?? k;
const GROUPS = [...new Set(LEVERS.map((l) => l.group))];
const moveText = (m: LeverMove) => `${leverLabel(m.k)} ${m.v > 0 ? "+" : ""}${m.v}${m.years ? ` for ${m.years} years` : ""}${m.basis ? ` (${m.basis})` : ""}`;

export function KnockList({ knock }: { knock: Knock[] }) {
  return <div className="knock">{DIMS.filter((d) => knock.some((k) => k.dim === d)).map((d) => <div key={d} className={`knock-${d}`}>
    <div className="knock-h">{DIM_LABEL[d]}</div>{knock.filter((k) => k.dim === d).map((k, i) => <p key={i}>{k.text}</p>)}</div>)}</div>;
}

export function StatusPill({ s }: { s: string }) {
  return <span className={`pill law-${s.replace(" ", "")}`}>{s}</span>;
}

/** Democratic standing after the laws in force at year t. */
export function DemocracyMeter({ book, t, E, find, compact }: { book: LawChange[]; t: number; E: LawEffects; find: (t: string) => ActEffects | undefined; compact?: boolean }) {
  const { score, band } = democracyAt(book, t, E, find);
  const col = score >= 85 ? "var(--green)" : score >= 65 ? "var(--amber)" : "var(--red)";
  return <div title={E.democracy?.note} style={{ fontSize: compact ? 12 : 13, margin: "6px 0" }}>
    <div className="controls" style={{ margin: 0, justifyContent: "space-between" }}><span>Democratic standing</span><b style={{ color: col }}>{score} · {band}</b></div>
    <div style={{ height: 6, background: "var(--soft)", borderRadius: 3, overflow: "hidden", marginTop: 3 }}><div style={{ width: `${score}%`, height: "100%", background: col }} /></div>
    {!compact && E.democracy && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{E.democracy.note}</div>}
  </div>;
}

function ModelEffects({ levers, powers, democracy = 0, muted }: { levers: LeverMove[]; powers: Power[]; democracy?: number; muted?: boolean }) {
  if (!levers.length && !powers.length && !democracy) return null;
  return <div className={muted ? "muted" : "flag gap"} style={{ fontSize: 12.5 }}>
    {levers.length > 0 && <div>In the model: {levers.map(moveText).join("; ")}.</div>}
    {powers.length > 0 && <div>Powers: {powers.map(powerLabel).join("; ")}.</div>}
    {democracy !== 0 && <div>Democratic standing {democracy > 0 ? "+" : ""}{democracy} while in force.</div>}
  </div>;
}

/** The player's own lever moves and powers for a law change. Any lever, any size. */
function OwnEffects({ custom, setCustom, powers, setPowers }: { custom: LeverMove[]; setCustom: (x: LeverMove[]) => void; powers: Power[]; setPowers: (x: Power[]) => void }) {
  const sel = { fontSize: 12.5, maxWidth: 210 } as const, num = { width: 70 } as const;
  return <div style={{ display: "grid", gap: 6, fontSize: 12.5 }}>
    <div className="muted">Set what this law does in the model. Lever moves add to your budget from the year the change takes effect; powers let you push levers further than normal while the law is in force.</div>
    {custom.map((m, i) => { const up = (f: Partial<LeverMove>) => setCustom(custom.map((x, j) => j === i ? { ...x, ...f } : x)); const l = LEVERS.find((x) => x.k === m.k);
      return <div key={i} className="controls" style={{ margin: 0, flexWrap: "wrap" }}>
        <select value={m.k} onChange={(e) => up({ k: e.target.value as NumKey })} style={sel}>{LEVERS.map((x) => <option key={x.k} value={x.k}>{x.label} ({x.unit})</option>)}</select>
        <input type="number" value={m.v} step={l?.step ?? 1} onChange={(e) => up({ v: +e.target.value })} style={num} aria-label="Amount" />
        <label className="muted">for <input type="number" min={0} value={m.years ?? 0} onChange={(e) => up({ years: +e.target.value || undefined })} style={{ width: 48 }} /> yrs (0 = for good)</label>
        <button className="hub-x" title="Remove" onClick={() => setCustom(custom.filter((_, j) => j !== i))}>×</button></div>; })}
    {powers.map((p, i) => { const up = (f: Partial<Power>) => setPowers(powers.map((x, j) => j === i ? { ...x, ...f, label: undefined } : x));
      const target = p.all ? "*" : p.k ? `k:${p.k}` : `g:${p.groups?.[0] ?? ""}`;
      return <div key={`p${i}`} className="controls" style={{ margin: 0, flexWrap: "wrap" }}>
        <span>Power over</span>
        <select value={target} style={sel} onChange={(e) => { const v = e.target.value; up(v === "*" ? { all: true, k: undefined, groups: undefined } : v.startsWith("g:") ? { all: undefined, k: undefined, groups: [v.slice(2)] } : { all: undefined, groups: undefined, k: v.slice(2) as NumKey }); }}>
          <option value="*">Every lever</option>
          <optgroup label="A group">{GROUPS.map((g) => <option key={g} value={`g:${g}`}>{g.split(" (")[0]}</option>)}</optgroup>
          <optgroup label="One lever">{LEVERS.map((x) => <option key={x.k} value={`k:${x.k}`}>{x.label}</option>)}</optgroup>
        </select>
        <label className="muted">range × <input type="number" min={1} step={0.5} value={p.scale ?? 1} onChange={(e) => up({ scale: +e.target.value || 1 })} style={{ width: 56 }} /></label>
        {p.k && <><label className="muted">min <input type="number" value={p.min ?? ""} onChange={(e) => up({ min: e.target.value === "" ? undefined : +e.target.value })} style={num} /></label>
          <label className="muted">max <input type="number" value={p.max ?? ""} onChange={(e) => up({ max: e.target.value === "" ? undefined : +e.target.value })} style={num} /></label></>}
        <button className="hub-x" title="Remove" onClick={() => setPowers(powers.filter((_, j) => j !== i))}>×</button></div>; })}
    <div className="controls" style={{ margin: 0 }}>
      <button className="seg" onClick={() => setCustom([...custom, { k: "otherDept", v: 1 }])}>+ Lever move</button>
      <button className="seg" onClick={() => setPowers([...powers, { all: true, scale: 2 }])}>+ Power</button>
    </div>
  </div>;
}

/** Repeal, amend or restore one Act. `fixedYear` locks the year (campaigns change law in the year being played). */
export function LawEditor({ title, url, E, fx, book, setBook, fixedYear, minYear = 0, onDone }: {
  title: string; url?: string; E: LawEffects; fx?: ActEffects; book: LawChange[]; setBook: (f: (b: LawChange[]) => LawChange[]) => void; fixedYear?: number; minYear?: number; onDone?: () => void;
}) {
  const act = cleanTitle(title);
  const [t, setT] = useState(fixedYear ?? minYear);
  const status = statusAt(title, book, YEARS.length, fx);
  const startsRepealed = isRepealedInLaw(title, fx);
  const isNew = !!fx?.new && !book.some((c) => c.act === act);
  const options: Action[] = isNew ? ["enact"] : status === "repealed" ? ["restore"] : ["repeal", "amend"];
  const [action, setAction] = useState<Action>(options[0]);
  const [option, setOption] = useState(fx?.amend?.[0]?.id ?? "");
  const [text, setText] = useState("");
  const [custom, setCustom] = useState<LeverMove[]>([]);
  const [powers, setPowers] = useState<Power[]>([]);
  const [own, setOwn] = useState(false);
  const draft: LawChange = { act, action, t, option: action === "amend" && option !== "free" ? option || undefined : undefined, text: action === "amend" && (option === "free" || !fx?.amend?.length) ? text : undefined,
    custom: custom.length ? custom : undefined, powers: powers.length ? powers : undefined };
  const preview = effectOf(draft, E, fx);
  const mine = book.filter((c) => c.act === act).sort((a, b) => a.t - b.t);
  const blocked = action === "amend" && forbiddenText(text);
  const find = (x: string) => E.acts.find((a) => a.title.toLowerCase() === cleanTitle(x).toLowerCase());
  const missing = action === "enact" || action === "restore" ? (fx?.requires ?? []).filter((r) => !inForceAt(r, book, t, find(r)) || statusAt(r, book, t, find(r)) === "repealed") : [];
  const canApply = !blocked && !missing.length && (action !== "amend" || !!draft.option || !!text.trim() || custom.length > 0 || powers.length > 0);
  return <div>
    <div className="muted" style={{ fontSize: 12 }}>{isNew ? "New Act (template)" : "Act of Parliament"} · <StatusPill s={isNew ? "not law" : status} />{startsRepealed && status === "repealed" && mine.length === 0 ? " in real life" : mine.length ? " in your statute book" : ""}</div>
    <h2 style={{ margin: "4px 0 6px" }}>{act}</h2>
    {fx?.summary && <p style={{ fontSize: 13.5 }}>{fx.summary}</p>}
    {fx?.supersededBy && (statusAt(fx.supersededBy, book, YEARS.length) === "repealed"
      ? <div className="flag" style={{ fontSize: 13 }}>You have repealed the {fx.supersededBy} in this statute book, so this Act's protections are not otherwise in force. Restoring it would bring them back, in its original, narrower form.</div>
      : <div className="flag gap" style={{ fontSize: 13 }}>Its protections now sit in the {fx.supersededBy}. Changing this Act on its own has little effect while that Act is in force.</div>)}
    {!isNew && <div className="controls" style={{ margin: "8px 0" }}>{url && <a className="seg" href={url} target="_blank" rel="noreferrer">Read it on legislation.gov.uk ↗</a>}<a className="seg" href={`#/draft?amend=${encodeURIComponent(act)}`}>Draft an amending bill</a></div>}

    {mine.length > 0 && <><h4>Your changes</h4>{mine.map((c, i) => { const e = effectOf(c, E, fx); return <div key={i} className="controls" style={{ margin: "3px 0", justifyContent: "space-between", flexWrap: "nowrap" }}>
      <span style={{ fontSize: 13 }}><b>{YEARS[c.t]}</b> · {e.label}</span>
      {(fixedYear == null || c.t === fixedYear) && <button className="hub-x" title="Remove this change" onClick={() => setBook((b) => b.filter((x) => x !== c))}>×</button>}</div>; })}</>}

    <h4 style={{ marginTop: 12 }}>{isNew ? "Pass this Act" : "Change this law"}</h4>
    <div className="controls" style={{ margin: "0 0 8px" }}>
      {options.map((a) => <button key={a} className={`seg ${action === a ? "on" : ""}`} onClick={() => setAction(a)}>{ACTION_LABEL[a]}</button>)}
      {fixedYear == null ? <label className="muted">from <select value={t} onChange={(e) => setT(+e.target.value)}>{YEARS.map((y, i) => i >= minYear && <option key={y} value={i}>{y}</option>)}</select></label> : <span className="muted">from {YEARS[fixedYear]}</span>}
    </div>
    {action === "amend" && <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
      {!!fx?.amend?.length && <select value={option} onChange={(e) => setOption(e.target.value)}>{fx.amend.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}<option value="free">Something else: describe it</option></select>}
      {(option === "free" || !fx?.amend?.length) && <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the amendment does, for example: remove section 149" />}
      {blocked && <div className="flag" style={{ fontSize: 12.5 }}>{FORBIDDEN_NOTE}</div>}
    </div>}
    <button className="lever-group" onClick={() => setOwn(!own)} aria-expanded={own}><span>{own ? "▾" : "▸"} Your own effects and powers</span>{custom.length + powers.length > 0 && <span className="pill">{custom.length + powers.length}</span>}</button>
    {own && <div style={{ margin: "6px 0 10px" }}><OwnEffects custom={custom} setCustom={setCustom} powers={powers} setPowers={setPowers} /></div>}
    <div className="muted" style={{ fontSize: 12, margin: "8px 0 4px" }}>What follows{fx ? "" : " (this Act has no specific knock-ons in the atlas yet, so these are general)"}:</div>
    <KnockList knock={preview.knock} />
    <ModelEffects levers={preview.levers} powers={preview.powers} democracy={preview.democracy} />
    {missing.length > 0 && <div className="flag" style={{ fontSize: 12.5 }}>The Lords would block this: first pass the {missing.join(" and the ")}{fixedYear == null ? ` in or before ${YEARS[t]}` : " in an earlier or this year"}.</div>}
    <button className="seg on" style={{ marginTop: 10 }} disabled={!canApply} onClick={() => { setBook((b) => withChange(b, draft)); onDone?.(); }}>{ACTION_LABEL[action]} {fixedYear == null ? `from ${YEARS[t]}` : "this year"}</button>
  </div>;
}

/** Write and pass a new Act of your own, or one of the atlas's template Acts. */
export function NewLaw({ E, book, setBook, fixedYear, onDone, onTemplate }: { E: LawEffects; book: LawChange[]; setBook: (f: (b: LawChange[]) => LawChange[]) => void; fixedYear?: number; onDone?: () => void; onTemplate?: (title: string) => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [t, setT] = useState(fixedYear ?? 0);
  const [custom, setCustom] = useState<LeverMove[]>([]);
  const [powers, setPowers] = useState<Power[]>([]);
  const templates = E.acts.filter((a) => a.new);
  const name = title.trim() || "Untitled Act";
  const blocked = forbiddenText(`${title} ${text}`);
  const draft: LawChange = { act: name, action: "enact", t: fixedYear ?? t, text: text.trim() || undefined, custom: custom.length ? custom : undefined, powers: powers.length ? powers : undefined };
  const preview = effectOf(draft, E);
  const taken = book.some((c) => c.act === name);
  return <div style={{ fontSize: 13 }}>
    {templates.length > 0 && onTemplate && <><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Template Acts: new powers, and democratic backsliding:</div>
      <div className="controls" style={{ margin: "0 0 8px" }}>{templates.map((a) => <button key={a.title} className="seg" style={{ fontSize: 11.5, padding: "2px 7px" }} title={a.summary} onClick={() => onTemplate(a.title)}>{a.title}</button>)}</div></>}
    <div style={{ display: "grid", gap: 6 }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title, e.g. National Infrastructure Act 2027" />
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the Act does, in a sentence or two" />
      {fixedYear == null && <label className="muted">In force from <select value={t} onChange={(e) => setT(+e.target.value)}>{YEARS.map((y, i) => <option key={y} value={i}>{y}</option>)}</select></label>}
      <OwnEffects custom={custom} setCustom={setCustom} powers={powers} setPowers={setPowers} />
      {blocked && <div className="flag" style={{ fontSize: 12.5 }}>{FORBIDDEN_NOTE}</div>}
      <ModelEffects levers={preview.levers} powers={preview.powers} />
      {taken && <div className="muted" style={{ fontSize: 12 }}>An Act with this title is already in your statute book; passing it again replaces its changes from that year.</div>}
      <button className="seg on" disabled={blocked || !title.trim()} onClick={() => { setBook((b) => withChange(b, draft)); setTitle(""); setText(""); setCustom([]); setPowers([]); onDone?.(); }}>Enact {fixedYear == null ? `from ${YEARS[t]}` : "this year"}</button>
    </div>
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
        <button className="hub-f" onClick={() => setOpen(open === i ? null : i)} style={{ flex: 1 }}><span><b>{YEARS[c.t]}</b> · <span className={`pill law-${c.action}`}>{ACTION_LABEL[c.action]}</span> {c.act}{c.action === "amend" ? <span className="muted"> · {e.label}</span> : null}{e.powers.length > 0 && <span className="pill" style={{ marginLeft: 4 }}>powers</span>}</span><span className="muted">{open === i ? "▾" : "▸"}</span></button>
        {setBook && can && <button className="hub-x" title="Remove" onClick={() => setBook((b) => b.filter((x) => x !== c))}>×</button>}
      </div>
      {open === i && <div style={{ padding: "4px 6px 8px" }}>{c.action === "enact" && c.text && <p style={{ fontSize: 13, margin: "0 0 6px" }}>{c.text}</p>}<KnockList knock={e.knock} /><ModelEffects levers={e.levers} powers={e.powers} democracy={e.democracy} muted /></div>}
    </div>; })}</div>;
}

/** Find an Act by title (for the campaign's law panel). Template Acts are included. */
export function ActSearch({ acts, onPick, extra = [] }: { acts: { t: string; y: number }[]; onPick: (t: string) => void; extra?: string[] }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => { const s = q.toLowerCase().trim(); return s.length < 3 ? [] : [...extra.map((t) => ({ t, y: 9999 })), ...acts].filter((a) => a.t.toLowerCase().includes(s)).sort((a, b) => b.y - a.y).slice(0, 8); }, [q, acts, extra]);
  return <div><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an Act, e.g. Equality Act" style={{ width: "100%", boxSizing: "border-box" }} />
    {hits.map((a) => <div key={a.t}><a href="#/sandbox" style={{ fontSize: 13 }} onClick={(e) => { e.preventDefault(); onPick(a.t); setQ(""); }}>{a.t}</a></div>)}</div>;
}
