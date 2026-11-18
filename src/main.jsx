import React from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, ArrowUpRight, Box, Calculator, ChevronDown, CircleHelp,
  Clock3, FileBox, Grid2X2, Layers3, Menu, Search, ShieldCheck,
  Sparkles, Wrench, X
} from "lucide-react";
import "./styles.css";

const tools = [
  { title: "Giant Print / STL Splitter", description: "Split oversized STL, OBJ and 3MF models into bed-sized printable parts.", category: "STL tools", icon: Layers3, tag: "Popular", href: "https://gigaprint.app/stl-splitter" },
  { title: "Drawer Organizer", description: "Design custom-fit bins for your drawer and arrange them exactly how you need.", category: "Organization", icon: Grid2X2, tag: "Popular", href: "https://gigaprint.app/drawer-organizer" },
  { title: "Picture Frame Maker", description: "Create printable frames in your own dimensions and style.", category: "Home & decor", icon: Box, href: "https://gigaprint.app/picture-frame-maker" },
  { title: "Lithophane Maker", description: "Turn a photo into a 3D printable panel that reveals the image in light.", category: "Photo to 3D", icon: Sparkles, href: "https://gigaprint.app/lithophane-maker" },
  { title: "Box Maker", description: "Build a custom storage box from dimensions, wall thickness and lid options.", category: "Organization", icon: FileBox, href: "https://gigaprint.app/box-maker" },
  { title: "STL Repair", description: "Inspect and repair common mesh problems before printing.", category: "STL tools", icon: Wrench, href: "https://gigaprint.app/stl-repair" },
  { title: "3D Print Cost Calculator", description: "Estimate material cost and the cost of a print.", category: "Calculators", icon: Calculator, href: "https://gigaprint.app/3d-print-cost-calculator" },
  { title: "Separate STL Parts", description: "Find disconnected objects and export individual parts.", category: "STL tools", icon: Layers3, href: "https://gigaprint.app/separate-stl-parts" }
];

function App() {
  const [query, setQuery] = React.useState("");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const filtered = tools.filter((tool) => (tool.title + " " + tool.description + " " + tool.category).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="site-shell">
      <div className="announcement"><span className="status-dot" /> 3D print workbench <span className="announcement-separator">·</span> runs in your browser, files never leave it</div>
      <header className="header">
        <a className="brand" href="/" aria-label="GigaPrint home"><span className="brand-mark"><Layers3 size={21}/></span><span>Giga<span>Print</span></span></a>
        <nav className={menuOpen ? "nav nav-open" : "nav"}>
          <a href="#all-tools">All tools</a>
          <a href="https://gigaprint.app/guides">Guides</a>
          <a href="https://gigaprint.app/3d-printing-calculators">Calculators</a>
          <a href="https://gigaprint.app/about">About</a>
        </nav>
        <div className="header-actions">
          <button className="language-button" type="button">English <ChevronDown size={14}/></button>
          <a className="sign-in" href="https://gigaprint.app/">Sign in</a>
          <a className="button button-small" href="#all-tools">Try it free <ArrowUpRight size={15}/></a>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-icon"><Sparkles size={14}/></span> FREE 3D PRINT GENERATORS <span className="eyebrow-divider">·</span> NO SIGNUP TO TRY</div>
            <h1>Make something<br/><span>worth printing.</span></h1>
            <p className="hero-description">A complete 3D print workbench in your browser. Design, customize and export print-ready models — your files stay on your device.</p>
            <div className="hero-actions">
              <a className="button" href="#all-tools">Explore all tools <ArrowRight size={17}/></a>
              <a className="text-link" href="https://gigaprint.app/stl-splitter">Try the giant print splitter <ArrowUpRight size={15}/></a>
            </div>
            <div className="trust-row"><span><ShieldCheck size={16}/> Files stay on your device</span><span><Sparkles size={16}/> Free previews</span><span><Box size={16}/> STL & 3MF exports</span></div>
          </div>
          <div className="hero-art" aria-label="Decorative 3D printing illustration">
            <div className="art-glow"/>
            <div className="art-grid"/>
            <div className="floating-chip chip-top"><span className="chip-dot"/> STL ready</div>
            <div className="printer">
              <div className="printer-top"><div className="printer-window"><div className="print-object"><i/><i/><i/><i/><i/></div></div><div className="printer-spool"/></div>
              <div className="printer-body"><div className="printer-screen"><span/><span/><span/></div><div className="printer-slot"/></div>
              <div className="printer-base"/>
            </div>
            <div className="floating-chip chip-bottom"><Layers3 size={15}/> Print-ready in minutes</div>
            <div className="art-caption">DESIGN <b>·</b> PREVIEW <b>·</b> PRINT</div>
          </div>
        </section>

        <section className="benefits">
          <div><span className="benefit-icon purple"><ShieldCheck size={19}/></span><span><b>Your files stay yours</b><small>Processed locally in your browser</small></span></div>
          <div><span className="benefit-icon blue"><Box size={19}/></span><span><b>Made for 3D printing</b><small>STL, OBJ and 3MF workflows</small></span></div>
          <div><span className="benefit-icon orange"><Sparkles size={19}/></span><span><b>Free to get started</b><small>Explore tools with free previews</small></span></div>
        </section>

        <section className="tools-section" id="all-tools">
          <div className="section-heading">
            <div><div className="section-kicker">THE WORKBENCH</div><h2>Find your next <span>print.</span></h2><p>Practical tools to take your ideas from a file to a finished print.</p></div>
            <a className="view-all" href="https://gigaprint.app/#all-tools">View original tool directory <ArrowUpRight size={15}/></a>
          </div>
          <label className="search-box"><Search size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools..." aria-label="Search tools"/><kbd>⌘ K</kbd></label>
          <div className="tool-grid">
            {filtered.map((tool) => {
              const Icon = tool.icon;
              return <a className="tool-card" href={tool.href} key={tool.title}>
                <div className="tool-card-top"><span className="tool-icon"><Icon size={21}/></span>{tool.tag && <span className="popular-tag">{tool.tag}</span>}<ArrowUpRight className="card-arrow" size={17}/></div>
                <div className="tool-category">{tool.category}</div><h3>{tool.title}</h3><p>{tool.description}</p>
                <span className="card-cta">Explore tool <ArrowRight size={14}/></span>
              </a>;
            })}
            {filtered.length === 0 && <div className="empty-state">No tools match “{query}”. Try another search.</div>}
          </div>
          <p className="catalog-note">This is an initial verified sample of the tool directory. More tools will be added after each original route is inspected.</p>
        </section>

        <section className="privacy-banner"><div className="privacy-icon"><ShieldCheck size={24}/></div><div><h2>Your files never leave your device.</h2><p>GigaPrint tools are designed to run in your browser. Your models and photos stay on your computer while you work.</p></div><a href="https://gigaprint.app/privacy">Learn about privacy <ArrowUpRight size={15}/></a></section>
      </main>

      <footer className="footer"><a className="brand" href="/"><span className="brand-mark"><Layers3 size={19}/></span><span>Giga<span>Print</span></span></a><p>3D print workbench · runs in your browser, files never leave it</p><div className="footer-links"><a href="https://gigaprint.app/about">About</a><a href="https://gigaprint.app/help">Help</a><a href="https://gigaprint.app/privacy">Privacy</a><a href="https://gigaprint.app/terms">Terms</a></div><small>Independent reconstruction project. Not affiliated with GigaPrint.</small></footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
