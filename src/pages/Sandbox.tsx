import React, { useEffect, useMemo, useState } from "react";
import { fmt, useData } from "../lib";
import { Card, Drawer, Loading, Page, Seg } from "../ui";
import { assess, Baseline, buildBaseline, Event, LAST_FORECAST, leverText, LEVERS, Levers, NumKey, Result, RULE_YEAR, Score, simulate, YEARS, ZERO } from "../sim/engine";
import { simulateSchedule, Turn } from "../sim/campaign";
import { defaultParams, ParamValues } from "../sim/params";
import { Charts, ProjectPicker } from "./Simulate";
import { actUrl, useActs } from "./Laws";
import { ACTION_LABEL, boundsAt, democracyAt, effectOf, LawChange, runWithLaws, useLawEffects } from "../law/statute";
import { ActSearch, DemocracyMeter, LawChanges, LawEditor, NewLaw } from "../law/LawUI";

// ---------- Saved games ----------
type News = { t: number; tone: Event["tone"]; text: string };
export type Game = {
  id: string; name: string; created: string; updated: string;
  t: number; // the year being decided
  turns: Turn[]; // one per enacted year: the whole policy in force from that year
  world: boolean; seed: number;
  shocks: Record<number, Partial<Levers>>; // world events in force from each year (cumulative)
  news: News[]; done: boolean;
  draft?: Levers; // an undone budget, offered back as the starting point
  laws?: LawChange[]; // this game's own statute book: Acts repealed, amended or restored, by year
};
const LS = "atlas-campaigns";
const readGames = (): Game[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };
const SHOCK_KEYS: NumKey[] = ["demandShock", "giltShock", "netMigration"];

// ---------- World events ----------
// Illustrative game mechanics, not forecasts. Each year has a small chance of a recession, a boom, a migration swing
// or a gilt sell-off. The chance of a sell-off rises when the plan breaks the stability rule or debt runs well above
// the baseline, which is the channel by which markets discipline fiscal policy.
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const q = (x: number, s: number) => Math.round(x / s) * s;
// Democratic backsliding (from the game's statute book) raises the chance of a sell-off and, lower down, brings
// protest, strikes and sanctions. Also illustrative: the sizes and odds are game mechanics chosen for the atlas.
type Dem = { score: number; band: string; prevBand: string };
function rollWorld(g: Game, t: number, R: Result, B: Baseline, dem?: Dem): { shocks: Partial<Levers>; news: News[] } {
  const r = rng(g.seed * 1009 + t * 7919), prev = { ...(g.shocks[t - 1] ?? {}) } as Partial<Levers>, news: News[] = [];
  const add = (k: NumKey, v: number) => { const def = LEVERS.find((l) => l.k === k)!; prev[k] = Math.max(def.min, Math.min(def.max, ((prev[k] as number) ?? 0) + v)) as any; };
  const debtGap = R.psndPct[t] - (B.psnd[t] / B.gdp[t]) * 100, stressed = !R.rules.stability.met || debtGap > 3;
  const pr = r(), pg = r(), pm = r(), a = r(), b = r();
  if (pr < 0.1) { const v = -q(1.5 + 1.5 * a, 0.25); add("demandShock", v); news.push({ t, tone: "bad", text: `A recession hits: demand falls by ${(-v).toFixed(2)}% of GDP. Tax receipts fall and unemployment rises unless you respond.` }); }
  else if (pr > 0.95) { const v = q(0.5 + a, 0.25); add("demandShock", v); news.push({ t, tone: "good", text: `A demand boom adds ${v.toFixed(2)}% to GDP for a while. Receipts beat forecast.` }); }
  const dm = dem?.score ?? 100, demRisk = dm < 40 ? 0.2 : dm < 65 ? 0.12 : dm < 85 ? 0.05 : 0;
  if (pg < 0.05 + (stressed ? 0.2 : 0) + demRisk) { const v = q(0.5 + 0.75 * b, 0.25); add("giltShock", v); news.push({ t, tone: "bad", text: `Gilt markets sell off: yields up ${v.toFixed(2)}pp${stressed ? ", after investors question the fiscal plan" : demRisk ? ", as investors price in political risk" : ""}. Debt interest climbs as debt is refinanced.` }); }
  if (pm < 0.1) { const v = q((a > 0.5 ? 1 : -1) * (50 + 100 * b), 10); add("netMigration", v); news.push({ t, tone: "info", text: `Net migration comes in ${Math.abs(v)}k a year ${v > 0 ? "above" : "below"} the OBR forecast, changing the labour force and demand for services.` }); }
  if (dem && dem.band !== dem.prevBand) news.push({ t, tone: dm < 85 ? "bad" : "good", text: `Democracy monitors now rate the UK a "${dem.band}" (standing ${dm} of 100).${dm < 65 ? " Allies downgrade intelligence sharing and the Council of Europe opens proceedings." : ""}` });
  const c = r(), d = r();
  if (dm < 65 && c < 0.25) { add("demandShock", -0.5); news.push({ t, tone: "bad", text: "Mass protests and a wave of strikes against the government disrupt the economy: demand falls by 0.5% of GDP." }); }
  if (dm < 40 && d < 0.3) { add("demandShock", -1); news.push({ t, tone: "bad", text: "Trading partners impose targeted sanctions and firms move investment abroad: demand falls by 1% of GDP." }); }
  return { shocks: prev, news };
}

