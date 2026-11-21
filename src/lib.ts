import { useEffect, useState } from "react";

const cache: Record<string, Promise<any>> = {};
export function load<T = any>(name: string): Promise<T> {
  if (!cache[name]) cache[name] = fetch(`./data/${name}.json`).then((r) => { if (!r.ok) throw new Error(name); return r.json(); });
  return cache[name];
}
export function useData<T = any>(...names: string[]): T[] | null {
  const [d, setD] = useState<T[] | null>(null);
  useEffect(() => { let on = true; Promise.all(names.map((n) => load<T>(n))).then((x) => on && setD(x)); return () => { on = false; }; }, [names.join()]);
  return d;
}
export const fmt = {
  n: (v: number | null | undefined, dp = 0) => v == null || isNaN(v) ? "–" : v.toLocaleString("en-GB", { maximumFractionDigits: dp, minimumFractionDigits: dp }),
  gbp: (v: number | null | undefined, unit: "" | "k" | "m" | "bn" = "") => {
    if (v == null || isNaN(v)) return "–";
    const mult = { "": 1, k: 1e3, m: 1e6, bn: 1e9 }[unit];
    const x = v * mult, a = Math.abs(x), sg = x < 0 ? "−" : "";
    if (a >= 1e12) return `${sg}£${(a / 1e12).toFixed(2)}tn`;
    if (a >= 1e9) return `${sg}£${(a / 1e9).toFixed(a >= 1e11 ? 0 : 1)}bn`;
    if (a >= 1e6) return `${sg}£${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}m`;
    if (a >= 1e3) return `${sg}£${(a / 1e3).toFixed(0)}k`;
    return `${sg}£${a.toFixed(0)}`;
  },
  pct: (v: number | null | undefined, dp = 1) => v == null || isNaN(v) ? "–" : `${v.toFixed(dp)}%`,
};
export const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];
export const cssVar = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v.replace(/var\((.*)\)/, "$1")).trim() || "#888";
export const RAG: Record<string, string> = { RED: "var(--red)", AMBER: "var(--amber)", GREEN: "var(--green)" };
export function sortBy<T>(arr: T[], key: (x: T) => any, dir = -1) {
  return [...arr].sort((a, b) => { const x = key(a), y = key(b); if (x == null) return 1; if (y == null) return -1; return x > y ? dir : x < y ? -dir : 0; });
}
// Sequential colour ramp for choropleths (5 steps, light → accent)
export function ramp(t: number) {
  const stops = ["#e8f1ef", "#b8d8d3", "#7fb8b1", "#3f8f8a", "#0f5e63"];
  const i = Math.max(0, Math.min(stops.length - 1, Math.floor(t * stops.length)));
  return stops[i];
}
export function quantiles(vals: number[]) {
  const v = vals.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b);
  return (x: number) => { if (x == null || !isFinite(x) || !v.length) return -1; let lo = 0, hi = v.length; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < x) lo = m + 1; else hi = m; } return lo / v.length; };
}
