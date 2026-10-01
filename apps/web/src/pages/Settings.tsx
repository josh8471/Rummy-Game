import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { VirtualNotice } from '../components/VirtualNotice';
import { Button, PageHeader, Panel } from '../components/ui';
import { useLogout } from '../lib/auth';
import { cn } from '../lib/format';
import { useSettings, type MotionPreference } from '../lib/settings';

function RadioCards<T extends string | number>({
  legend,
  description,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  description: ReactNode;
  name: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-lg font-semibold">{legend}</legend>
      <p className="mt-0.5 text-sm text-muted">{description}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => (
          <label
            key={String(option.value)}
            className={cn(
              'flex min-h-11 items-start gap-3 rounded-xl border p-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-400',
              value === option.value ? 'border-gold-400/60 bg-gold-400/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
            )}
          >
            <input
              type="radio"
              name={name}
              className="mt-1 size-4 accent-[#f7c948]"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.hint && <span className="block text-sm text-muted">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const logout = useLogout();
  return (
    <>
      <PageHeader title="Settings" subtitle="Saved on this device." />
      <div className="max-w-4xl space-y-4">
        <Panel className="p-5">
          <RadioCards<MotionPreference>
            legend="Motion"
            description="Reel spins, wheel spins, card deals and balance count-ups."
            name="motion"
            value={settings.motion}
            onChange={(motion) => update({ motion })}
            options={[
              { value: 'system', label: 'Match my device', hint: 'Follows the reduced-motion setting' },
              { value: 'reduce', label: 'Reduce motion', hint: 'Short fades instead of animations' },
              { value: 'full', label: 'Full motion', hint: 'All animations on' },
            ]}
          />
        </Panel>
        <Panel className="p-5">
          <RadioCards<number>
            legend="Break reminder"
            description="We’ll show your session time and results, and ask if you’d like a break."
            name="break"
            value={settings.breakReminderMinutes}
            onChange={(breakReminderMinutes) => update({ breakReminderMinutes })}
            options={[
              { value: 15, label: 'Every 15 minutes' },
              { value: 30, label: 'Every 30 minutes' },
              { value: 60, label: 'Every hour' },
              { value: 0, label: 'Off' },
            ]}
          />
        </Panel>
        <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Account</h2>
            <VirtualNotice variant="inline" className="mt-1" />
          </div>
          <Button variant="danger" onClick={() => void logout()}>
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </Panel>
      </div>
    </>
  );
}