// ---------- Helpers ----------
const sign = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
const lv = (l: (typeof LEVERS)[number], v: number) => leverText(l, v);
const playerLevers = (L: Levers): Levers => { const x = { ...ZERO, ...L }; SHOCK_KEYS.forEach((k) => ((x as any)[k] = 0)); return x; };
const inForce = (g: Game, t: number): Levers => { const p = [...g.turns].filter((x) => x.t < t).sort((a, b) => b.t - a.t)[0]; return p ? { ...ZERO, ...p.levers } : { ...ZERO }; };
function describe(prev: Levers, L: Levers, B: Baseline, world: boolean): string[] {
  const out: string[] = [];
  for (const l of LEVERS) { if (world && SHOCK_KEYS.includes(l.k)) continue; if (L[l.k] !== prev[l.k]) out.push(`${l.label}: ${lv(l, prev[l.k])} → ${lv(l, L[l.k])}`); }
  const pp = prev.projects ?? {}, lp = L.projects ?? {};
  for (const id of new Set([...Object.keys(pp), ...Object.keys(lp)])) if ((pp[id] ?? 0) !== (lp[id] ?? 0)) {
    const p = B.projects.find((x) => x.id === id), v = lp[id] ?? 0;
    out.push(`${p?.name ?? id}: ${v === -100 ? "cancelled" : v === 0 ? "back to plan" : `${v > 0 ? "+" : ""}${v}% of planned spend`}`);
  }
  return out;
}
const fmtv = (v: number, u: string) => u === "" ? fmt.n(v) : u === "% GDP" ? `${v.toFixed(1)}%` : u === "£bn" ? `${v < 0 ? "−" : ""}£${Math.abs(v).toFixed(1)}bn` : u === "m" ? `${v.toFixed(2)}m` : u.includes("vs baseline") ? `${sign(v, u.startsWith("%") ? 2 : 0)}${u.startsWith("%") ? "%" : "k"}` : `${fmt.n(v, Math.abs(v) < 10 ? 1 : 0)}${u.startsWith("k") ? "k" : ""}`;
const better = (s: Score) => { const d = s.scen - s.base; if (s.higherIsBetter == null || Math.abs(d) < Math.max(1e-3, Math.abs(s.base) * 1e-3)) return null; return (d > 0) === s.higherIsBetter; };

