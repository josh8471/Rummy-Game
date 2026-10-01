import type { ProfileItem } from '@casino/shared';
import { Lock, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '../components/States';
import { Button, PageHeader, Panel, Skeleton } from '../components/ui';
import { RangeBar } from './charts';
import { useProfiles } from './data';
import { ProfileModal } from './forms';

export function ProfilesPage() {
  const profiles = useProfiles();
  const [editing, setEditing] = useState<ProfileItem | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Probability profiles"
        subtitle="Simulation and testing profiles. Presets are locked; custom profiles can be edited."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> New profile
          </Button>
        }
      />
      {profiles.error ? (
        <ErrorState message="Couldn’t load profiles." onRetry={() => void profiles.refetch()} />
      ) : !profiles.data ? (
        <Skeleton className="h-80" />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {profiles.data.map((p) => (
            <li key={p.id}>
              <Panel className="flex h-full flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{p.name}</h2>
                    <p className="text-sm text-muted">{p.description || '—'}</p>
                  </div>
                  {p.isSystem ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-muted">
                      <Lock className="size-3" aria-hidden /> Preset
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gold-400/12 px-2 py-0.5 text-xs font-semibold text-gold-200">Custom</span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {(
                    [
                      ['Win', p.winChance],
                      ['Small', p.smallWinChance],
                      ['Big', p.bigWinChance],
                      ['Loss', p.lossChance],
                    ] as const
                  ).map(([label, v]) => (
                    <div key={label} className="rounded-lg bg-white/[0.04] py-2">
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="tabular font-display text-lg font-semibold">{v}%</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4">
                  <RangeBar chances={p} />
                </div>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="text-sm text-muted">
                    {p.assignedPlayers} player{p.assignedPlayers === 1 ? '' : 's'}
                  </span>
                  {!p.isSystem && (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                      <Pencil className="size-3.5" aria-hidden /> Edit
                    </Button>
                  )}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
      <ProfileModal profile={editing} open={creating || editing !== null} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}
