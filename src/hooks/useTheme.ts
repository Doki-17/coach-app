import { useEffect, useState } from 'react';

const STORAGE_KEY = 'coachapp:theme';
export type Theme = 'light' | 'dark';

/**
 * Same logic as the inline script in index.html that runs before React
 * mounts (to avoid a flash of the wrong theme) - kept in sync with it by
 * hand since that one has to be plain JS with no imports.
 */
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.) - fall through.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Manual light/dark toggle, defaulting to the OS preference the first time
 * a coach opens the app and persisted (per-browser) after that. Only the
 * app's chrome (nav, cards, modals, page backgrounds) responds to this -
 * the branded program "output" (the printable/exportable card) intentionally
 * always renders the same regardless of theme, so a PNG/PDF export always
 * looks like the client-facing design rather than whatever theme the coach
 * happened to be using.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme just won't persist across reloads - not worth interrupting for.
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme };
}
