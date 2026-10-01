import { Coffee } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLogout } from '../lib/auth';
import { durationLabel, formatINR } from '../lib/format';
import { touchPlaySession } from '../lib/playSession';
import { useProfile } from '../lib/queries';
import { useSettings } from '../lib/settings';
import { Modal } from './Modal';
import { Button } from './ui';

const SEEN_KEY = 'simcasino.breakReminders';

function readSeen(start: number): number {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as { start: number; count: number }) : null;
    return parsed?.start === start ? parsed.count : 0;
  } catch {
    return 0;
  }
}

function writeSeen(start: number, count: number) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify({ start, count }));
  } catch {
    // Best effort only.
  }
}

/** "You've been playing for 30 minutes. Take a break?" (PRD §44) */
export function BreakReminder() {
  const { settings } = useSettings();
  const interval = settings.breakReminderMinutes;
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(() => touchPlaySession());
  const [now, setNow] = useState(() => Date.now());
  const logout = useLogout();
  const profile = useProfile(open, start);

  useEffect(() => {
    const check = () => {
      const t = Date.now();
      const sessionStart = touchPlaySession(t);
      setStart(sessionStart);
      setNow(t);
      if (interval <= 0) return;
      const due = Math.floor((t - sessionStart) / 60_000 / interval);
      if (due > readSeen(sessionStart)) {
        writeSeen(sessionStart, due);
        setOpen(true);
      }
    };
    check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [interval]);

  const elapsed = now - start;
  const session = profile.data?.session;

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={`You’ve been playing for ${Math.max(interval, Math.floor(elapsed / 60_000))} minutes`}
      description="Take a break?"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep playing
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              void logout('Enjoy your break! Your virtual balance is saved.');
            }}
          >
            <Coffee className="size-4" aria-hidden /> Take a break
          </Button>
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-3">
        {[
          ['Session time', durationLabel(elapsed)],
          ['Rounds played', session ? String(session.rounds) : '—'],
          ['Virtual won', session ? formatINR(session.virtualWon) : '—'],
          ['Virtual lost', session ? formatINR(session.virtualLost) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.04] p-3">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="tabular mt-0.5 font-display text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-muted">Virtual ₹ only — no cash value. You can change or turn off this reminder in Settings.</p>
    </Modal>
  );
}
