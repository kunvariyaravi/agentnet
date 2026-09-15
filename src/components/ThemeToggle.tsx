'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const dom = document.documentElement.dataset.theme;
  if (dom === 'light' || dom === 'dark') return dom;
  const stored = localStorage.getItem('agentnet-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem('agentnet-theme', theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Read once on mount — never write before the stored value is loaded,
  // otherwise every remount (each page has its own Navbar) would
  // overwrite the saved choice with the 'dark' initial state.
  useEffect(() => {
    const initial = getInitialTheme();
    applyTheme(initial);
    setTheme(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
  }, [theme, mounted]);

  // Keep multiple toggles / tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'agentnet-theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // Avoid flashing the wrong icon on first paint — the page colors are
  // already correct via the blocking init script in layout.tsx.
  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        disabled
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors"
      >
        <span className="block h-[18px] w-[18px]" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
