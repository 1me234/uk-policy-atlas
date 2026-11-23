// The statute book as the player changes it: repeal, amend, restore or enact any Act from a given year.
//
// A change can carry knock-ons (legal, fiscal, diplomatic, social), moves to any simulator lever, and powers that
// widen how far levers can go, in the manner of a grand strategy game's national laws. Players can add their own
// effects and powers to any change. The one limit: the atlas does not model stripping citizenship or residence by
// ethnicity, or sterilisation or eugenics, so no Act can be enacted or amended to do those things.
import { useMemo, useEffect, useState } from "react";
import { useData } from "../lib";
import { LEVERS, LeverDef, Levers, NumKey, YEARS, ZERO } from "../sim/engine";
import { simulateSchedule, Turn } from "../sim/campaign";
import type { Baseline, Result } from "../sim/engine";
import type { ParamValues } from "../sim/params";

export type Action = "repeal" | "amend" | "restore" | "enact";
export type LeverMove = { k: NumKey; v: number; years?: number; basis?: string };
/** Widens lever ranges: one lever (k), whole groups, or all levers; by a scale factor and/or to explicit limits. */
export type Power = { k?: NumKey; groups?: string[]; all?: boolean; scale?: number; min?: number; max?: number; label?: string };
export type LawChange = { act: string; action: Action; t: number; option?: string; text?: string; at?: string; custom?: LeverMove[]; powers?: Power[] };
export type Dim = "legal" | "fiscal" | "diplomatic" | "social";
export type Knock = { dim: Dim; text: string };
type Effect = { knock: Knock[]; levers?: LeverMove[]; powers?: Power[]; democracy?: number };
type AmendOption = Effect & { id: string; label: string };
export type ActEffects = { title: string; summary?: string; status?: "repealed"; new?: boolean; requires?: string[]; supersededBy?: string; repeal?: Effect; amend?: AmendOption[]; restore?: Effect; enact?: Effect };
export type LawEffects = { note: string; generic: Record<Action, Knock[]>; acts: ActEffects[]; democracy?: { note: string; bands: [number, string][] } };

export const DIM_LABEL: Record<Dim, string> = { legal: "Legal", fiscal: "Fiscal", diplomatic: "Diplomatic", social: "Social" };
export const ACTION_LABEL: Record<Action, string> = { repeal: "Repeal", amend: "Amend", restore: "Restore", enact: "Enact" };

const isLever = (k: string) => LEVERS.some((l) => l.k === k);
// The one thing no law in the atlas can do. Checked on the text of new Acts and amendments the player writes.
const TARGET = /(citizen|nationalit|residen(ce|cy)|right to reside|deport|expel|expul|repatriat|remigrat|denaturali|leave to remain|settled status)/i;
const BY_GROUP = /(ethnic|\brace\b|racial|skin colou?r|national origin|ancestr|descent|religio|muslim|jew|hindu|sikh|black|white|asian|african)/i;
export const forbiddenText = (s: string) => /steril|eugenic/i.test(s) || (TARGET.test(s) && BY_GROUP.test(s));
export const FORBIDDEN_NOTE = "The atlas doesn't model stripping citizenship or residence by ethnicity, or sterilisation or eugenics, so a law can't be written to do those. Everything else is open.";

export const cleanTitle = (t: string) => t.replace(/\s*\((repealed|Repealed)\)\s*$/, "").trim();
export const isRepealedInLaw = (title: string, fx?: ActEffects) => /\(repealed\)/i.test(title) || fx?.status === "repealed";

export function useLawEffects() {
  const d = useData<LawEffects>("law_effects");
  return useMemo(() => {
    if (!d) return null;
    const E = d[0];
    const by = new Map(E.acts.map((a) => [a.title.toLowerCase(), a]));
    return { E, find: (title: string) => by.get(cleanTitle(title).toLowerCase()) };
  }, [d]);
}

