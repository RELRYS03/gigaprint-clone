/* Tool search (home grid + All tools picker) and a reusable searchable <select>. */
(function (root) {
  'use strict';

  const KEYWORDS = {
    split: ['giant', 'print', 'split', 'big', 'large', 'scale', 'blocks', 'bed', 'model', 'stl', 'cut', 'gigante'],
    drawer: ['drawer', 'organizer', 'bin', 'kitchen', 'silverware', 'bathroom', 'ba\u00f1o', 'utensil', 'spice', 'home', 'organization', 'forks', 'knives', 'spoons', 'insert', 'caj\u00f3n', 'organizador'],
    lightbox: ['lightbox', 'light box', 'channel letters', 'letters', 'sign', 'lit sign', 'led', 'neon', 'open sign', 'marquee', 'halo', 'backlit', 'storefront', 'name', 'word', 'lamp', 'light', 'letra', 'letras', 'caixa', 'letrero', 'luminoso', 'r\u00f3tulo'],
    coaster: ['coaster', 'coasters', 'custom coaster', 'drink', 'cup', 'mug', 'glass', 'set', 'holder', 'logo', 'name', 'text', 'personalized', 'custom', 'gift', 'wedding', 'family', 'bar', 'cork', 'rope', 'greek key', 'posavasos', 'posavaso', 'regalo'],
    barmat: ['bar', 'mat', 'bar mat', 'rail', 'spill', 'drip', 'nubs', 'rubber', 'tpu', 'pub', 'home bar', 'man cave', 'coaster', 'logo', 'name', 'personalized', 'custom', 'beer', 'cocktail', 'alfombrilla', 'barra', 'posavasos'],
    drawermat: ['drawer', 'mat', 'liner', 'tile', 'tiles', 'snap', 'tpu', 'flexible', 'non-slip', 'nubs', 'grid', 'hex', 'waves', 'ribbed', 'diamond', 'dots', 'terrazzo', 'pattern', 'kitchen', 'home', 'organization', 'caj\u00f3n', 'alfombrilla', 'tapete', 'loseta'],
    toolorg: ['tool', 'organizer', 'bits', 'screwdriver', 'sockets', 'holder', 'sae', 'metric', 'home', 'organization', 'organizador'],
    wallplate: ['wall', 'plate', 'switch', 'outlet', 'cover', 'gang', 'light', 'home', 'organization'],
    potsdrawer: ['pots', 'pans', 'drawer', 'pegboard', 'lid', 'kitchen', 'home', 'organization', 'frying', 'caj\u00f3n'],
    fridge: ['refrigerator', 'fridge', 'egg', 'soda', 'can', 'bottle', 'organizer', 'produce', 'home', 'organization', 'nevera', 'refrigerador'],
    frame: ['picture', 'frame', 'photo', 'mat', 'molding', 'art', 'hang', 'marco'],
    ornament: ['ornament', 'christmas', 'holiday', 'bauble', 'snowflake', 'star', 'tree', 'name', 'lithophane', 'christmas light', 'adorno', 'navidad'],
    c7bulb: ['christmas', 'bulb', 'c7', 'holiday', 'light', 'ornament', 'navidad', 'adorno'],
    mc: ['multi', 'color', 'logo', 'graphic', 'filament', 'keychain', 'sign', 'llavero'],
    bubble: ['bubble', 'letters', 'name', 'word', 'wall', 'shelf', 'sign'],
    box: ['box', 'storage', 'lid', 'container', 'bin', 'caja'],
    suspend: ['suspended', 'floating', 'frame', 'cage', 'strings'],
    mold: ['mold', 'cast', 'resin', 'plaster', 'wax', 'molde'],
    litho: ['lithophane', 'photo', 'light', 'lamp', 'picture', 'litofan\u00eda'],
    relief: ['relief', 'plaque', 'coin', 'medallion', 'sign', 'carved', 'letrero'],
    shape: ['cutter', 'cookie', 'stamp', 'keychain', 'badge', 'tag', 'drawing', 'logo', 'llavero'],
    laser: ['laser', 'cnc', 'layers', 'waffle', 'svg', 'sheets'],
    fx: ['mesh', 'fx', 'lowpoly', 'low-poly', 'wireframe', 'faceted'],
    hollow: ['hollow', 'shell', 'resin', 'drain', 'filament'],
    combine: ['combine', 'join', 'cut', 'label', 'boolean', 'text'],
    puzzle: ['jigsaw', 'puzzle', 'pieces', 'rompecabezas'],
    separate: ['separate', 'parts', 'split', 'loose'],
    repair: ['repair', 'fix', 'holes', 'mesh', 'stl', 'reparar'],
    rims: ['trash', 'can', 'rims', 'wheels', 'bin'],
    necklace: ['cuban', 'link', 'necklace', 'chain', 'jewelry', 'clasp', 'pendant', 'medallion', 'collar'],
    qrtags: ['qr', 'code', 'wifi', 'wi-fi', 'tag', 'keychain', 'coaster', 'llavero'],
    sign: ['sign', 'nameplate', 'door', 'desk', 'wall', 'text', 'letrero', 'cartel'],
    keytags: ['keychain', 'keychains', 'pet', 'tags', 'names', 'bone', 'llavero'],
    heartpuzzle: ['heart', 'puzzle', 'keychain', 'keychains', 'jigsaw', 'names', 'corazon', 'coraz\u00f3n', 'rompecabezas', 'llavero'],
    flexname: ['flex', 'name', 'chain', 'mail', 'keychain', 'articulated', 'llavero'],
    paint: ['filament', 'painting', 'photo', 'color', 'layers'],
    plateframe: ['license', 'plate', 'frame', 'car', 'vehicle', 'banner', 'marco'],
    hexwall: ['hex', 'storage', 'wall', 'honeycomb', 'hooks', 'grid'],
    plantpot: ['plant', 'pot', 'tray', 'planter', 'saucer', 'vase', 'maceta'],
    stamp: ['stamp', 'logo', 'text', 'roller', 'handle', 'sello'],
    lightercase: ['lighter', 'case', 'sleeve', 'cover', 'holder', 'disposable', 'refillable', 'clip', 'carabiner', 'keychain', 'name', 'logo', 'encendedor', 'mechero', 'funda'],
    clicker: ['clicker', 'keychain', 'name', 'logo', 'switch', 'llavero'],
    robotarm: ['robot', 'arm', 'servo', 'gripper', 'brazo'],
    pelicancase: ['pelican', 'apache', 'case', 'hard', 'customize', 'insert', 'organizer', 'divider', 'tray', 'bins', 'foam', 'camera', 'gear', 'grid', 'multipoint', 'pegboard', 'board', '25mm',
      'holster', 'storage', 'canister', 'screw-top', 'screw-on', 'sd', 'microsd', 'device', 'charger', 'brick', 'router', 'mount', 'power', 'handle', 'name', 'nameplate', 'plate', 'label', '1510', '1535', '1560', '1610', '1615', '1620', '1650', '5800', '1557',
      'roller', 'rolling', 'luggage', 'carry-on', 'lid', 'maleta', 'asa', 'funda', 'organizador', 'estuche', 'placa'],
    phonecase: ['phone', 'case', 'iphone', 'galaxy', 'pixel', 'macbook', 'laptop', 'bumper', 'shell', 'tel\u00e9fono', 'port\u00e1til', 'fundas'],
    lampshade: ['lampshade', 'lamp', 'shade', 'lamp generator', 'generator', 'designer', 'standard', 'lithophane', 'litho', 'photo', 'picture', 'light', 'night', 'glow', 'drum', 'globe', 'lantern', 'heart', 'star', 'cabin', 'gift', 'lamp base', 'bulb', 'socket', 'e26', 'e12', 'puck', 'tea light', 'pagoda', 'flower', 'pantalla', 'base de l\u00e1mpara', 'l\u00e1mpara', 'generador de l\u00e1mparas', 'litofan\u00eda', 'foto'],
    cubbies: ["cubby", "cubbies", "form fit", "form-fit", "shadow board", "tool drawer", "foam", "screwdriver", "wrench", "pliers", "pen", "marker", "makeup", "lipstick", "nail polish", "brush", "jewelry", "ring", "earring", "necklace", "scrunchie", "hair", "socks", "underwear", "belt", "tie", "lid", "logo", "knob", "backer", "cub\u00edculo", "maquillaje", "joyer\u00eda", "herramientas", "calcetines"],
    cabinet: ["cabinet", "cupboard", "pantry", "under sink", "under-sink", "sink", "pipe", "stackable", "stack", "bins", "pull-out", "pull out", "drawer unit", "shelf riser", "riser", "step shelf", "spice", "blind corner", "corner", "lazy susan", "vanity", "kitchen", "backer", "gabinete", "alacena", "despensa", "fregadero", "apilable", "esquina"],
    gridbin: ["grid bin", "grid bins", "42 mm", "42mm", "bin", "bins", "baseplate", "base plate", "storage", "drawer", "organizer", "organiser", "tray", "sorting", "compartment", "stackable", "stacking", "modular", "screws", "parts bin", "caja", "cajas", "organizador", "caj\u00f3n", "base"],
    vase: ["vase", "planter", "pot", "flower pot", "pen cup", "pencil cup", "spiral vase", "vase mode", "spiralize", "twisted vase", "lamp shade", "decor", "home decor", "florero", "jarr\u00f3n", "maceta", "portal\u00e1pices"],
    geowall: ['wall panel', 'wall panels', 'wall art', 'wall decor', 'wall tile', 'tiles', '3d tiles', 'geometric', 'hexagon', 'hex', 'honeycomb', 'triangle', 'diamond', 'square', 'brick', 'plank', 'slat', 'wave', 'faceted', 'pyramid', 'relief', 'feature wall', 'accent wall', 'backlight', 'led', 'clip', 'panel', 'panel de pared', 'paneles', 'decoraci\u00f3n', 'pared', 'hex\u00e1gono', 'azulejo'],
    objlitho: ['lithophane', 'litho', 'photo', 'picture', 'ball', 'soccer', 'football', 'baseball', 'softball', 'basketball', 'volleyball', 'tennis', 'golf', 'moon', 'globe', 'puck', 'hockey', 'egg', 'heart', 'star', 'bulb', 'pumpkin', 'apple', 'gem', 'dice', 'cube', 'pyramid', 'dome', 'mushroom', 'snowman', 'pear', 'ornament', 'ornament ball', 'christmas light', 'c7', 'c9', 'fairy light', 'bauble', 'night light', 'glow', 'gift', 'pelota', 'bal\u00f3n', 'luna', 'litofan\u00eda', 'foto', 'coraz\u00f3n', 'adorno'],
    shadowlamp: ['shadow', 'lamp', 'light', 'silhouette', 'lantern', 'night', 'projector', 'projection', 'character', 'logo', 'tea', 'candle', 'wall', 'l\u00e1mpara', 'sombra', 'silueta', 'farol'],
    cig: ['cigarette', 'expander', 'holder', 'novelty']
  };

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function tokens(q) { return norm(q).split(/\s+/).filter(Boolean); }
  function haystack(tool) {
    return norm([tool.id, tool.name, tool.tagline, tool.description].concat(tool.keywords || []).join(' '));
  }
  function matchTool(tool, query) {
    const toks = tokens(query);
    if (!toks.length) return true;
    const hay = haystack(tool);
    return toks.every(t => hay.includes(t));
  }
  function filterTools(list, query) {
    const toks = tokens(query);
    if (!toks.length) return list.slice();
    return list.filter(t => matchTool(t, query));
  }
  function filterOptions(options, query) {
    const toks = tokens(query);
    if (!toks.length) return options.slice();
    return options.filter(o => {
      const hay = norm([o.value, o.label, o.group].join(' '));
      return toks.every(t => hay.includes(t));
    });
  }
  function tr(s, vars) {
    try { if (root.GPI18n && typeof root.GPI18n.t === 'function') return root.GPI18n.t(s, vars); } catch (e) {}
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
  }

  function catalogFromCards(doc) {
    const rootEl = doc || (typeof document !== 'undefined' ? document : null);
    if (!rootEl || !rootEl.querySelectorAll) return [];
    const seen = new Set(), out = [];
    rootEl.querySelectorAll('#all-tools [data-go]').forEach(el => {
      const id = el.dataset.go; if (!id || seen.has(id)) return; seen.add(id);
      const titleEl = el.querySelector('h2');
      const tagEl = el.querySelector('.tagline');
      const pEl = el.querySelector('p');
      const name = (el.getAttribute('data-search-name') || (titleEl && titleEl.textContent) || id).replace(/\s+/g, ' ').trim();
      const tagline = (el.getAttribute('data-search-tag') || (tagEl && tagEl.textContent) || '').replace(/\s+/g, ' ').trim();
      const description = (el.getAttribute('data-search-desc') || (pEl && pEl.textContent) || '').replace(/\s+/g, ' ').trim();
      const extra = (el.getAttribute('data-keywords') || '').split(/[,\s]+/).filter(Boolean);
      const keywords = Array.from(new Set((KEYWORDS[id] || []).concat(extra)));
      out.push({ id, name, tagline, description, keywords, el });
    });
    return out;
  }

  function stampEnglish(doc) {
    const rootEl = doc || document;
    rootEl.querySelectorAll('#all-tools [data-go]').forEach(el => {
      if (el.getAttribute('data-search-name')) return;
      const titleEl = el.querySelector('h2'), tagEl = el.querySelector('.tagline'), pEl = el.querySelector('p');
      if (titleEl) el.setAttribute('data-search-name', titleEl.textContent.replace(/\s+/g, ' ').trim());
      if (tagEl) el.setAttribute('data-search-tag', tagEl.textContent.replace(/\s+/g, ' ').trim());
      if (pEl) el.setAttribute('data-search-desc', pEl.textContent.replace(/\s+/g, ' ').trim());
      if (KEYWORDS[el.dataset.go]) el.setAttribute('data-keywords', KEYWORDS[el.dataset.go].join(' '));
    });
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return !!(el.closest && el.closest('[contenteditable="true"], input, textarea, select, .gp-ss'));
  }

  // ---------------------------------------------------------------- searchable <select>
  const SS = new WeakMap();
  function optionsFromSelect(sel) {
    const out = [];
    for (const node of sel.children) {
      if (node.tagName === 'OPTGROUP') {
        const group = node.label || '';
        for (const op of node.children) if (op.tagName === 'OPTION' && !op.disabled) out.push({ value: op.value, label: op.textContent.trim(), group });
      } else if (node.tagName === 'OPTION' && !node.disabled && node.value !== '' || (node.tagName === 'OPTION' && !node.disabled)) {
        out.push({ value: node.value, label: node.textContent.trim(), group: '' });
      }
    }
    return out;
  }
  function enhanceSelect(sel, opts) {
    if (!sel || sel.dataset.gpSs === '1') {
      if (sel && SS.has(sel)) SS.get(sel).refresh();
      return sel && SS.has(sel) ? SS.get(sel) : null;
    }
    opts = opts || {};
    const placeholder = opts.placeholder || 'Search models\u2026';
    const wrap = document.createElement('div');
    wrap.className = 'gp-ss';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.dataset.gpSs = '1';
    sel.classList.add('gp-ss-native');
    sel.tabIndex = -1;
    const input = document.createElement('input');
    input.type = 'search'; input.className = 'gp-ss-input'; input.autocomplete = 'off'; input.spellcheck = false;
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-label', placeholder);
    wrap.appendChild(input);
    const list = document.createElement('div');
    list.className = 'gp-ss-list'; list.setAttribute('role', 'listbox'); list.hidden = true;
    const listId = (sel.id || 'ss') + '-list';
    list.id = listId; input.setAttribute('aria-controls', listId);
    document.body.appendChild(list);

    let open = false, active = -1, filtered = [], query = '', blurTimer = 0;
    const currentLabel = () => { const op = sel.selectedOptions[0]; return op ? op.textContent.trim() : ''; };
    const showLabel = () => { input.value = currentLabel(); query = ''; };
    function place() {
      const r = input.getBoundingClientRect(), space = innerHeight - r.bottom, up = space < 180 && r.top > space;
      list.style.position = 'fixed'; list.style.left = Math.round(r.left) + 'px'; list.style.width = Math.max(160, Math.round(r.width)) + 'px';
      list.style.zIndex = '95';
      if (up) { list.style.top = 'auto'; list.style.bottom = Math.round(innerHeight - r.top + 4) + 'px'; list.style.maxHeight = Math.min(280, r.top - 12) + 'px'; }
      else { list.style.bottom = 'auto'; list.style.top = Math.round(r.bottom + 4) + 'px'; list.style.maxHeight = Math.min(280, space - 12) + 'px'; }
    }
    function render() {
      const all = optionsFromSelect(sel);
      filtered = filterOptions(all, query);
      list.textContent = '';
      if (!filtered.length) {
        const empty = document.createElement('div'); empty.className = 'gp-ss-empty'; empty.setAttribute('role', 'status');
        empty.textContent = tr('No models match \u201c{q}\u201d.', { q: query.trim() || '\u2026' });
        list.appendChild(empty); active = -1; input.removeAttribute('aria-activedescendant');
      } else {
        let lastG = null;
        filtered.forEach((o, i) => {
          if (o.group && o.group !== lastG) {
            const g = document.createElement('div'); g.className = 'gp-ss-group'; g.textContent = o.group; list.appendChild(g); lastG = o.group;
          }
          const b = document.createElement('button'); b.type = 'button'; b.className = 'gp-ss-opt'; b.setAttribute('role', 'option');
          b.id = listId + '-' + i; b.dataset.value = o.value; b.textContent = o.label;
          b.setAttribute('aria-selected', o.value === sel.value && i === (active < 0 ? filtered.findIndex(x => x.value === sel.value) : active) ? 'true' : 'false');
          b.addEventListener('mousedown', ev => { ev.preventDefault(); choose(o.value); });
          list.appendChild(b);
        });
        if (active < 0) active = Math.max(0, filtered.findIndex(x => x.value === sel.value));
        paintActive();
      }
    }
    function paintActive() {
      const items = [...list.querySelectorAll('.gp-ss-opt')];
      items.forEach((b, i) => {
        const on = i === active; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) { input.setAttribute('aria-activedescendant', b.id); b.scrollIntoView({ block: 'nearest' }); }
      });
    }
    function openList(keepQuery) {
      if (!open) { open = true; list.hidden = false; input.setAttribute('aria-expanded', 'true'); }
      if (!keepQuery) { query = ''; if (document.activeElement === input) input.select(); }
      render(); place();
    }
    function closeList(restore) {
      if (!open && restore !== false) { showLabel(); return; }
      open = false; list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
      if (restore !== false) showLabel();
    }
    function choose(value) {
      const prev = sel.value;
      sel.value = value;
      showLabel();
      closeList(false);
      if (sel.value !== prev) sel.dispatchEvent(new Event('change', { bubbles: true }));
      else sel.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.addEventListener('focus', () => openList(false));
    input.addEventListener('input', () => { query = input.value; openList(true); });
    input.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault(); if (!open) openList(true);
        if (!filtered.length) return;
        if (active < 0) active = ev.key === 'ArrowDown' ? 0 : filtered.length - 1;
        else active = ev.key === 'ArrowDown' ? Math.min(filtered.length - 1, active + 1) : Math.max(0, active - 1);
        paintActive();
      } else if (ev.key === 'Enter') {
        ev.preventDefault(); ev.stopPropagation();
        if (open && filtered[active]) choose(filtered[active].value);
        else if (open && filtered.length === 1) choose(filtered[0].value);
        else closeList();
      } else if (ev.key === 'Escape') {
        ev.preventDefault(); ev.stopPropagation();
        if (query) { query = ''; input.value = ''; openList(true); }
        else closeList();
      } else if (ev.key === 'Tab') closeList();
    });
    input.addEventListener('blur', () => { clearTimeout(blurTimer); blurTimer = setTimeout(() => closeList(), 120); });
    sel.addEventListener('change', () => { if (!open) showLabel(); });
    const mo = new MutationObserver(() => { if (open) render(); else showLabel(); });
    mo.observe(sel, { childList: true, subtree: true, characterData: true });
    function onReposition() { if (open) place(); }
    addEventListener('resize', onReposition);
    addEventListener('scroll', onReposition, true);
    document.addEventListener('pointerdown', ev => {
      if (!open) return;
      if (wrap.contains(ev.target) || list.contains(ev.target)) return;
      closeList();
    });
    showLabel();
    const api = { refresh() { if (open) render(); else showLabel(); }, input, wrap, close: closeList };
    SS.set(sel, api);
    return api;
  }

  // ---------------------------------------------------------------- home + All tools search
  const state = { q: '', active: -1, hooks: null };

  function catalog() { return catalogFromCards(); }
  function visibleIds() { return filterTools(catalog(), state.q).map(t => t.id); }

  function noneText(q) { return tr('No tools match \u201c{q}\u201d.', { q }) + ' ' + tr('Try a different word.'); }

  function setInputs(q) {
    document.querySelectorAll('#toolSearchHome, #toolSearchPick').forEach(inp => { if (inp && inp.value !== q) inp.value = q; });
    document.querySelectorAll('.tool-search-clear').forEach(b => { if (b) b.hidden = !q; });
  }

  function applyFilter() {
    const q = state.q, ids = new Set(visibleIds()), list = catalog();
    list.forEach(t => { if (t.el) t.el.hidden = q ? !ids.has(t.id) : false; });
    document.querySelectorAll('#allToolsGrid .atp-item').forEach(b => { b.hidden = q ? !ids.has(b.dataset.go) : false; });
    const none = !ids.size && !!q;
    const homeNone = document.getElementById('toolSearchHomeNone');
    const pickNone = document.getElementById('toolSearchPickNone');
    if (homeNone) { homeNone.hidden = !none; if (none) homeNone.textContent = noneText(q); }
    if (pickNone) { pickNone.hidden = !none; if (none) pickNone.textContent = noneText(q); }
    document.querySelectorAll('#all-tools .ho-folder, #all-tools [data-search-folder]').forEach(folder => {
      const cards = [...folder.querySelectorAll('[data-go]')];
      folder.hidden = q ? !cards.some(c => !c.hidden) : false;
    });
    const grid = document.getElementById('all-tools');
    if (grid) grid.classList.toggle('is-filtered', !!q);
    const pick = document.getElementById('allToolsPick');
    if (pick) pick.classList.toggle('is-filtered', !!q); // folder tools show in the picker only while searching
    const pickGrid = document.getElementById('allToolsGrid');
    if (pickGrid) pickGrid.hidden = none;
    if (state.active >= ids.size) state.active = ids.size ? ids.size - 1 : -1;
    paintHighlight();
  }

  function items(scope) {
    const ids = visibleIds();
    if (scope === 'pick') {
      const grid = document.getElementById('allToolsGrid');
      return ids.map(id => grid && grid.querySelector(`.atp-item[data-go="${id}"]`)).filter(Boolean).filter(shown);
    }
    return ids.map(id => catalog().find(t => t.id === id)).map(t => t && t.el).filter(Boolean).filter(shown);
  }
  // Tools tucked inside a closed folder are in the DOM but not on screen: keyboard picks skip them.
  function shown(el) {
    if (el.classList && el.classList.contains('atp-item')) return !!state.q || !el.dataset.folderChild;
    const f = el.closest && el.closest('.gp-folder');
    const h = typeof document !== 'undefined' && document.getElementById('home');
    if (h && h.classList.contains('folder-open')) return !!(f && f.classList.contains('is-open'));
    return !!state.q || !f || f.classList.contains('is-open');
  }

  function paintHighlight() {
    document.querySelectorAll('.card.is-search-active, .atp-item.is-search-active').forEach(el => {
      el.classList.remove('is-search-active'); el.removeAttribute('aria-selected');
    });
    const homeItems = items('home'), pickItems = items('pick');
    const mark = (arr) => {
      const el = arr[state.active]; if (!el) return;
      el.classList.add('is-search-active'); el.setAttribute('aria-selected', 'true');
      el.scrollIntoView({ block: 'nearest' });
    };
    mark(homeItems); mark(pickItems);
    const homeInp = document.getElementById('toolSearchHome');
    const pickInp = document.getElementById('toolSearchPick');
    const setAria = (inp, arr) => {
      if (!inp) return;
      const el = arr[state.active];
      if (el) { if (!el.id) el.id = 'tool-hit-' + (el.dataset.go || ''); inp.setAttribute('aria-activedescendant', el.id); }
      else inp.removeAttribute('aria-activedescendant');
    };
    setAria(homeInp, homeItems); setAria(pickInp, pickItems);
  }

  function setQuery(q, from) {
    state.q = q; setInputs(q); applyFilter();
    if (from && !state.q) state.active = -1;
    else if (state.q && state.active < 0 && visibleIds().length) state.active = 0;
    paintHighlight();
  }

  function openActive(scope) {
    const arr = items(scope || (pickerOpen() ? 'pick' : 'home'));
    const el = arr[state.active] || arr[0];
    if (!el) return false;
    const id = el.dataset.go; if (!id) return false;
    setQuery('');
    const hooks = state.hooks || {};
    if (hooks.closeAllToolsPick) hooks.closeAllToolsPick();
    if (hooks.setTool) hooks.setTool(id);
    else el.click();
    return true;
  }

  function pickerOpen() {
    const hooks = state.hooks || {};
    if (hooks.allToolsOpen) return hooks.allToolsOpen();
    const p = document.getElementById('allToolsPick');
    return !!(p && !p.hidden);
  }
  function homeVisible() {
    const home = document.getElementById('home');
    return !!(home && !home.hidden);
  }
  function focusSearch(which) {
    const want = which || (pickerOpen() ? 'pick' : 'home');
    const id = want === 'pick' ? 'toolSearchPick' : 'toolSearchHome';
    const inp = document.getElementById(id);
    if (!inp) return false;
    if (want === 'home' && !homeVisible()) return false;
    inp.focus(); inp.select(); inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }

  function onSearchKey(ev, scope) {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const n = items(scope).length; if (!n) return;
      if (state.active < 0) state.active = ev.key === 'ArrowDown' ? 0 : n - 1;
      else state.active = ev.key === 'ArrowDown' ? Math.min(n - 1, state.active + 1) : Math.max(0, state.active - 1);
      paintHighlight();
    } else if (ev.key === 'Enter') {
      ev.preventDefault(); openActive(scope);
    } else if (ev.key === 'Escape') {
      ev.preventDefault(); ev.stopPropagation();
      if (state.q) setQuery('');
      else if (scope === 'pick' && state.hooks && state.hooks.closeAllToolsPick) state.hooks.closeAllToolsPick();
      else ev.target.blur();
    }
  }

  function escapeAllTools() {
    if (!pickerOpen()) return false;
    if (state.q) { setQuery(''); const inp = document.getElementById('toolSearchPick'); if (inp) inp.focus(); return true; }
    return false;
  }

  function bind(hooks) {
    state.hooks = hooks || {};
    const doc = document;
    stampEnglish(doc);
    const homeInp = doc.getElementById('toolSearchHome');
    const pickInp = doc.getElementById('toolSearchPick');
    const onInput = ev => setQuery(ev.target.value, ev.target.id);
    if (homeInp) {
      homeInp.addEventListener('input', onInput);
      homeInp.addEventListener('keydown', ev => onSearchKey(ev, 'home'));
    }
    if (pickInp) {
      pickInp.addEventListener('input', onInput);
      pickInp.addEventListener('keydown', ev => onSearchKey(ev, 'pick'));
    }
    doc.querySelectorAll('.tool-search-clear').forEach(b => b.addEventListener('click', ev => {
      ev.preventDefault(); setQuery('');
      const box = b.closest('.tool-search'); const inp = box && box.querySelector('input'); if (inp) inp.focus();
    }));
    addEventListener('keydown', ev => {
      if (ev.key === '/' && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !isTypingTarget(ev.target)) {
        ev.preventDefault();
        if (pickerOpen()) focusSearch('pick');
        else if (homeVisible()) focusSearch('home');
        else if (state.hooks.openAllToolsPick) { state.hooks.openAllToolsPick(); setTimeout(() => focusSearch('pick'), 0); }
      } else if (ev.key === 'Escape' && pickerOpen() && escapeAllTools()) {
        ev.preventDefault(); ev.stopPropagation();
      }
    }, true);

    const _build = state.hooks.buildAllToolsGrid;
    if (typeof _build === 'function') {
      state.hooks.buildAllToolsGrid = function () { _build(); applyFilter(); };
      try { root.buildAllToolsGrid = state.hooks.buildAllToolsGrid; } catch (e) {}
    }
    applyFilter();
    return api;
  }

  const api = {
    KEYWORDS, norm, tokens, matchTool, filterTools, filterOptions, catalogFromCards, haystack,
    enhanceSelect, bind, setQuery, applyFilter, focusSearch, escapeAllTools, visibleIds,
    get query() { return state.q; }
  };
  api.enhance = enhanceSelect;
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GPToolSearch = api;
  root.GPSearchableSelect = { enhance: enhanceSelect };
})(typeof window !== 'undefined' ? window : globalThis);