// ---------- Page ----------
export default function Sandbox() {
  const d = useData("fiscal", "spending", "nhs_performance", "welfare", "civil_service", "councils", "sim_params", "major_projects");
  const B = useMemo(() => d && buildBaseline(...(d as [any, any, any, any, any, any, any, any])), [d]);
  const P = useMemo(() => defaultParams() as ParamValues, []);
  const base = useMemo(() => B && simulate(B, ZERO, P), [B, P]);
  const [games, setGames] = useState<Game[]>(readGames);
  const [id, setId] = useState<string | null>(() => (location.hash.match(/[?&]g=([\w]+)/) || [])[1] ?? null);
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(games)); } catch {} }, [games]);
  if (!B || !base) return <Loading />;
  const g = games.find((x) => x.id === id);
  const save = (x: Game) => setGames((gs) => [{ ...x, updated: new Date().toISOString() }, ...gs.filter((y) => y.id !== x.id)]);
  if (!g) return <Start games={games} open={setId} create={(name, world) => { const x: Game = { id: Math.random().toString(36).slice(2, 10), name, created: new Date().toISOString(), updated: "", t: 0, turns: [], world, seed: Math.floor(Math.random() * 1e9), shocks: {}, news: [], done: false }; save(x); setId(x.id); }}
    remove={(i) => setGames((gs) => gs.filter((x) => x.id !== i))} importGame={(x) => { save(x); setId(x.id); }} />;
  return <Play key={`${g.id}-${g.t}-${g.done}-${g.turns.length}`} g={g} B={B} P={P} base={base} save={save} quit={() => setId(null)} />;
}

function Start({ games, open, create, remove, importGame }: { games: Game[]; open: (id: string) => void; create: (name: string, world: boolean) => void; remove: (id: string) => void; importGame: (g: Game) => void }) {
  const [name, setName] = useState("My government");
  const [world, setWorld] = useState(true);
  return <Page title="Sandbox campaign" lede={<>Take office in {YEARS[0]} with the country as it is today: the OBR's latest forecast, today's waiting lists, prisons, councils, schools and benefits. Each year you set a budget and a programme, enact it, and move on. Policies stay in force until you change them, effects build up over time, and the world sometimes intervenes. You play ten years, to {YEARS.at(-1)}.</>}>
    <div className="grid g2" style={{ alignItems: "start" }}>
      <Card title="New game">
        <div className="controls" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <label className="muted">Name your government <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }} /></label>
          <label className="check"><input type="checkbox" checked={world} onChange={(e) => setWorld(e.target.checked)} /> World events: recessions, booms, migration swings and gilt sell-offs that grow more likely if markets doubt your plan</label>
          <button className="seg on" onClick={() => create(name.trim() || "My government", world)}>Take office in {YEARS[0]}</button>
        </div>
      </Card>
      <Card title="Saved games" sub="Games save in this browser after every move. Export one to keep it or move it to another device.">
        {games.length === 0 ? <div className="muted">No saved games yet.</div> : <table><tbody>{games.map((x) => <tr key={x.id}>
          <td><a href="#/sandbox" onClick={(e) => { e.preventDefault(); open(x.id); }}><b>{x.name}</b></a><div className="muted" style={{ fontSize: 12 }}>{x.done ? "Finished" : `Deciding ${YEARS[x.t]}`} · {x.turns.length} budget{x.turns.length === 1 ? "" : "s"}{x.world ? " · world events" : ""}</div></td>
          <td className="n"><button className="seg" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(x, null, 1)], { type: "application/json" })); a.download = `${x.name.replace(/\W+/g, "-")}.json`; a.click(); }}>Export</button>{" "}
            <button className="seg" onClick={() => { if (confirm(`Delete “${x.name}”?`)) remove(x.id); }}>Delete</button></td></tr>)}</tbody></table>}
        <label className="muted" style={{ display: "block", marginTop: 10, fontSize: 12.5 }}>Import a game <input type="file" accept=".json,application/json" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const x = JSON.parse(await f.text()) as Game; if (Array.isArray(x.turns) && typeof x.t === "number") importGame({ ...x, id: Math.random().toString(36).slice(2, 10) }); } catch { alert("That file is not a saved game."); } }} /></label>
      </Card>
    </div>
    <Card title="How it works" style={{ marginTop: 14 }}>
      <div className="prose muted" style={{ fontSize: 13 }}>
        <p>The game runs on the same model as the <a href="#/simulate">policy simulator</a>, with every link and parameter visible there. Each budget sets the whole policy from that year on. The model adds up the effect of each year's changes, starting in the year you made them, so a hospital funded in your second year starts cutting the waiting list in your second year, and a tax cut you reverse in year five stops costing money in year five. The fiscal rules are judged in {RULE_YEAR}, as the Treasury does now.</p>
        <p>World events are a game device, not forecasts. Each year brings a 10% chance of a recession, 5% of a boom, 10% of net migration swinging 50k to 150k a year from the forecast, and 5% of a gilt sell-off. The chance of a sell-off rises to 25% while your plan breaks the stability rule or runs debt more than 3 points of GDP above the baseline. Years after {YEARS[LAST_FORECAST]} extend the OBR forecast at constant shares of GDP.</p>
      </div>
    </Card>
  </Page>;
}

