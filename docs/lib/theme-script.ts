/**
 * Applies the saved theme before the page paints. This is emitted by the
 * server layout because React 19.2 no longer executes scripts returned by
 * Client Components.
 */
export const themeBootstrapScript = `(() => {
  try {
    const saved = localStorage.getItem('theme') || 'system';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = saved === 'system' ? (systemDark ? 'dark' : 'light') : saved;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch (_) {}
})();`;