/** What a change does: its knock-ons, lever moves and powers, including the player's own. */
export function effectOf(c: LawChange, E: LawEffects, fx?: ActEffects): { knock: Knock[]; levers: LeverMove[]; powers: Power[]; democracy: number; label: string } {
  let eff: Effect | undefined, label: string = c.action === "enact" ? `Enact: ${c.act}` : ACTION_LABEL[c.action];
  if (c.action === "amend") {
    const o = fx?.amend?.find((x) => x.id === c.option);
    if (o) { eff = o; label = o.label; } else label = c.text ? `Amend: ${c.text.slice(0, 80)}${c.text.length > 80 ? "…" : ""}` : "Amend";
  } else eff = fx?.[c.action] ?? (c.action === "restore" && fx?.new ? fx.enact : undefined);
  const knock = eff?.knock?.length ? eff.knock : E.generic[c.action] ?? [];
  const levers = [...(eff?.levers ?? []), ...(c.custom ?? [])].filter((m) => isLever(m.k) && Number.isFinite(m.v) && m.v !== 0);
  const powers = [...(eff?.powers ?? []), ...(c.powers ?? [])];
  return { knock, levers, powers, democracy: eff?.democracy ?? 0, label };
}

export const powerLabel = (p: Power) => p.label ?? `${p.all ? "Every lever" : p.k ? LEVERS.find((l) => l.k === p.k)?.label ?? p.k : (p.groups ?? []).join(", ")}${p.scale ? ` ×${p.scale}` : ""}${p.min != null ? `, down to ${p.min}` : ""}${p.max != null ? `, up to ${p.max}` : ""}`;

/** The changes in force at year t: for each Act, its latest change on or before t (an Act's effects end when it is changed again). */
function liveAt(book: LawChange[], t: number): LawChange[] {
  const last = new Map<string, LawChange>();
  for (const c of [...book].filter((c) => c.t <= t).sort((a, b) => a.t - b.t)) last.set(c.act, c);
  return [...last.values()];
}

/** Whether an Act is law at year t. Template Acts are law only once enacted. */
export function inForceAt(title: string, book: LawChange[], t: number, fx?: ActEffects): boolean {
  if (fx?.new) { const c = liveAt(book, t).find((x) => x.act === cleanTitle(title)); return !!c && c.action !== "repeal"; }
  return statusAt(title, book, t, fx) !== "repealed";
}

/** Democratic standing at year t: 100 less the cost of each backsliding change in force. */
export function democracyAt(book: LawChange[], t: number, E: LawEffects, find: (t: string) => ActEffects | undefined): { score: number; band: string } {
  const score = Math.max(0, Math.min(100, 100 + liveAt(book, t).reduce((a, c) => a + effectOf(c, E, find(c.act)).democracy, 0)));
  const band = (E.democracy?.bands ?? [[0, ""]]).find(([min]) => score >= min)?.[1] ?? "";
  return { score, band };
}

const NO_POWER: string[] = ["deprivation"];

/** Lever limits at year t, after the powers granted by laws in force. */
export function boundsAt(book: LawChange[], t: number, E?: LawEffects, find?: (t: string) => ActEffects | undefined): (l: LeverDef) => { min: number; max: number } {
  const ps = E ? liveAt(book, t).flatMap((c) => effectOf(c, E, find?.(c.act)).powers) : [];
  return (l) => {
    let min = l.min, max = l.max;
    // Choice levers (a fixed list of options) and citizenship deprivation keep their limits whatever the law says
    if ((l as { opts?: string[] }).opts || NO_POWER.includes(l.k)) return { min, max };
    for (const p of ps) {
      if (!(p.all || p.k === l.k || p.groups?.includes(l.group))) continue;
      if (p.scale && p.scale > 1) { min = Math.min(min, l.min * p.scale); max = Math.max(max, l.max * p.scale); }
      if (p.min != null) min = Math.min(min, p.min);
      if (p.max != null) max = Math.max(max, p.max);
    }
    return { min, max };
  };
}

/** Status of an Act after the player's changes up to (and including) year t. */
export function statusAt(title: string, changes: LawChange[], t: number, fx?: ActEffects): "in force" | "repealed" | "amended" {
  let s: "in force" | "repealed" | "amended" = isRepealedInLaw(title, fx) ? "repealed" : "in force";
  for (const c of [...changes].filter((c) => c.act === cleanTitle(title) && c.t <= t).sort((a, b) => a.t - b.t)) s = c.action === "repeal" ? "repealed" : c.action === "restore" ? "in force" : "amended";
  return s;
}

