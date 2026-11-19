/* "Popular generators" row on the home page: the week's most used tools.
   - GPUsage.open(tool) / GPUsage.exported(tool, projectId) send anonymous counters to POST /api/usage (tool id + event
     only: no account, no project data). One open per tool per browser session; exports once per project per session.
   - The row asks GET /api/popular (rolling 7 days, exports weigh 5x opens, cached 1 hour at the edge) and fills its
     6 tiles with the top tools that have a card on the home page. Until there is enough data, or if the request fails,
     the hand-picked tiles in index.template.html stay; short lists are topped up from them, so the row is never empty.
   The pure ranking (pick) is shared with tests/popular.test.js. */
(function (G) {
  'use strict';
  const SLOTS = 6;
  const MIN_SCORE = 3;    // a tool needs at least this much weekly use (e.g. 3 opens or 1 export) to earn a tile
  const MIN_TOTAL = 25;   // below this much total use in the week, keep the hand-picked row
  const MAX_AGE = 3600 * 1000, STALE_OK = 7 * 24 * 3600 * 1000;
  const STORE = 'gp.popular.v1';
  // Tool ids that live inside another tool's card (tabs of one app).
  const CARD_OF = { caseinsert: 'pelicancase', holster: 'pelicancase', casehandle: 'pelicancase', nameplate: 'pelicancase', mgrid: 'pelicancase', storage: 'pelicancase',
    'pelicancase-organizer': 'pelicancase', 'pelicancase-grid': 'pelicancase', 'pelicancase-storage': 'pelicancase', 'pelicancase-holster': 'pelicancase',
    'pelicancase-handle': 'pelicancase', 'pelicancase-nameplate': 'pelicancase', 'customize-your-pelican': 'pelicancase',
    lamp: 'lampshade', 'lamp-generator': 'lampshade', lampgenerator: 'lampshade', homeorg: 'drawer' };
  const canon = id => { id = String(id || '').toLowerCase(); return CARD_OF[id] || id; };

  // ranked: [{tool, score}] from the API, best first. available(id) -> true when the tool has a visible home card.
  // defaults: the hand-picked tile ids, in order. Returns the SLOTS tile ids to show.
  function pick(ranked, available, defaults, slots) {
    slots = slots || SLOTS;
    const sum = new Map();
    for (const r of ranked || []) {
      if (!r || typeof r.tool !== 'string') continue;
      const id = canon(r.tool); const s = Number(r.score) || 0;
      if (s <= 0 || !available(id)) continue;
      sum.set(id, (sum.get(id) || 0) + s);
    }
    const rank = id => { const i = defaults.indexOf(id); return i < 0 ? 1e3 : i; };
    const total = [...sum.values()].reduce((a, b) => a + b, 0);
    const out = [];
    if (total >= MIN_TOTAL) {
      [...sum.entries()].filter(e => e[1] >= MIN_SCORE).sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]) || (a[0] < b[0] ? -1 : 1))
        .forEach(e => { if (out.length < slots) out.push(e[0]); });
    }
    for (const d of defaults) { if (out.length >= slots) break; if (!out.includes(d) && available(d)) out.push(d); }
    return out;
  }

  const api = { pick, canon, SLOTS, MIN_SCORE, MIN_TOTAL };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  const doc = G.document;
  const CFG = G.GIGAPRINT_CONFIG || {};
  const base = String(CFG.apiBase || '').replace(/\/$/, '');
  const ss = {
    get(k) { try { return G.sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { G.sessionStorage.setItem(k, v); } catch (e) {} }
  };
  // Automated browsers (our own e2e runs, crawlers) are not counted unless a test opts in.
  const tracking = () => !!base && (!G.navigator.webdriver || G.GP_USAGE_FORCE === true);
  const sent = [];
  function send(tool, event) {
    tool = canon(tool);
    if (!/^[a-z][a-z0-9-]{1,31}$/.test(tool)) return;
    sent.push({ tool, event });
    if (!tracking()) return;
    try {
      G.fetch(base + '/api/usage', { method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true,
        headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ tool, event }) }).catch(() => {});
    } catch (e) {}
  }
  function once(key) { const k = 'gp.usage.' + key; if (ss.get(k)) return false; ss.set(k, '1'); return true; }
  api.open = tool => { if (tool && once('o.' + canon(tool))) send(tool, 'open'); };
  api.exported = (tool, projectId) => { if (tool && once('e.' + canon(tool) + '.' + (projectId || Math.floor(Date.now() / 60000)))) send(tool, 'export'); };
  api.sent = sent;

  // ---- the row
  const row = () => doc.querySelector('.popular .popular-row');
  const card = id => doc.querySelector('#all-tools [data-go="' + id + '"]');
  const available = id => { const c = card(id); return !!c && !c.hidden && c.dataset.retired !== '1'; };
  let snap = null; // the hand-picked tiles, as shipped
  function snapshot() {
    const r = row(); if (!r || snap) return;
    snap = new Map();
    r.querySelectorAll('.pop[data-pop]').forEach(b => snap.set(b.dataset.pop, [...b.childNodes].map(n => n.cloneNode(true))));
  }
  function fillArt(b, id) {
    const slot = b.querySelector('.pop-art'); if (!slot || slot.firstElementChild) return;
    const a = doc.querySelector('.cards [data-go="' + id + '"] .art svg') || doc.querySelector('.cards [data-go="' + id + '"] .art img');
    if (!a) return;
    const c = a.cloneNode(true); c.querySelectorAll && c.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    if (c.tagName === 'IMG') { c.loading = 'lazy'; c.className = 'pop-img'; }
    slot.appendChild(c);
  }
  function tileNodes(id) {
    if (snap.has(id)) return snap.get(id).map(n => n.cloneNode(true));
    const c = card(id);
    const h = c.querySelector('h2'), hc = h ? h.cloneNode(true) : null; if (hc) hc.querySelectorAll('.new-pill').forEach(x => x.remove());
    const title = ((hc || {}).textContent || id).replace(/\s+/g, ' ').trim();
    const tag = c.querySelector('.tagline');
    let sub = '', pill = false;
    if (tag) { const t = tag.cloneNode(true); t.querySelectorAll('.new-pill').forEach(x => { pill = true; x.remove(); }); sub = t.textContent.replace(/\s+/g, ' ').trim(); }
    const art = doc.createElement('span'); art.className = 'pop-art'; art.setAttribute('aria-hidden', 'true');
    const b = doc.createElement('b'); b.textContent = title;
    if (pill) { const i = doc.createElement('i'); i.className = 'new-pill'; i.textContent = 'New'; b.append(' ', i); }
    const out = [art, b];
    if (sub) { const s = doc.createElement('small'); s.textContent = sub; out.push(s); }
    return out;
  }
  function render(ranked, source) {
    const r = row(); if (!r) return;
    snapshot();
    const tiles = [...r.querySelectorAll('.pop')];
    const defaults = [...snap.keys()];
    const ids = pick(ranked, available, defaults, tiles.length || SLOTS);
    if (ids.length < tiles.length) return; // never leave a tile empty
    tiles.forEach((b, i) => {
      const id = ids[i];
      if (b.dataset.pop !== id) {
        b.dataset.go = id; b.dataset.pop = id;
        b.replaceChildren(...tileNodes(id));
      }
      fillArt(b, id);
    });
    r.dataset.popular = source;
    r.dataset.popularIds = ids.join(',');
  }
  function load() {
    let cached = null;
    try { cached = JSON.parse(G.localStorage.getItem(STORE) || 'null'); } catch (e) {}
    const age = cached && cached.at ? Date.now() - cached.at : Infinity;
    if (cached && Array.isArray(cached.tools) && age < STALE_OK) render(cached.tools, 'cache');
    else { const r = row(); if (r) r.dataset.popular = 'default'; }
    if (!base || age < MAX_AGE) return;
    G.fetch(base + '/api/popular?limit=12', { credentials: 'omit' })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status)))
      .then(d => {
        if (!d || !Array.isArray(d.tools)) return;
        try { G.localStorage.setItem(STORE, JSON.stringify({ at: Date.now(), tools: d.tools })); } catch (e) {}
        render(d.tools, 'live');
      })
      .catch(() => {}); // keep whatever the row shows now
  }
  api.render = render;
  api.load = load;
  G.GPUsage = api;
  G.GPPopular = api;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => { snapshot(); load(); });
  else { snapshot(); load(); }
})(typeof window !== 'undefined' ? window : globalThis);
