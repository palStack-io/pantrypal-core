import { useState, useEffect } from 'react';

export interface UseDarkModeReturn {
  isDark: boolean;
  toggle: () => void;
}

export function useDarkMode(): UseDarkModeReturn {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', String(isDark));
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);

  return { isDark, toggle };
}

export default useDarkMode;
