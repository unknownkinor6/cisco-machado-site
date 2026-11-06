/* Native document transitions where supported; a short accessible fallback elsewhere. */
(() => {
 const reduce = matchMedia('(prefers-reduced-motion: reduce)');
 addEventListener('pageshow', () => document.body.classList.remove('leaving'));
 document.addEventListener('click', e => {
  const link = e.target.closest('a[href]');
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname === location.pathname || reduce.matches) return;
  if ('CSSViewTransitionRule' in window) return;
  e.preventDefault();
  document.body.classList.add('leaving');
  setTimeout(() => location.assign(url.href), 180);
 });
})();
