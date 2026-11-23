// The statute book as the player changes it: repeal, amend or restore any Act from a given year.
//
// A change can carry knock-ons (legal, fiscal, diplomatic, social) and, for a few Acts with a clear fiscal channel,
// moves to existing simulator levers. Law changes never create levers or powers. Only levers in LAW_LEVERS can be
// moved, and anything touching citizenship, residence by ethnicity, sterilisation or eugenics is refused outright.
import { useMemo, useEffect, useState } from "react";
import { useData } from "../lib";
import { LEVERS, Levers, NumKey, YEARS, ZERO } from "../sim/engine";
import { simulateSchedule, Turn } from "../sim/campaign";
import type { Baseline, Result } from "../sim/engine";
import type { ParamValues } from "../sim/params";

export type Action = "repeal" | "amend" | "restore";
export type LawChange = { act: string; action: Action; t: number; option?: string; text?: string; at?: string };
export type Dim = "legal" | "fiscal" | "diplomatic" | "social";
export type Knock = { dim: Dim; text: string };
type LeverMove = { k: NumKey; v: number; years?: number; basis?: string };
type Effect = { knock: Knock[]; levers?: LeverMove[] };
type AmendOption = Effect & { id: string; label: string };
export type ActEffects = { title: string; summary?: string; status?: "repealed"; supersededBy?: string; repeal?: Effect; amend?: AmendOption[]; restore?: Effect };
export type LawEffects = { note: string; generic: Record<Action, Knock[]>; acts: ActEffects[] };

export const DIM_LABEL: Record<Dim, string> = { legal: "Legal", fiscal: "Fiscal", diplomatic: "Diplomatic", social: "Social" };
export const ACTION_LABEL: Record<Action, string> = { repeal: "Repeal", amend: "Amend", restore: "Restore" };

// Levers a law change may move: fiscal and service levers only.
export const LAW_LEVERS: NumKey[] = ["giltShock", "councilTaxPp", "otherDept", "planningPct", "nhs", "socialCare", "schools", "highNeeds", "councils", "housebuilding", "capital", "welfare", "hmrcStaff", "nhsProductivity", "demandShock"];
const FORBIDDEN = /citizen|nationalit|ethnic|race|racial|deport|denaturali|steril|eugenic/i;
const allowed = (k: string) => LAW_LEVERS.includes(k as NumKey) && !FORBIDDEN.test(k) && LEVERS.some((l) => l.k === k);

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

/** What a change does: its knock-ons and lever moves. */
export function effectOf(c: LawChange, E: LawEffects, fx?: ActEffects): { knock: Knock[]; levers: LeverMove[]; label: string } {
  let eff: Effect | undefined, label: string = ACTION_LABEL[c.action];
  if (c.action === "amend") {
    const o = fx?.amend?.find((x) => x.id === c.option);
    if (o) { eff = o; label = o.label; } else label = c.text ? `Amend: ${c.text.slice(0, 80)}${c.text.length > 80 ? "…" : ""}` : "Amend";
  } else eff = fx?.[c.action];
  const knock = eff?.knock?.length ? eff.knock : E.generic[c.action];
  const levers = (eff?.levers ?? []).filter((m) => allowed(m.k));
  return { knock, levers, label };
}

/** Status of an Act after the player's changes up to (and including) year t. */
export function statusAt(title: string, changes: LawChange[], t: number, fx?: ActEffects): "in force" | "repealed" | "amended" {
  let s: "in force" | "repealed" | "amended" = isRepealedInLaw(title, fx) ? "repealed" : "in force";
  for (const c of [...changes].filter((c) => c.act === cleanTitle(title) && c.t <= t).sort((a, b) => a.t - b.t)) s = c.action === "repeal" ? "repealed" : c.action === "restore" ? "in force" : "amended";
  return s;
}

/** Fold law changes into a schedule of turns: each change's lever moves apply from its year, for its duration. */
export function lawTurns(turns: Turn[], changes: LawChange[], E: LawEffects, find: (t: string) => ActEffects | undefined): Turn[] {
  const segs = changes.flatMap((c) => effectOf(c, E, find(c.act)).levers.map((m) => ({ from: c.t, to: m.years ? c.t + m.years : Infinity, k: m.k, v: m.v })));
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
  return [...book.filter((x) => !(x.act === c.act && x.t >= c.t)), { ...c, at: new Date().toISOString() }];
}

/** Run a schedule with the statute book applied, adding a news item for each change in the year it takes effect. */
export function runWithLaws(B: Baseline, turns: Turn[], P: ParamValues, book: LawChange[], E: LawEffects, find: (t: string) => ActEffects | undefined, base?: Result): Result {
  const R = simulateSchedule(B, lawTurns(turns, book, E, find), P, base);
  if (!book.length) return R;
  const ev = book.map((c) => { const e = effectOf(c, E, find(c.act)); const k = e.knock.find((x) => x.dim === "legal") ?? e.knock[0];
    return { t: c.t, tone: (c.action === "restore" ? "good" : "info") as "good" | "info", area: "Law", text: `${c.action === "amend" ? e.label.replace(/^Amend: /, "Amended: ") + ` (${c.act})` : `${c.action === "repeal" ? "Repealed" : "Restored"}: ${c.act}`}. ${k ? k.text.split(/(?<=\.)\s/)[0] : ""}` }; });
  return { ...R, events: [...R.events, ...ev].sort((a, b) => a.t - b.t) };
}
