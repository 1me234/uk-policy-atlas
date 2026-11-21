import React, { useEffect, useState } from "react";
import Overview from "./pages/Overview";
import Spending from "./pages/Spending";
import Departments from "./pages/Departments";
import Projects from "./pages/Projects";
import InfraMap from "./pages/InfraMap";
import Councils from "./pages/Councils";
import NHS from "./pages/NHS";
import Education from "./pages/Education";
import Welfare from "./pages/Welfare";
import Charities from "./pages/Charities";
import Contracts from "./pages/Contracts";
import Foreign from "./pages/Foreign";
import History from "./pages/History";
import Findings from "./pages/Findings";
import Sources from "./pages/Sources";
import Simulate from "./pages/Simulate";
import Lab from "./pages/Lab";
import Laws from "./pages/Laws";
import Draft from "./pages/Draft";

const NAV: [string, string, string, React.FC][] = [
  ["Explore", "overview", "Overview", Overview],
  ["Explore", "findings", "Findings & plan", Findings],
  ["Explore", "history", "Policy history", History],
  ["Simulate", "simulate", "Policy simulator", Simulate],
  ["Simulate", "lab", "Model lab", Lab],
  ["Law", "laws", "Laws & legislation", Laws],
  ["Law", "draft", "Drafting workspace", Draft],
  ["Money", "spending", "Spending & fiscal", Spending],
  ["Money", "contracts", "Contracts & suppliers", Contracts],
  ["Machinery", "departments", "Departments & civil service", Departments],
  ["Machinery", "projects", "Major projects", Projects],
  ["Machinery", "foreign", "Foreign affairs & defence", Foreign],
  ["Places", "map", "Infrastructure map", InfraMap],
  ["Places", "councils", "Councils", Councils],
  ["Services", "nhs", "NHS", NHS],
  ["Services", "education", "Education", Education],
  ["Services", "welfare", "Social security", Welfare],
  ["Services", "charities", "Charities & NGOs", Charities],
  ["Reference", "sources", "Sources & catalogue", Sources],
];
class Boundary extends React.Component<{ k: string; children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidUpdate(p: { k: string }) { if (p.k !== this.props.k && this.state.err) this.setState({ err: null }); }
  render() { return this.state.err ? <div className="card flag">This section failed to render: {this.state.err.message}</div> : this.props.children; }
}
function useHash() {
  const [h, setH] = useState(() => location.hash.slice(2) || "overview");
  useEffect(() => { const f = () => { setH(location.hash.slice(2) || "overview"); window.scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
}
export default function App() {
  const route = useHash();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem("theme") || ""; } catch { return ""; } });
  useEffect(() => { if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme; try { localStorage.setItem("theme", theme); } catch {} }, [theme]);
  const key = route.split(/[/?]/)[0];
  const P = (NAV.find((n) => n[1] === key) ?? NAV[0])[3];
  let group = "";
  return <div className="app">
    <aside className={`side ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
      <div className="brand">UK Policy Atlas</div>
      <div className="brand-sub">What the state spends, runs and builds, with sources</div>
      <nav className="nav">{NAV.map(([g, k, l]) => <React.Fragment key={k}>{g !== group && (group = g) && <div className="nav-group">{g}</div>}<a href={`#/${k}`} className={key === k ? "on" : ""}>{l}</a></React.Fragment>)}</nav>
      <div className="nav-group">Theme</div>
      <div style={{ padding: "0 10px" }}><select value={theme} onChange={(e) => setTheme(e.target.value)} onClick={(e) => e.stopPropagation()}><option value="">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
    </aside>
    <main className="main"><button className="seg menu-btn" onClick={() => setOpen(true)}>☰ Menu</button><Boundary k={key}><P key={key} /></Boundary></main>
  </div>;
}
