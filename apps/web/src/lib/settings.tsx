import { DEFAULT_BREAK_REMINDER_MINUTES } from '@casino/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

export type MotionPreference = 'system' | 'reduce' | 'full';

export interface Settings {
  motion: MotionPreference;
  /** 0 = off */
  breakReminderMinutes: number;
}

const STORAGE_KEY = 'simcasino.settings';
const DEFAULTS: Settings = { motion: 'system', breakReminderMinutes: DEFAULT_BREAK_REMINDER_MINUTES };

/** Per-device conveniences only; storage may be unavailable (private mode), so every access is guarded. */
function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function save(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore: the setting still applies for this visit.
  }
}

interface SettingsContextValue {
  settings: Settings;
  update(patch: Partial<Settings>): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.motion === 'system') delete root.dataset.motion;
    else root.dataset.motion = settings.motion;
  }, [settings.motion]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

/** True when animations should be replaced by short transitions. */
export function useReducedMotion(): boolean {
  const { settings } = useSettings();
  const systemReduced = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
  if (settings.motion === 'reduce') return true;
  if (settings.motion === 'full') return false;
  return systemReduced;
}
