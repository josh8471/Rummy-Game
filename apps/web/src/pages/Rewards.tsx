import { AchievementGrid } from '../components/Achievements';
import { DailyRewardCard } from '../components/DailyReward';
import { ErrorState } from '../components/States';
import { VirtualNotice } from '../components/VirtualNotice';
import { PageHeader, Panel, SectionTitle, Skeleton } from '../components/ui';
import { useRewards } from '../lib/queries';

export default function RewardsPage() {
  const rewards = useRewards();
  const unlocked = rewards.data?.achievements.filter((a) => a.unlocked).length ?? 0;
  return (
    <>
      <PageHeader title="Rewards" subtitle="Free virtual ₹ every day, plus badges for milestones." actions={<VirtualNotice />} />
      {rewards.error ? (
        <ErrorState message="Couldn’t load rewards." onRetry={() => void rewards.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr] lg:items-start">
          <div className="space-y-4">
            <DailyRewardCard rewards={rewards.data} />
            <Panel className="p-4 text-sm text-muted">
              Rewards reset at midnight India Standard Time. Miss a day and your streak starts again from Day 1. Rewards are virtual ₹ with no cash value.
            </Panel>
          </div>
          <Panel className="p-4 md:p-5">
            <SectionTitle action={rewards.data && <span className="text-sm text-muted">{unlocked} of {rewards.data.achievements.length} unlocked</span>}>
              Achievements
            </SectionTitle>
            {rewards.data ? <AchievementGrid achievements={rewards.data.achievements} /> : <Skeleton className="h-72" />}
          </Panel>
        </div>
      )}
    </>
  );
}
