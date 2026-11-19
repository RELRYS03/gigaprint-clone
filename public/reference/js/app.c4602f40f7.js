
// Embedded on a Expressarte landing page (same-origin iframe): links to other sites (checkout, help) open in the whole
// window instead of inside the frame.
(function () { if (window.top === window) return; document.documentElement.classList.add('embedded');
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a || a.hasAttribute('download') || a.href.indexOf('blob:') === 0) return; try { var u = new URL(a.href, location.href); if (u.origin !== location.origin || !/^#/.test(a.getAttribute('href') || '')) { if (u.origin !== location.origin || u.pathname !== location.pathname) a.target = '_top'; } } catch (x) {} }, true);
})();
