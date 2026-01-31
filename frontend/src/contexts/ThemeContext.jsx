import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // themeMode: 'light', 'dark', 'auto'
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('pdc-theme-mode');
    return saved || 'auto'; // Par défaut: mode automatique
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('pdc-theme-mode');
    if (savedMode === 'light') return false;
    if (savedMode === 'dark') return true;
    // Mode auto: utiliser la préférence système
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Appliquer le thème au document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Écouter les changements de préférence système
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Uniquement si on est en mode auto
      if (themeMode === 'auto') {
        setIsDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  // Mettre à jour isDarkMode quand themeMode change
  useEffect(() => {
    localStorage.setItem('pdc-theme-mode', themeMode);
    if (themeMode === 'light') {
      setIsDarkMode(false);
    } else if (themeMode === 'dark') {
      setIsDarkMode(true);
    } else {
      // Mode auto
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, [themeMode]);

  const toggleTheme = () => {
    // Basculer entre clair et sombre (passe en mode manuel)
    if (isDarkMode) {
      setThemeMode('light');
    } else {
      setThemeMode('dark');
    }
  };

  const setTheme = (mode) => {
    setThemeMode(mode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, setIsDarkMode, themeMode, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
