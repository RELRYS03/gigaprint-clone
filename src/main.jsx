import React from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, ArrowUpRight, Box, Calculator, ChevronDown, CircleHelp,
  Clock3, FileBox, Grid2X2, Layers3, Menu, Search, ShieldCheck,
  Sparkles, Wrench, X, Printer, Image, Lamp, Home, Scissors, Package
} from "lucide-react";
import "./styles.css";
import GiantPrint from "./GiantPrint.jsx";

const categories = [
  { label: "All tools", href: "#all-tools" },
  { label: "Home organization", href: "https://gigaprint.app/home-organization" },
  { label: "STL tools", href: "#stl-tools" },
  { label: "Photo to 3D", href: "#photo-to-3d" },
  { label: "Decor", href: "#decor" },
  { label: "Calculators", href: "https://gigaprint.app/3d-printing-calculators" }
];

const tools = [
  { title: "Giant print (STL splitter)", description: "Split big STL, OBJ and 3MF models into bed-sized blocks, add alignment joints and get an assembly sheet.", category: "STL tools", icon: Layers3, tag: "Popular", href: "https://gigaprint.app/stl-splitter", image: "https://gigaprint.app/img/tools/split.webp" },
  { title: "Drawer organizer", description: "Design custom-fit drawer bins, silverware trays, utensil holders and spice cradles.", category: "Home organization", icon: Grid2X2, tag: "Popular", href: "https://gigaprint.app/drawer-organizer", image: "https://gigaprint.app/img/tools/drawer.webp" },
  { title: "Customize Your Pelican", description: "Create a fitted organizer, grid board, replacement handle or name plate for your case.", category: "Home organization", icon: Package, href: "https://gigaprint.app/customize-your-pelican" },
  { title: "Phone case generator", description: "Make a custom phone case or a snap-on MacBook shell for your exact device.", category: "Accessories", icon: Box, href: "https://gigaprint.app/phone-case-generator" },
  { title: "Picture frame maker", description: "Design a custom frame for a photo or art print, with a mat, hanger and printable sections.", category: "Decor", icon: Image, href: "https://gigaprint.app/picture-frame-maker" },
  { title: "Lithophane maker", description: "Turn a photo into a 3D printable panel that reveals the image when illuminated.", category: "Photo to 3D", icon: Sparkles, href: "https://gigaprint.app/lithophane-maker" },
  { title: "Multi-color prints from graphic files", description: "Turn a PNG, JPG or SVG into a multi-color print with assigned filaments in a 3MF.", category: "Photo to 3D", icon: Layers3, href: "https://gigaprint.app/multicolor-3d-print-maker" },
  { title: "Box maker", description: "Create printable boxes with custom dimensions, lids, fit clearance and magnet pockets.", category: "Home organization", icon: FileBox, href: "https://gigaprint.app/box-maker" },
  { title: "Repair STL", description: "Check and repair common mesh problems in STL, OBJ and 3MF files.", category: "STL tools", icon: Wrench, href: "https://gigaprint.app/stl-repair" },
  { title: "Separate parts", description: "Find disconnected parts in a model and export individual STL files or a multi-object 3MF.", category: "STL tools", icon: Layers3, href: "https://gigaprint.app/separate-stl-parts" },
  { title: "Hollow", description: "Shell a model, add drain holes and inspect the inside with a live cross-section.", category: "STL tools", icon: Box, href: "https://gigaprint.app/hollow-stl" },
  { title: "Mold maker", description: "Create a two-part or multi-piece mold with registration keys and pour openings.", category: "STL tools", icon: Package, href: "https://gigaprint.app/mold-maker" },
  { title: "Christmas ornament maker", description: "Create heat-formed lattice ornaments with a matching two-part press.", category: "Decor", icon: Sparkles, href: "https://gigaprint.app/christmas-ornament-maker" },
  { title: "Shadow lamp generator", description: "Turn a character, logo or silhouette into a lamp that projects its image.", category: "Photo to 3D", icon: Lamp, href: "https://gigaprint.app/shadow-lamp-generator" },
  { title: "3D print cost calculator", description: "Calculate filament, electricity, printer wear, labour, extras and failed prints.", category: "Calculators", icon: Calculator, href: "https://gigaprint.app/3d-print-cost-calculator" },
  { title: "3D print price calculator", description: "Set a selling price using costs, markup or margin, fees, shipping and profit.", category: "Calculators", icon: Calculator, href: "https://gigaprint.app/3d-print-price-calculator" }
];

