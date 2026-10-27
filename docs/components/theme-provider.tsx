'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

type Attribute = 'class' | `data-${string}`;

export interface ThemeProviderProps {
  children?: ReactNode;
  themes?: string[];
  forcedTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  enableColorScheme?: boolean;
  storageKey?: string;
  defaultTheme?: string;
  attribute?: Attribute | Attribute[];
  value?: Record<string, string>;
  nonce?: string;
  scriptProps?: Record<string, unknown>;
}

export interface UseThemeProps {
  themes: string[];
  forcedTheme?: string;
  setTheme: Dispatch<SetStateAction<string>>;
  theme?: string;
  resolvedTheme?: string;
  systemTheme?: 'light' | 'dark';
}

const fallback: UseThemeProps = {
  themes: ['light', 'dark', 'system'],
  setTheme: () => undefined,
};

const ThemeContext = createContext<UseThemeProps>(fallback);

function systemPreference(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({
  children,
  themes = ['light', 'dark'],
  forcedTheme,
  enableSystem = true,
  disableTransitionOnChange = false,
  enableColorScheme = true,
  storageKey = 'theme',
  defaultTheme = enableSystem ? 'system' : 'light',
  attribute = 'class',
  value,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setThemeState(localStorage.getItem(storageKey) || defaultTheme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemTheme(systemPreference());
    updateSystemTheme();
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, [defaultTheme, storageKey]);

  const setTheme = useCallback<Dispatch<SetStateAction<string>>>(
    (next) => {
      setThemeState((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        localStorage.setItem(storageKey, resolved);
        return resolved;
      });
    },
    [storageKey],
  );

  const activeTheme = forcedTheme ?? theme;
  const resolvedTheme = activeTheme === 'system' ? systemTheme : activeTheme;

  useEffect(() => {
    if (!resolvedTheme) return;
    const root = document.documentElement;
    const attributes = Array.isArray(attribute) ? attribute : [attribute];
    const mappedTheme = value?.[resolvedTheme] ?? resolvedTheme;
    let transitionStyle: HTMLStyleElement | undefined;

    if (disableTransitionOnChange) {
      transitionStyle = document.createElement('style');
      transitionStyle.textContent =
        '*,*::before,*::after{transition:none!important}';
      document.head.appendChild(transitionStyle);
    }

    for (const item of attributes) {
      if (item === 'class') {
        root.classList.remove(
          ...themes.map((name) => value?.[name] ?? name),
          'system',
        );
        root.classList.add(mappedTheme);
      } else {
        root.setAttribute(item, mappedTheme);
      }
    }

    if (enableColorScheme && ['light', 'dark'].includes(resolvedTheme)) {
      root.style.colorScheme = resolvedTheme;
    }

    if (transitionStyle) {
      void getComputedStyle(document.body);
      requestAnimationFrame(() => transitionStyle?.remove());
    }
  }, [
    attribute,
    disableTransitionOnChange,
    enableColorScheme,
    resolvedTheme,
    themes,
    value,
  ]);

  const availableThemes = enableSystem ? [...themes, 'system'] : themes;
  const context = useMemo<UseThemeProps>(
    () => ({
      themes: availableThemes,
      forcedTheme,
      setTheme,
      theme: activeTheme,
      resolvedTheme,
      systemTheme,
    }),
    [activeTheme, availableThemes, forcedTheme, resolvedTheme, setTheme, systemTheme],
  );

  return (
    <ThemeContext.Provider value={context}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): UseThemeProps {
  return useContext(ThemeContext);
}
