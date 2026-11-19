// Shared side-panel sections for every tool. Markup convention:
//   <details class="pp" data-pp="tool-key"><summary><span class="pp-t">Title</span><small class="pp-s">One-line hint</small></summary>
//     <div class="pp-b"> ...controls... </div></details>
// Essentials stay outside these sections; extra and advanced settings go inside, closed by default. A section the user
// opens stays open on their next visit (localStorage). Closed sections show "N on" when switches or choices inside are
// changed from their defaults, so nothing changed is hidden silently.
(function () {
  const KEY = 'gigaprint.panel-open.v1';
  let state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const changed = d => {
    let n = 0;
    d.querySelectorAll('.pp-b input[type=checkbox], .pp-b input[type=radio], .pp-b select').forEach(el => {
      if (el.disabled || el.closest('[hidden]') || el.dataset.ppIgnore != null) return;
      if (el.type === 'checkbox') { if (el.checked !== el.defaultChecked) n++; }
      else if (el.type === 'radio') { if (el.checked && !el.defaultChecked) n++; }
      else if (el.tagName === 'SELECT' && el.options.length) {
        const def = [...el.options].find(o => o.defaultSelected) || el.options[0];
        if (el.value !== def.value) n++;
      }
    });
    return n;
  };
  function refresh() {
    document.querySelectorAll('details.pp').forEach(d => {
      const s = d.querySelector(':scope > summary'); if (!s) return;
      let b = s.querySelector(':scope > .pp-n');
      if (!b) { b = document.createElement('span'); b.className = 'pp-n'; const t = s.querySelector('.pp-t'); (t || s).after(b); }
      // data-pp-auto: hide the whole section while everything inside it is hidden (e.g. options for a switched-off feature).
      if (d.dataset.ppAuto != null) { const b = d.querySelector(':scope > .pp-b'); const h = !!b && [...b.children].every(c => c.hidden); if (d.hidden !== h) d.hidden = h; }
      const n = d.dataset.ppCount === 'off' ? 0 : changed(d);
      const txt = n ? `${n} changed` : ''; if (b.textContent !== txt) b.textContent = txt; if (b.hidden !== !n) b.hidden = !n;
    });
  }
  let queued = 0;
  const later = () => { if (queued) return; queued = 1; requestAnimationFrame(() => { queued = 0; refresh(); }); };
  function init(root) {
    (root || document).querySelectorAll('details.pp[data-pp]').forEach(d => {
      if (d.dataset.ppReady) return; d.dataset.ppReady = '1';
      const k = d.dataset.pp;
      if (state.__all === true || state[k] === true) d.open = true;
      d.addEventListener('toggle', () => { if (state.__all === true) return; if (d.open) state[k] = true; else delete state[k]; save(); });
    });
    refresh();
  }
  document.addEventListener('change', later, true);
  try { new MutationObserver(later).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['hidden'] }); } catch (e) {}
  document.addEventListener('click', later, true);
  window.GPPanel = {
    init, refresh,
    open(k) { document.querySelectorAll(`details.pp[data-pp="${k}"]`).forEach(d => { d.open = true; }); },
    // Opens the closed sections around an element (used when code moves focus to a control inside one).
    reveal(el) { for (let d = el && el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true; },
    openAll() { document.querySelectorAll('details.pp').forEach(d => { d.open = true; }); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();
})();