function Play({ g, B, P, base, save, quit }: { g: Game; B: Baseline; P: ParamValues; base: Result; save: (g: Game) => void; quit: () => void }) {
  const t = g.done ? YEARS.length - 1 : g.t;
  const prev = inForce(g, t);
  const shocks = g.world ? g.shocks[t] ?? {} : {};
  const [draft, setDraft] = useState<Levers>(() => playerLevers(g.done ? { ...ZERO, ...g.turns.at(-1)?.levers } : g.draft ?? prev));
  const [tab, setTab] = useState<"state" | "charts" | "record">("state");
  const done = g.done;
  const [open, setOpen] = useState<Record<string, boolean>>({ Tax: true });
  const turnsBefore = g.turns.filter((x) => x.t < t);
  const levers = (L: Levers): Levers => ({ ...playerLevers(L), ...(g.world ? shocks : { demandShock: L.demandShock, giltShock: L.giltShock, netMigration: L.netMigration }) } as Levers);
  const LE = useLawEffects();
  const actsD = useActs();
  const [lawSel, setLawSel] = useState<string | null>(null);
  const laws = g.laws ?? [];
  const setLaws = (f: (b: LawChange[]) => LawChange[]) => save({ ...g, laws: f(g.laws ?? []) });
  const run = (turns: Turn[], book: LawChange[]) => LE ? runWithLaws(B, turns, P, book, LE.E, LE.find, base) : simulateSchedule(B, turns, P, base);
  const R = useMemo(() => g.done ? run(g.turns, laws) : run([...turnsBefore, { t, levers: levers(draft) }], laws), [g, draft, LE]);
  const Rstay = useMemo(() => run([...turnsBefore, { t, levers: levers(prev) }], laws.filter((c) => c.t < t)), [g, LE]);
  const now = useMemo(() => assess(B, R, t), [R, t]);
  const lawsNow = laws.filter((c) => c.t === t);
  const bnd = useMemo(() => boundsAt(laws, t, LE?.E, LE?.find), [laws, t, LE]);
  const myActs = useMemo(() => [...new Set([...(LE?.E.acts.filter((a) => a.new).map((a) => a.title) ?? []), ...laws.filter((c) => c.action === "enact").map((c) => c.act)])], [laws, LE]);
  const changes = [...describe(prev, levers(draft), B, g.world), ...(LE ? lawsNow.map((c) => `${ACTION_LABEL[c.action]}: ${c.act}${c.action === "amend" ? ` (${effectOf(c, LE.E, LE.find(c.act)).label})` : ""}`) : [])];
  const set = (k: keyof Levers, v: number) => setDraft((x) => ({ ...x, [k]: v }));

  const enact = () => {
    const turns = [...turnsBefore, { t, levers: levers(draft), note: changes.length ? undefined : "No change" }];
    const x: Game = { ...g, turns, draft: undefined };
    if (t >= YEARS.length - 1) { save({ ...x, done: true }); return; }
    if (g.world) { const Rn = run(turns, laws); const dem = LE ? { ...democracyAt(laws, t + 1, LE.E, LE.find), prevBand: democracyAt(laws.filter((c) => c.t < t), t, LE.E, LE.find).band } : undefined; const w = rollWorld(x, t + 1, Rn, B, dem); x.shocks = { ...g.shocks, [t + 1]: w.shocks }; x.news = [...g.news.filter((n) => n.t <= t), ...w.news]; }
    save({ ...x, t: t + 1 });
  };
  const undo = () => {
    const last = [...g.turns].sort((a, b) => b.t - a.t)[0]; if (!last) return;
    const keep = Object.fromEntries(Object.entries(g.shocks).filter(([k]) => +k <= last.t));
    save({ ...g, done: false, t: last.t, turns: g.turns.filter((x) => x !== last), draft: last.levers, laws: laws.filter((c) => c.t <= last.t), shocks: keep, news: g.news.filter((n) => n.t <= last.t) });
  };

  let group = "";
  const nChanged = (grp: string) => LEVERS.filter((l) => l.group === grp && draft[l.k] !== prev[l.k]).length;
  const events = [...R.events.filter((e) => !(g.world && e.text.startsWith("Gilt yields jump"))).map((e) => ({ ...e, world: false })), ...g.news.map((n) => ({ ...n, area: "World", world: true }))].sort((a, b) => a.t - b.t);
  const pastEv = events.filter((e) => e.t < t || (g.done && e.t <= t)), thisEv = g.done ? [] : events.filter((e) => e.t === t), futureEv = g.done ? [] : events.filter((e) => e.t > t);

  return <Page title={g.name} lede={g.done ? <>Your ten years are over. Here is the country you leave behind, against the path it was on when you took office.</> : <>Year {t + 1} of {YEARS.length}: set the budget and programme for <b>{YEARS[t]}</b>, then enact it. Everything you changed before stays in force until you change it again.</>}
    right={<div className="controls" style={{ margin: 0 }}><button className="seg" onClick={quit}>Saved games</button>{g.turns.length > 0 && <button className="seg" onClick={undo}>Undo last budget</button>}</div>}>
    <div className="yearbar">{YEARS.map((y, i) => <span key={y} className={i < t || g.done ? "done" : i === t ? "on" : ""} title={y}>{y.slice(2)}</span>)}</div>
    <div className="sim">
      {!g.done ? <aside className="card sim-levers">
        <div className="controls" style={{ justifyContent: "space-between", margin: "0 0 6px" }}><b>Budget for {YEARS[t]}</b>{changes.length > 0 && <button className="seg" onClick={() => { setDraft(playerLevers(prev)); if (lawsNow.length) setLaws((b) => b.filter((c) => c.t !== t)); }}>Clear changes</button>}</div>
        <button className="seg on" style={{ width: "100%", padding: "9px 10px" }} onClick={enact}>{t === YEARS.length - 1 ? "Enact final budget and finish" : `Enact and move to ${YEARS[t + 1]}`}</button>
        <div className="muted" style={{ fontSize: 12, margin: "6px 0" }}>{changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"} this year` : "No changes: policy carries on as it is."}</div>
        {LEVERS.map((l) => { if (g.world && SHOCK_KEYS.includes(l.k)) return null; const head = l.group !== group && (group = l.group); const gr = l.group; const n = nChanged(gr);
          return <React.Fragment key={l.k}>
            {head && <button className="lever-group" onClick={() => setOpen((o) => ({ ...o, [gr]: !o[gr] }))} aria-expanded={!!open[gr]}><span>{open[gr] ? "▾" : "▸"} {gr.replace(" and population", g.world ? "" : " and population")}</span>{n > 0 && <span className="pill">{n}</span>}</button>}
            {open[gr] && <div className={`lever ${draft[l.k] !== prev[l.k] ? "on" : ""}`} title={l.help}>
              <div className="lever-head"><span>{l.label}</span><span className="lever-v">{lv(l, draft[l.k])}{draft[l.k] !== prev[l.k] && <span className="muted"> (was {lv(l, prev[l.k])})</span>}</span></div>
              <input type="range" min={bnd(l).min} max={bnd(l).max} step={l.step} value={draft[l.k]} onChange={(e) => set(l.k, +e.target.value)} onDoubleClick={() => set(l.k, prev[l.k])} aria-label={l.label} />
            </div>}
          </React.Fragment>; })}
        <button className="lever-group" onClick={() => setOpen((o) => ({ ...o, projects: !o.projects }))} aria-expanded={!!open.projects}><span>{open.projects ? "▾" : "▸"} Major projects</span>{Object.keys(draft.projects ?? {}).length > 0 && <span className="pill">{Object.keys(draft.projects ?? {}).length}</span>}</button>
        {open.projects && <ProjectPicker B={B} L={draft} setL={setDraft} />}
        <button className="lever-group" onClick={() => setOpen((o) => ({ ...o, laws: !o.laws }))} aria-expanded={!!open.laws}><span>{open.laws ? "▾" : "▸"} Laws and powers</span>{lawsNow.length > 0 && <span className="pill">{lawsNow.length}</span>}</button>
        {open.laws && LE && actsD && <div style={{ fontSize: 12.5 }}>
          <div className="muted" style={{ margin: "4px 0 6px" }}>Change any Act of Parliament from {YEARS[t]}, or pass a new one. Each change shows its legal, fiscal, diplomatic and social knock-ons. Laws can move any lever and grant powers that let levers go further than normal; you can give any change effects of your own.</div>
          <DemocracyMeter book={laws} t={t} E={LE.E} find={LE.find} compact />
          <ActSearch acts={actsD.acts} onPick={setLawSel} extra={myActs} />
          {["Equality Act 2010", "Human Rights Act 1998", "Climate Change Act 2008", "Bank of England Act 1998"].map((x) => <button key={x} className="seg" style={{ fontSize: 11.5, padding: "2px 7px", margin: "4px 4px 0 0" }} onClick={() => setLawSel(x)}>{x}</button>)}
          <button className="lever-group" style={{ marginTop: 6 }} onClick={() => setOpen((o) => ({ ...o, newlaw: !o.newlaw }))} aria-expanded={!!open.newlaw}><span>{open.newlaw ? "▾" : "▸"} Pass a new Act</span></button>
          {open.newlaw && <NewLaw E={LE.E} book={laws} setBook={setLaws} fixedYear={t} onTemplate={setLawSel} />}
          {laws.length > 0 && <div style={{ marginTop: 8 }}><LawChanges book={laws} E={LE.E} find={LE.find} setBook={setLaws} editable={(c) => c.t === t} /></div>}
        </div>}
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Levers are levels relative to today's plans, not changes on last year. Double-click a slider to put it back where it was last year.{g.world ? " Shocks are set by world events, not by you." : ""}</div>
      </aside> : <aside className="card sim-levers"><b>Final verdict</b><Verdict R={R} /><button className="seg" style={{ marginTop: 10 }} onClick={undo}>Go back a year</button></aside>}

      <div className="sim-out">
        <Dashboard R={R} Rstay={Rstay} B={B} t={t} done={g.done} />
        {!g.done && changes.length > 0 && <Card title={`Your budget for ${YEARS[t]}`} sub="What changes, and what it does by the end of the term against carrying on with last year's policy." style={{ marginTop: 14 }}>
          <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 13 }}>{changes.map((c) => <li key={c}>{c}</li>)}</ul>
          <Impact R={R} S={Rstay} />
        </Card>}
        <div className="controls" style={{ marginTop: 14 }}><Seg v={tab} set={setTab} opts={[["state", "Scorecard and events"], ["charts", "Charts"], ["record", `Record of government (${g.turns.length})`]]} /></div>
        {tab === "state" && <div className="grid g2" style={{ alignItems: "start" }}>
          <Card title="Scorecard" sub={done ? "Where you leave the country, against the path it was on." : `Now (${YEARS[t]}) and at the end of the term if policy stays as set, against the path the country was on.`}>
            <table><thead><tr><th>Measure</th><th className="n">Baseline</th><th className="n">{YEARS[t]}</th>{!done && <th className="n">{YEARS.at(-1)}</th>}</tr></thead><tbody>
              {R.scores.map((s, i) => { const n0 = now.scores[i]; const b1 = better(n0), b2 = better(s);
                const show = (x: Score, b: boolean | null) => <td className="n" style={{ fontWeight: 600, color: b == null ? undefined : b ? "var(--green)" : "var(--red)" }}>{fmtv(x.scen, x.unit)}</td>;
                return <tr key={s.label}><td>{s.label.replace(/ \d{4}-\d\d$/, "")}</td><td className="n muted">{s.unit.includes("vs baseline") ? "–" : fmtv(n0.base, s.unit)}</td>{show(n0, b1)}{!done && show(s, b2)}</tr>; })}
            </tbody></table>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Baseline is for {YEARS[t]}. Green is better than the baseline, red is worse.</div>
          </Card>
          <Card title="News and warnings">
            {thisEv.length > 0 && <><h4 style={{ margin: "0 0 6px" }}>This year</h4><EvList ev={thisEv} /></>}
            {futureEv.length > 0 && <><h4 style={{ margin: "10px 0 6px" }}>Ahead, if nothing changes</h4><EvList ev={futureEv} /></>}
            {pastEv.length > 0 && <><h4 style={{ margin: "10px 0 6px" }}>So far</h4><EvList ev={[...pastEv].reverse()} /></>}
            {events.length === 0 && <div className="muted">Nothing has crossed a threshold yet.</div>}
          </Card>
        </div>}
        {tab === "charts" && <Charts R={R} B={B} now={t} />}
        {tab === "record" && <Record g={g} B={B} />}
      </div>
    </div>
    {lawSel && LE && <Drawer onClose={() => setLawSel(null)}><LawEditor key={lawSel + laws.length} title={lawSel} url={(() => { const a = actsD?.acts.find((x) => x.t === lawSel); return a ? actUrl(a) : undefined; })()} E={LE.E} fx={LE.find(lawSel)} book={laws} setBook={setLaws} fixedYear={t} onDone={() => setLawSel(null)} /></Drawer>}
  </Page>;
}

