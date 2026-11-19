// Tool folders: a folder groups related tools under one cover card on the home page (#all-tools) and one icon in the
// All tools picker. Opening it (a click, or a link to /#<id>) shows a view with only that folder's tools and a link
// back to all tools. The tools inside are the ordinary [data-go] cards, so direct links (#lampshade), the tool order
// and search keep working; a search shows the matching tools of every folder in place.
//
// To add a folder, wrap its cards in the home grid like this (see the Lamps folder in index.template.html):
//   <section class="gp-folder" data-folder="<id>" data-folder-alias="<other hash names>" data-search-folder>
//     <button class="card wide gp-folder-cover" data-folder-open="<id>">\u2026 .gp-folder-thumbs \u2026 .gp-folder-count \u2026 .gp-folder-chips \u2026</button>
//     <header class="gp-folder-head"><a class="gp-folder-back" href="/" data-folder-close>\u2190 All tools</a> \u2026 <h2 tabindex="-1">\u2026</h2></header>
//     <div class="gp-folder-tools"> \u2026the tools' cards\u2026 </div>
//   </section>
// The cover's thumbnails, chips and tool count are filled in from the cards inside.
(function (root) {
  'use strict';
  const doc = root.document;
  let cur = null, hooks = {};
  const home = () => doc.getElementById('home');
  const folders = () => [...doc.querySelectorAll('#all-tools .gp-folder[data-folder]')];
  function el(id) {
    if (!id) return null;
    id = String(id).toLowerCase();
    return folders().find(f => f.dataset.folder === id || (f.dataset.folderAlias || '').split(/\s+/).includes(id)) || null;
  }
  const resolve = id => { const f = el(id); return f ? f.dataset.folder : null; };
  const tools = f => [...f.querySelectorAll('.gp-folder-tools [data-go]')];
  const countText = n => n === 1 ? '1 tool' : n + ' tools';
  function title(f) { const h = f.querySelector('.gp-folder-head h2') || f.querySelector('.gp-folder-cover h2'); return h ? h.textContent.trim() : f.dataset.folder; }

  function decorate() {
    folders().forEach(f => {
      const ts = tools(f);
      f.querySelectorAll('.gp-folder-count').forEach(c => { c.textContent = countText(ts.length); });
      f.dataset.count = ts.length;
      const th = f.querySelector('.gp-folder-thumbs');
      if (th && !th.childElementCount) ts.slice(0, 4).forEach(t => {
        const art = t.querySelector('.art'); const s = doc.createElement('span');
        s.className = 'gp-thumb'; s.dataset.ico = t.dataset.go; s.dataset.thumb = t.dataset.go;
        if (art) { s.innerHTML = art.innerHTML; s.querySelectorAll('[id]').forEach(x => x.removeAttribute('id')); }
        th.appendChild(s);
      });
      const chips = f.querySelector('.gp-folder-chips');
      if (chips && !chips.childElementCount) ts.forEach(t => {
        const h = t.querySelector('h2'); const li = doc.createElement('li');
        li.textContent = (h ? h.textContent : t.dataset.go).trim(); chips.appendChild(li);
      });
      const cover = f.querySelector('.gp-folder-cover');
      if (cover && !cover.__gpFolder) {
        cover.__gpFolder = 1;
        cover.addEventListener('click', ev => { ev.preventDefault(); open(f.dataset.folder, { push: true, focus: true }); });
      }
      f.querySelectorAll('[data-folder-close]').forEach(a => {
        if (a.__gpFolder) return; a.__gpFolder = 1;
        a.addEventListener('click', ev => {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0) return;
          ev.preventDefault(); back();
        });
      });
    });
  }

  function setHash(id, mode) {
    try {
      const url = id ? location.pathname + location.search + '#' + id : location.pathname + location.search;
      if (mode === 'push') root.history.pushState({ gpFolder: id, gpPushed: 1 }, '', url);
      else if (mode === 'replace') root.history.replaceState(id ? { gpFolder: id } : null, '', url);
    } catch (e) {}
  }

  // open(id, { push: add a history entry | history: false to leave the URL alone, focus: move focus to the heading })
  function open(id, opt) {
    opt = opt || {};
    const f = el(id); if (!f) return false;
    id = f.dataset.folder;
    if (hooks.beforeOpen) try { hooks.beforeOpen(id); } catch (e) {}
    folders().forEach(x => {
      const on = x === f; x.classList.toggle('is-open', on);
      const c = x.querySelector('.gp-folder-cover'); if (c) c.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    const h = home(); if (h) { h.classList.add('folder-open'); h.dataset.folder = id; }
    cur = id;
    if (opt.history !== false) setHash(id, opt.push && location.hash !== '#' + id ? 'push' : 'replace');
    try { root.scrollTo(0, 0); } catch (e) {}
    if (opt.focus) { const t = f.querySelector('.gp-folder-head h2'); if (t) try { t.focus({ preventScroll: true }); } catch (e) {} }
    return true;
  }
  function close(opt) {
    opt = opt || {};
    const was = cur;
    folders().forEach(x => { x.classList.remove('is-open'); const c = x.querySelector('.gp-folder-cover'); if (c) c.setAttribute('aria-expanded', 'false'); });
    const h = home(); if (h) { h.classList.remove('folder-open'); delete h.dataset.folder; }
    cur = null;
    if (was && opt.history !== false) setHash(null, 'replace');
    return was;
  }
  // The folder's back link: step back when the folder was opened from the home page, otherwise go to all tools.
  function back() {
    const id = cur;
    let st = null; try { st = root.history.state; } catch (e) {}
    if (st && st.gpPushed && st.gpFolder === id) {
      try { root.history.back(); return; } catch (e) {}
    }
    close();
    if (id) { const c = doc.querySelector(`.gp-folder[data-folder="${id}"] .gp-folder-cover`); if (c) try { c.scrollIntoView({ block: 'center' }); c.focus({ preventScroll: true }); } catch (e) {} }
  }

  // All tools picker: one folder icon stands in for the folder's tools (they show again while searching).
  function decoratePicker(grid, onOpen) {
    if (!grid) return;
    folders().forEach(f => {
      const ids = tools(f).map(t => t.dataset.go);
      const items = ids.map(id => grid.querySelector(`.atp-item[data-go="${id}"]`)).filter(Boolean);
      if (!items.length) return;
      items.forEach(b => { b.dataset.folderChild = f.dataset.folder; });
      const b = doc.createElement('button');
      b.type = 'button'; b.className = 'atp-item atp-folder'; b.dataset.folderOpen = f.dataset.folder; b.setAttribute('data-ico', 'folder-' + f.dataset.folder);
      const n = ids.length, name = title(f);
      b.setAttribute('aria-label', name + ' (' + countText(n) + ')');
      b.innerHTML = '<span class="ico" aria-hidden="true"></span><span></span>';
      const ico = f.querySelector('.gp-folder-cover .ico');
      b.querySelector('.ico').innerHTML = ico ? ico.innerHTML : '';
      b.querySelector('span:last-child').textContent = name;
      b.addEventListener('click', () => { if (onOpen) onOpen(f.dataset.folder); });
      grid.insertBefore(b, items[0]);
    });
  }

  function init(h) { hooks = h || {}; decorate(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', decorate); else decorate();
  root.GPFolders = { init, decorate, decoratePicker, open, close, back, resolve, has: id => !!el(id), current: () => cur, list: () => folders().map(f => ({ id: f.dataset.folder, title: title(f), tools: tools(f).map(t => t.dataset.go) })) };
})(typeof window !== 'undefined' ? window : globalThis);
