import { useEffect, useState } from 'react';

const KEY = 'cadence-theme';

const current = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

/** Light/dark theme, remembered per browser. index.html applies it before first paint. */
export function useTheme() {
  const [theme, setTheme] = useState(current);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171512' : '#f8f5ee');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Private mode or blocked storage: the theme still applies for this visit.
    }
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}
