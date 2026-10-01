import { Compass } from 'lucide-react';
import { EmptyState } from '../components/States';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass className="size-7" aria-hidden />}
      title="Page not found"
      message="That page doesn’t exist. Let’s get you back to the tables."
      action={{ label: 'Go home', to: '/' }}
      className="min-h-[60vh]"
    />
  );
}
