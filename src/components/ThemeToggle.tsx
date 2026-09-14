import { Sun, Moon } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';

/**
 * Floating light/dark toggle, present on every page (rendered once from
 * App.tsx). Fixed to the bottom-right corner so it never competes with a
 * page's own header/action buttons up top.
 */
export default function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === 'dark';
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed bottom-4 right-4 z-30 p-3 rounded-full shadow-lg border transition-colors bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
