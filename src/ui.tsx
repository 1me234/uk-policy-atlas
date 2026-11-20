import React, { useMemo, useState } from "react";

export function Page({ title, lede, children, right }: { title: string; lede?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return <div><div className="page-head"><div><h1>{title}</h1>{lede && <div className="lede">{lede}</div>}</div>{right}</div>{children}</div>;
}
export function Card({ title, sub, children, source, style }: { title?: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; source?: Src | Src[]; style?: React.CSSProperties }) {
  return <div className="card" style={style}>{title && <h2>{title}</h2>}{sub && <div className="sub">{sub}</div>}{children}{source && <Source s={source} />}</div>;
}
export type Src = { name: string; url?: string; file?: string; note?: string };
export function Source({ s }: { s: Src | Src[] }) {
  const list = Array.isArray(s) ? s : [s];
  return <div className="src">Source: {list.map((x, i) => <span key={i}>{i > 0 && "; "}{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.name}</a> : x.name}{x.file && <> (<a href={x.file} target="_blank" rel="noreferrer">file</a>)</>}</span>)}{list.some((x) => x.note) && <div>{list.map((x) => x.note).filter(Boolean).join(" ")}</div>}</div>;
}
export function Stat({ v, l, d, color }: { v: React.ReactNode; l: React.ReactNode; d?: React.ReactNode; color?: string }) {
  return <div className="card stat"><div className="v" style={{ color }}>{v}</div><div className="l">{l}</div>{d && <div className="d muted">{d}</div>}</div>;
}
export function Pill({ v }: { v?: string | null }) {
  if (!v) return <span className="pill">–</span>;
  const k = v.startsWith("Exempt") ? "Exempt" : v;
  return <span className={`pill ${k}`} title={v}>{k.length > 14 ? k.slice(0, 14) + "…" : k}</span>;
}
export type Col<T> = { k: string; h: string; v: (r: T) => any; f?: (r: T) => React.ReactNode; n?: boolean; w?: number };
export function Table<T>({ rows, cols, onRow, initial, max = 400 }: { rows: T[]; cols: Col<T>[]; onRow?: (r: T) => void; initial?: string; max?: number }) {
  const [sk, setSk] = useState(initial ?? cols[0].k);
  const [dir, setDir] = useState(-1);
  const sorted = useMemo(() => {
    const c = cols.find((c) => c.k === sk)!;
    return [...rows].sort((a, b) => { const x = c.v(a), y = c.v(b); if (x == null || x === "") return 1; if (y == null || y === "") return -1; return x > y ? dir : x < y ? -dir : 0; });
  }, [rows, sk, dir]);
  return <div className="scroll"><table><thead><tr>{cols.map((c) => <th key={c.k} className={c.n ? "n" : ""} style={{ width: c.w }} onClick={() => { if (c.k === sk) setDir(-dir); else { setSk(c.k); setDir(c.n ? -1 : 1); } }}>{c.h}{sk === c.k ? (dir < 0 ? " ↓" : " ↑") : ""}</th>)}</tr></thead>
    <tbody>{sorted.slice(0, max).map((r, i) => <tr key={i} className={onRow ? "click" : ""} onClick={() => onRow?.(r)}>{cols.map((c) => <td key={c.k} className={c.n ? "n" : ""}>{c.f ? c.f(r) : c.v(r)}</td>)}</tr>)}</tbody></table>
    {sorted.length > max && <div className="muted" style={{ padding: 8 }}>Showing {max} of {sorted.length.toLocaleString()} rows. Narrow with search or sort.</div>}</div>;
}
export function Seg<T extends string>({ opts, v, set }: { opts: [T, string][]; v: T; set: (x: T) => void }) {
  return <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>{opts.map(([k, l]) => <button key={k} className={`seg ${v === k ? "on" : ""}`} onClick={() => set(k)}>{l}</button>)}</span>;
}
export function Drawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return <div className="drawer"><button className="x" onClick={onClose} aria-label="Close">×</button>{children}</div>;
}
export function Loading() { return <div className="loading">Loading data…</div>; }
export function Bar({ v, max, color }: { v: number; max: number; color?: string }) {
  return <div className="bar"><span style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} /></div>;
}
