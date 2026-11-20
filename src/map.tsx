import L from "leaflet";
import { useEffect, useRef } from "react";

export function useLeaflet(el: React.RefObject<HTMLDivElement>, ready: boolean, center: [number, number] = [54.3, -2.5], zoom = 6) {
  const map = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { preferCanvas: true, zoomSnap: 0.5 }).setView(center, zoom);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>', subdomains: "abcd", maxZoom: 18,
    }).addTo(map.current);
  }, [ready]);
  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);
  return map;
}
export const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
