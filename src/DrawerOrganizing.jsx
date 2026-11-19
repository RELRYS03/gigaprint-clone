import React from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Globe2, Folder } from "lucide-react";
import "./drawer-organizing.css";

function DrawerBinsIllustration() {
  return (
    <svg className="dg-illustration" viewBox="0 0 240 220" role="img" aria-label="Ilustración de un organizador de cajón con varios compartimentos">
      <path d="M24 183H216" stroke="#9BC9C1" strokeWidth="2" />
      <rect x="48" y="51" width="144" height="106" rx="9" fill="#fff" stroke="#087C70" strokeWidth="2.5"/>
      <rect x="54" y="58" width="132" height="48" rx="5" fill="#E8F6F1" stroke="#087C70" strokeWidth="2"/>
      <rect x="62" y="66" width="27" height="31" rx="4" fill="#74BEB2" stroke="#087C70" strokeWidth="1.7"/>
      <rect x="96" y="66" width="36" height="31" rx="4" fill="#91CBB9" stroke="#087C70" strokeWidth="1.7"/>
      <rect x="139" y="66" width="26" height="31" rx="4" fill="#5B8FE3" stroke="#2459A9" strokeWidth="1.7"/>
      <rect x="171" y="66" width="15" height="31" rx="3" fill="#F2C963" stroke="#A67A1E" strokeWidth="1.5"/>
      <rect x="54" y="113" width="132" height="37" rx="5" fill="#F8FCFA" stroke="#087C70" strokeWidth="2"/>
      <rect x="108" y="124" width="42" height="13" rx="6" fill="#D6B85A" stroke="#087C70" strokeWidth="1.5"/>
      <rect x="114" y="128" width="30" height="5" rx="2.5" fill="#087C70"/>
      <path d="M48 51V157M192 51V157" stroke="#087C70" strokeWidth="1.2" opacity=".5"/>
    </svg>
  );
}
function DrawerMatIllustration() {
  return (
    <svg className="dg-illustration" viewBox="0 0 240 220" role="img" aria-label="Ilustración de una alfombrilla modular encajada en un cajón">
      <path d="M27 187H213" stroke="#D6C3A0" strokeWidth="1.7" opacity=".65"/>
      <rect x="42" y="49" width="156" height="111" rx="11" fill="#C8B07D" stroke="#927746" strokeWidth="2"/>
      <rect x="51" y="57" width="138" height="94" rx="8" fill="#B7E1D2" stroke="#398B79" strokeWidth="2"/>
      <path d="M97 58V150M143 58V150M52 104H188" stroke="#8ABDAE" strokeWidth="1.6"/>
      {[[71,78],[87,92],[119,77],[162,83],[177,105],[67,124],[111,129],[156,130],[133,97],[92,118],[173,66],[62,98]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3.2" fill={i%3===0?"#E7C86F":"#F5E2A2"}/>)}
      <rect x="98" y="153" width="44" height="9" rx="4.5" fill="#BDA16A" stroke="#927746" strokeWidth="1.5"/>
    </svg>
  );
}
function PotsDrawerIllustration() {
  return (
    <svg className="dg-illustration" viewBox="0 0 240 220" role="img" aria-label="Ilustración de un tablero organizador para ollas y sartenes">
      <path d="M25 184H214" stroke="#C7B58C" strokeWidth="1.7"/>
      <path d="M39 94L121 61L204 94L121 126Z" fill="#E9D7B7" stroke="#9B7642" strokeWidth="2"/>
      <path d="M39 94V157L121 179V126Z" fill="#DDC7A2" stroke="#9B7642" strokeWidth="2"/>
      <path d="M121 126L204 94V157L121 179Z" fill="#CDB58C" stroke="#9B7642" strokeWidth="2"/>
      <path d="M58 101L121 77L184 101L121 125Z" fill="#F3E7CE" stroke="#9B7642" strokeWidth="1.3"/>
      <path d="M72 105L72 80M99 112L99 88M146 112L146 88M171 105L171 80" stroke="#267765" strokeWidth="5" strokeLinecap="round"/>
      <path d="M72 82L72 67M99 90L99 74M146 90L146 74M171 82L171 67" stroke="#174C43" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="155" cy="72" rx="23" ry="7" fill="#BCC6CA" stroke="#697780" strokeWidth="1.7"/>
      <path d="M132 72V92C132 98 178 98 178 92V72" fill="#D8E0E2" stroke="#697780" strokeWidth="1.7"/>
      <ellipse cx="155" cy="92" rx="23" ry="7" fill="#C5D0D1" stroke="#697780" strokeWidth="1.5"/>
      <path d="M151 64C151 51 160 47 169 51" fill="none" stroke="#697780" strokeWidth="2"/>
      <rect x="108" y="158" width="26" height="6" rx="3" fill="#B88A38"/>
      <circle cx="84" cy="88" r="3" fill="#EFC96D"/><circle cx="120" cy="98" r="3" fill="#EFC96D"/>
    </svg>
  );
}

const copy = {
  es: {
    allTools: "Todas las herramientas", language: "Español", switchLanguage: "English version",
    back: "Todas las herramientas", kicker: "CARPETA · 3 HERRAMIENTAS",
    title: "Organización de cajones",
    description: "Herramientas para el interior de un cajón: un organizador de cajas a medida, una alfombrilla que encaja y un tablero para ollas y sartenes.",
    category: "ORGANIZACIÓN DEL HOGAR", new: "NUEVO",
    cards: [
      {title:"Organizador de cajones",description:"Contenedores de cajones e insertos de cocina personalizados. Cajón de cubiertos con un clic para tenedores, cuchillos y cucharas, además de bandejas para utensilios, soportes para especias y más.",action:"Crear un organizador de cubiertos",href:"https://gigaprint.app/es/drawer-organizer",art:DrawerBinsIllustration},
      {title:"Alfombrilla a medida para cajones",description:"Losetas que encajan y llenan tu cajón exactamente. Elige un patrón y colores, imprime en TPU o en cualquier plástico, y las uniones quedan planas.",action:"Hacer una alfombrilla de cajón",href:"https://gigaprint.app/es/drawer-mat-generator",art:DrawerMatIllustration,isNew:true},
      {title:"Cajón para ollas y sartenes",description:"Un tablero con clavos extraíbles alrededor de tus ollas, un soporte vertical para sartenes y bandejas, y un soporte para tapas. A la medida de tu cajón y dividido en losetas que caben en tu placa.",action:"Organizar el cajón de ollas",href:"https://gigaprint.app/?lang=es#potsdrawer",art:PotsDrawerIllustration,isNew:true}
    ]
  },
  en: {
    allTools: "All tools", language: "English", switchLanguage: "En español",
    back: "All tools", kicker: "COLLECTION · 3 TOOLS",
    title: "Drawer organizing",
    description: "Every GigaPrint tool for the inside of a drawer: custom-fit bins, a snap-together mat and a pegboard for pots and pans.",
    category: "HOME ORGANIZATION", new: "NEW",
    cards: [
      {title:"Drawer organizer",description:"Custom drawer bins and kitchen inserts. Make a silverware drawer for forks, knives and spoons, plus utensil trays, spice cradles and more.",action:"Create a drawer organizer",href:"https://gigaprint.app/drawer-organizer",art:DrawerBinsIllustration},
      {title:"Fitted drawer mat",description:"Snap-together tiles that fill your drawer exactly. Choose a pattern and colors, print in TPU or any plastic, and keep the joints flat.",action:"Make a fitted drawer mat",href:"https://gigaprint.app/drawer-mat-generator",art:DrawerMatIllustration,isNew:true},
      {title:"Pots and pans drawer",description:"A pegboard with removable pegs around your pots, a vertical pan rack and a lid rack. Sized to your drawer and split into tiles that fit your build plate.",action:"Organize a pots and pans drawer",href:"https://gigaprint.app/#potsdrawer",art:PotsDrawerIllustration,isNew:true}
    ]
  }
};

export default function DrawerOrganizing() {
  const isSpanish = window.location.pathname.startsWith("/es/");
  const lang = isSpanish ? "es" : "en";
  const t = copy[lang];
  const languageHref = isSpanish ? "/drawer-organizing" : "/es/drawer-organizing";

  React.useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "es"
      ? "Organización de cajones: cajas y alfombrillas | GigaPrint"
      : "Drawer organizing: custom bins and mats | GigaPrint";
    return () => { document.documentElement.lang = "en"; };
  }, [lang]);

  return (
    <div className="dg-page">
      <header className="dg-header">
        <a className="dg-brand" href="/" aria-label="GigaPrint — home">
          <span className="dg-mark" aria-hidden="true"><i/><i/><i/><i/></span>
          <strong>GigaPrint</strong>
          <span className="dg-brand-context">{isSpanish ? "Organización" : "Organizing"}</span>
        </a>
        <nav className="dg-nav" aria-label="Main navigation">
          <a className="dg-all-tools" href="/#all-tools">{t.allTools}</a>
          <a className="dg-explore" href="/#all-tools">{isSpanish ? "Explorar herramientas" : "Explore tools"} <ArrowRight size={14}/></a>
        </nav>
        <a className="dg-language" href={languageHref} aria-label={t.switchLanguage}>
          <Globe2 size={15}/><span>{t.language}</span><ChevronDown size={13}/>
        </a>
      </header>

      <main className="dg-main" lang={lang}>
        <a className="dg-back" href="/#all-tools"><ArrowLeft size={14}/>{t.back}</a>
        <section className="dg-intro">
          <span className="dg-folder-icon" aria-hidden="true"><Folder size={22}/></span>
          <div className="dg-intro-copy"><div className="dg-kicker">{t.kicker}</div><h1>{t.title}</h1></div>
        </section>
        <p className="dg-description">{t.description}</p>
        <section className="dg-grid" aria-label={t.title}>
          {t.cards.map((card,index)=>{
            const Illustration=card.art;
            return <a className="dg-card" href={card.href} key={card.title}>
              <div className={"dg-art dg-art-"+(index+1)}><Illustration/></div>
              <div className="dg-card-copy">
                <div className="dg-card-category"><span>{t.category}</span>{card.isNew&&<b>{t.new}</b>}</div>
                <h2>{card.title}</h2><p>{card.description}</p>
                <span className="dg-card-action">{card.action}<span aria-hidden="true"> →</span></span>
              </div>
            </a>;
          })}
        </section>
        <p className="dg-local-note">{isSpanish
          ? "Todo funciona en tu navegador; tus diseños permanecen en tu dispositivo."
          : "Everything runs in your browser; your designs stay on your device."}</p>
      </main>
    </div>
  );
}