const faq = [
  ["Is GigaPrint free?", "Yes. The free plan needs no account and includes limited exports for selected tools, previews and print estimates. Pro unlocks every tool at full size."],
  ["Are my files uploaded?", "No. GigaPrint runs in your browser. Models and photos are processed on your own device and never leave it."],
  ["Do I need to install anything?", "No. Open GigaPrint in a current desktop browser. It needs JavaScript and WebGL."],
  ["Which file formats are supported?", "It opens STL, OBJ and 3MF models, including multi-object 3MF projects, plus PNG or JPG images. Depending on the tool, it saves STL, multi-object 3MF, 3MF build plates, SVG cut sheets and PDF assembly sheets."],
  ["Does it estimate filament and print time?", "Yes. It estimates filament weight and length, material cost and rough print time. Your slicer has the final word."],
  ["Can I sell what I print?", "Pro covers hobby projects and selling the prints you make. Commercial is for print shops, farms and studios."]
];

function App() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("All tools");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState(0);
  const filtered = tools.filter((tool) => {
    const matchesText = (tool.title + " " + tool.description + " " + tool.category).toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "All tools" || tool.category === category;
    return matchesText && matchesCategory;
  });

  return (
    <div className="site-shell">
      <div className="announcement"><span className="status-dot" /> 3D print workbench <span className="announcement-separator">·</span> runs in your browser, files never leave it <span className="announcement-account">Sign in · 2 free · no card</span></div>
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
            <h1>Make print-ready<br/><span>STL files in seconds.</span></h1>
            <p className="hero-description">GigaPrint is a free, in-browser 3D printing workbench. Split big models into printable parts, make custom organizers, turn photos into 3D prints and export ready-to-print files — all on your own device.</p>
            <div className="hero-actions">
              <a className="button" href="#all-tools">Explore all tools <ArrowRight size={17}/></a>
              <a className="text-link" href="https://gigaprint.app/stl-splitter">Try the giant print splitter <ArrowUpRight size={15}/></a>
            </div>
            <div className="trust-row"><span><ShieldCheck size={16}/> Files stay on your device</span><span><Sparkles size={16}/> Free previews</span><span><Box size={16}/> STL & 3MF exports</span></div>
          </div>
          <div className="hero-art" aria-label="3D print workbench illustration">
            <div className="art-glow"/>
            <div className="art-grid"/>
            <div className="floating-chip chip-top"><span className="chip-dot"/> STL ready</div>
            <div className="printer">
              <div className="printer-top"><div className="printer-window"><div className="print-object"><i/><i/><i/><i/><i/></div></div><div className="printer-spool"/></div>
              <div className="printer-body"><div className="printer-screen"><span/><span/><span/></div><div className="printer-slot"/></div>
              <div className="printer-base"/>
            </div>
            <div className="floating-chip chip-bottom"><Layers3 size={15}/> Print-ready models</div>
            <div className="art-caption">DESIGN <b>·</b> PREVIEW <b>·</b> EXPORT</div>
          </div>
        </section>

        <section className="benefits">
          <div><span className="benefit-icon purple"><ShieldCheck size={19}/></span><span><b>Runs in your browser</b><small>Your files never leave your device</small></span></div>
          <div><span className="benefit-icon blue"><Printer size={19}/></span><span><b>Made for 3D printing</b><small>STL, OBJ and 3MF workflows</small></span></div>
          <div><span className="benefit-icon orange"><Sparkles size={19}/></span><span><b>Free to get started</b><small>Previews without an account</small></span></div>
        </section>

        <section className="popular-section" id="popular">
          <div className="section-heading">
            <div><div className="section-kicker">START CREATING</div><h2>Popular <span>generators.</span></h2><p>Open a tool, try the example, and make it your own.</p></div>
          </div>
          <div className="popular-grid">
            {tools.slice(0, 4).map((tool) => {
              const Icon = tool.icon;
              return <a className="popular-card" href={tool.href} key={tool.title}>
                {tool.image ? <img src={tool.image} alt="" loading="lazy"/> : <div className="popular-placeholder"><Icon size={31}/></div>}
                <div className="popular-card-copy"><span className="tool-category">{tool.category}</span><h3>{tool.title}</h3><p>{tool.description}</p><span className="card-cta">Open generator <ArrowRight size={14}/></span></div>
              </a>;
            })}
          </div>
        </section>

        <section className="pricing-strip">
          <div><span className="pricing-kicker">FREE TO START</span><h2>Make your next print<br/><span>without the setup.</span></h2><p>Explore every tool with free previews. No credit card needed.</p></div>
          <div className="price-offer"><div className="price-label">GigaPrint Pro · Founder offer</div><div className="price-value">$49 <small>lifetime</small></div><p>Regular $79 · Monthly $7.99</p><a href="https://gigaprint.app/#pricing">See plans <ArrowUpRight size={15}/></a></div>
        </section>

        <section className="tools-section" id="all-tools">
          <div className="section-heading">
            <div><div className="section-kicker">THE WORKBENCH</div><h2>All <span>tools.</span></h2><p>Choose a generator or find the right tool for your next print.</p></div>
            <a className="view-all" href="https://gigaprint.app/tools">View all on GigaPrint <ArrowUpRight size={15}/></a>
          </div>
          <div className="category-row" aria-label="Tool categories">
            {categories.map((item) => <a href={item.href} key={item.label} className={category === item.label ? "category-chip active" : "category-chip"} onClick={(event) => { if (item.label !== "All tools" && item.label !== "STL tools" && item.label !== "Photo to 3D" && item.label !== "Decor") return; event.preventDefault(); setCategory(item.label); }}>{item.label}</a>)}
          </div>
          <label className="search-box"><Search size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools..." aria-label="Search tools"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={15}/></button>}</label>
          <div className="tool-grid">
            {filtered.map((tool) => {
              const Icon = tool.icon;
              return <a className="tool-card" href={tool.href} key={tool.title}>
                <div className="tool-card-top"><span className="tool-icon"><Icon size={21}/></span>{tool.tag && <span className="popular-tag">{tool.tag}</span>}<ArrowUpRight className="card-arrow" size={17}/></div>
                <div className="tool-category">{tool.category}</div><h3>{tool.title}</h3><p>{tool.description}</p>
                <span className="card-cta">Open tool <ArrowRight size={14}/></span>
              </a>;
            })}
            {filtered.length === 0 && <div className="empty-state">No tools match your search. Try another term.</div>}
          </div>
          <p className="catalog-note">This reconstruction currently includes a verified subset of GigaPrint routes. Tool pages and export behavior are being inspected before implementation.</p>
        </section>

        <section className="faq-section">
          <div className="faq-intro"><div className="section-kicker">GOOD TO KNOW</div><h2>Questions, <span>answered.</span></h2><p>How GigaPrint works, what you can export and where your files go.</p><a className="text-link" href="https://gigaprint.app/help">Visit help center <ArrowUpRight size={15}/></a></div>
          <div className="faq-list">{faq.map(([question, answer], index) => <div className="faq-item" key={question}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{question}</span><ChevronDown size={17}/></button>{openFaq === index && <p>{answer}</p>}</div>)}</div>
        </section>

        <section className="community-banner"><div className="community-icon"><Sparkles size={23}/></div><div><h2>What should we build next?</h2><p>Suggest a generator or tell GigaPrint what to improve. Every idea is read.</p></div><a href="https://www.facebook.com/groups/1140267908347564">Join the community <ArrowUpRight size={15}/></a></section>
        <section className="privacy-banner"><div className="privacy-icon"><ShieldCheck size={24}/></div><div><h2>Your files never leave your device.</h2><p>Models and photos are processed locally in your browser. Nothing is uploaded to a server.</p></div><a href="https://gigaprint.app/privacy">Learn about privacy <ArrowUpRight size={15}/></a></section>
      </main>

      <footer className="footer"><a className="brand" href="/"><span className="brand-mark"><Layers3 size={19}/></span><span>Giga<span>Print</span></span></a><p>3D print workbench · runs in your browser, files never leave it</p><div className="footer-links"><a href="https://gigaprint.app/about">About</a><a href="https://gigaprint.app/help">Help</a><a href="https://gigaprint.app/guides">Guides</a><a href="https://gigaprint.app/privacy">Privacy</a><a href="https://gigaprint.app/terms">Terms</a></div><small>Independent reconstruction project. Not affiliated with GigaPrint.</small></footer>
    </div>
  );
}

const Root = window.location.pathname.replace(/\/+$/, "") === "/stl-splitter" ? GiantPrint : App;
createRoot(document.getElementById("root")).render(<React.StrictMode><Root/></React.StrictMode>);