/** Fold law changes into a schedule of turns: each change's lever moves apply from its year, for its duration. */
export function lawTurns(turns: Turn[], changes: LawChange[], E: LawEffects, find: (t: string) => ActEffects | undefined): Turn[] {
  const next = (c: LawChange) => Math.min(Infinity, ...changes.filter((x) => x.act === c.act && x.t > c.t).map((x) => x.t));
  const segs = changes.flatMap((c) => effectOf(c, E, find(c.act)).levers.map((m) => ({ from: c.t, to: Math.min(m.years ? c.t + m.years : Infinity, next(c)), k: m.k, v: m.v })));
  if (!segs.length) return turns;
  const sorted = [...turns].sort((a, b) => a.t - b.t);
  const pts = [...new Set([...sorted.map((x) => x.t), ...segs.map((s) => s.from), ...segs.filter((s) => s.to < YEARS.length).map((s) => s.to)])].sort((a, b) => a - b);
  return pts.map((p) => {
    const base = [...sorted].reverse().find((x) => x.t <= p);
    const L: Levers = { ...ZERO, ...(base?.levers ?? {}) };
    for (const s of segs) if (s.from <= p && p < s.to) (L as any)[s.k] = ((L as any)[s.k] ?? 0) + s.v;
    return { t: p, levers: L };
  });
}

// The player's own statute book for the simulator, kept in this browser. Campaigns keep their own.
const LS = "atlas-statute";
export const readBook = (): LawChange[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };
export function useBook(): [LawChange[], (f: (b: LawChange[]) => LawChange[]) => void] {
  const [b, setB] = useState<LawChange[]>(readBook);
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(b)); } catch {} }, [b]);
  useEffect(() => { const f = (e: StorageEvent) => { if (e.key === LS) setB(readBook()); }; addEventListener("storage", f); return () => removeEventListener("storage", f); }, []);
  return [b, setB];
}
/** Put a change in a book: one change per Act and year; a change that undoes the Act's state removes earlier ones. */
export function withChange(book: LawChange[], c: LawChange): LawChange[] {
  // Restoring an Act you wrote brings back the effects and powers it was enacted with
  const prior = c.action === "restore" && !c.custom && !c.powers ? [...book].filter((x) => x.act === c.act && x.action === "enact" && x.t < c.t).sort((a, b) => b.t - a.t)[0] : undefined;
  return [...book.filter((x) => !(x.act === c.act && x.t >= c.t)), { ...c, ...(prior ? { custom: prior.custom, powers: prior.powers, text: prior.text } : {}), at: new Date().toISOString() }];
}

/** Run a schedule with the statute book applied, adding a news item for each change in the year it takes effect. */
export function runWithLaws(B: Baseline, turns: Turn[], P: ParamValues, book: LawChange[], E: LawEffects, find: (t: string) => ActEffects | undefined, base?: Result): Result {
  const R = simulateSchedule(B, lawTurns(turns, book, E, find), P, base);
  if (!book.length) return R;
  const ev = book.map((c) => { const e = effectOf(c, E, find(c.act)); const k = e.knock.find((x) => x.dim === "legal") ?? e.knock[0];
    return { t: c.t, tone: (c.action === "restore" || c.action === "enact" ? "good" : "info") as "good" | "info", area: "Law", text: `${c.action === "amend" ? e.label.replace(/^Amend: /, "Amended: ") + ` (${c.act})` : `${{ repeal: "Repealed", restore: "Restored", enact: "Enacted" }[c.action]}: ${c.act}`}. ${k ? k.text.split(/(?<=\.)\s/)[0] : ""}${e.powers.length ? ` New powers: ${e.powers.map(powerLabel).join("; ")}.` : ""}` }; });
  return { ...R, events: [...R.events, ...ev].sort((a, b) => a.t - b.t) };
}
