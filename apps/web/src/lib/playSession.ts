/**
 * A "play session" is the current visit: it starts when the app is opened and
 * restarts after 30 idle minutes. Logins last much longer, so the session timer
 * and break reminder use this instead. Display-only — nothing money-related
 * depends on it.
 */
const KEY = 'simcasino.playSession';
const IDLE_RESET_MS = 30 * 60 * 1000;

interface Stored {
  start: number;
  lastActive: number;
}

let memory: Stored | null = null;

function read(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : memory;
  } catch {
    return memory;
  }
}

function write(value: Stored) {
  memory = value;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: keep it in memory for this page.
  }
}

/** Returns the play-session start (ms), starting a new session if idle too long, and marks activity now. */
export function touchPlaySession(now = Date.now()): number {
  const current = read();
  const next: Stored =
    current && now - current.lastActive < IDLE_RESET_MS ? { start: current.start, lastActive: now } : { start: now, lastActive: now };
  write(next);
  return next.start;
}

export function resetPlaySession() {
  memory = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