function EvList({ ev }: { ev: (Event & { world?: boolean })[] }) {
  return <div className="timeline">{ev.map((e, i) => <div key={i} className="tl-item" style={{ marginBottom: 8 }}>
    <div style={{ fontSize: 12 }} className="muted"><b style={{ color: "var(--ink)" }}>{YEARS[e.t]}</b> · {e.area}{e.t > LAST_FORECAST ? " · extrapolated" : ""}</div>
    <div className={`flag ${e.tone === "good" ? "good" : e.tone === "info" ? "gap" : ""}`} style={{ margin: "3px 0 0" }}>{e.text}</div></div>)}</div>;
}

function Dashboard({ R, Rstay, B, t, done }: { R: Result; Rstay: Result; B: Baseline; t: number; done: boolean }) {
  const ri = YEARS.indexOf(RULE_YEAR), S = R.rules.stability, I = R.rules.investment;
  const items = [
    { l: `Borrowing ${YEARS[t]}`, v: `£${R.psnb[t].toFixed(0)}bn`, d: `baseline £${B.psnb[t].toFixed(0)}bn` },
    { l: `Debt ${YEARS[t]}`, v: `${R.psndPct[t].toFixed(1)}% of GDP`, d: `baseline ${((B.psnd[t] / B.gdp[t]) * 100).toFixed(1)}%` },
    { l: `Real GDP ${YEARS[t]}`, v: `${sign(R.gdpPct[t], 2)}%`, d: `employment ${sign(R.employmentK[t], 0)}k vs baseline` },
    { l: `NHS waiting list ${YEARS[t]}`, v: `${(R.waiting[t] / 1e6).toFixed(2)}m`, d: `baseline ${(R.waitingBase[t] / 1e6).toFixed(2)}m` },
    { l: `Fiscal rules, judged ${RULE_YEAR}`, v: `${S.met ? "Stability met" : "Stability broken"}`, d: `${I.met ? "investment rule met" : "investment rule broken"}${t > ri ? " (already judged)" : ""}`, c: S.met && I.met ? "var(--green)" : "var(--red)" },
    { l: `Children in poverty ${YEARS[t]}`, v: `${(R.S.childPov[t] * 1000).toFixed(0)}k`, d: `baseline ${(R.SB.childPov[t] * 1000).toFixed(0)}k` },
  ];
  return <>
    <div className="grid g3">{items.map((x) => <div key={x.l} className="card stat"><div className="v" style={{ color: (x as any).c, fontSize: 20 }}>{x.v}</div><div className="l">{x.l}</div><div className="d muted">{x.d}</div></div>)}</div>
    {!done && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Figures for {YEARS[t]} include this year's draft budget. Debt at the end of the term with this budget: {R.psndPct.at(-1)!.toFixed(1)}% of GDP{Math.abs(R.psndPct.at(-1)! - Rstay.psndPct.at(-1)!) > 0.05 ? ` (${sign(R.psndPct.at(-1)! - Rstay.psndPct.at(-1)!, 1)} pts on carrying on as you are)` : ""}.</div>}
  </>;
}

function Impact({ R, S }: { R: Result; S: Result }) {
  const T = YEARS.length - 1;
  const rows: [string, number, string][] = [
    [`Borrowing, ${YEARS[T]}`, R.psnb[T] - S.psnb[T], "£bn"], [`Debt, ${YEARS[T]}`, R.psndPct[T] - S.psndPct[T], "pts of GDP"], ["Real GDP level", R.gdpPct[T] - S.gdpPct[T], "%"],
    ["Employment", R.employmentK[T] - S.employmentK[T], "k"], ["NHS waiting list", (R.waiting[T] - S.waiting[T]) / 1e6, "m"], ["Children in poverty", (R.S.childPov[T] - S.S.childPov[T]) * 1000, "k"],
    ["Homes built a year", R.S.homes[T] - S.S.homes[T], "k"], ["Spare prison places", (R.S.prisonCap[T] - R.S.prisonPop[T]) - (S.S.prisonCap[T] - S.S.prisonPop[T]), "k"], ["Council reserves", R.laReserves[T] - S.laReserves[T], "£bn"],
  ];
  const good = (l: string, v: number) => /Borrowing|Debt|waiting|poverty/.test(l) ? v < 0 : v > 0;
  return <div className="grid g3" style={{ gap: 6 }}>{rows.filter(([, v]) => Math.abs(v) > 0.005).map(([l, v, u]) => <div key={l} style={{ fontSize: 12.5 }}><span className="muted">{l}</span><br /><b style={{ color: good(l, v) ? "var(--green)" : "var(--red)" }}>{sign(v, u === "k" ? 0 : u === "m" ? 2 : 1)}{u === "£bn" ? "bn" : ` ${u}`}</b></div>)}</div>;
}

function Verdict({ R }: { R: Result }) {
  const sc = R.scores.map((s) => better(s)), w = sc.filter((x) => x === true).length, l = sc.filter((x) => x === false).length;
  return <div style={{ fontSize: 13 }}>
    <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0" }}>{w}<span className="muted" style={{ fontSize: 15 }}> better</span> · {l}<span className="muted" style={{ fontSize: 15 }}> worse</span></div>
    <div className="muted">of {R.scores.length} measures in {YEARS.at(-1)}, against the path the country was on.</div>
    <p>Stability rule {R.rules.stability.met ? "met" : "broken"}, investment rule {R.rules.investment.met ? "met" : "broken"} in {RULE_YEAR}. Debt ends at {R.psndPct.at(-1)!.toFixed(1)}% of GDP.</p>
  </div>;
}

function Record({ g, B }: { g: Game; B: Baseline }) {
  const LE = useLawEffects();
  const turns = [...g.turns].sort((a, b) => a.t - b.t);
  if (!turns.length) return <Card><div className="muted">No budgets enacted yet.</div></Card>;
  let prev: Levers = { ...ZERO };
  return <Card title="Record of government" sub="Every budget you enacted, and what it changed from the year before.">
    <div className="timeline">{turns.map((x) => { const c = describe(prev, { ...ZERO, ...x.levers }, B, g.world); prev = { ...ZERO, ...x.levers };
      const news = g.news.filter((n) => n.t === x.t);
      const lc = LE ? (g.laws ?? []).filter((l) => l.t === x.t).map((l) => `${ACTION_LABEL[l.action]}: ${l.act}${l.action === "amend" ? ` (${effectOf(l, LE.E, LE.find(l.act)).label})` : ""}`) : [];
      c.push(...lc);
      return <div key={x.t} className="tl-item" style={{ marginBottom: 12 }}>
        <b>{YEARS[x.t]}</b>
        {news.map((n, i) => <div key={i} className={`flag ${n.tone === "good" ? "good" : n.tone === "info" ? "gap" : ""}`} style={{ margin: "4px 0", fontSize: 12.5 }}>{n.text}</div>)}
        {c.length ? <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: 13 }}>{c.map((s) => <li key={s}>{s}</li>)}</ul> : <div className="muted" style={{ fontSize: 13 }}>No change.</div>}
      </div>; })}</div>
  </Card>;
}
