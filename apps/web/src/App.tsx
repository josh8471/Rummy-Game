import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { AppShell } from './components/AppShell';
import { ErrorState, LoadingState } from './components/States';
import { useSession } from './lib/auth';
import { errorMessage } from './lib/api';
import { GamesPage } from './pages/Games';
import { HomePage } from './pages/Home';
import { NotFoundPage } from './pages/NotFound';

// Route-level code splitting: games, sign-in and the admin area load only when opened.
const LoginPage = lazy(() => import('./pages/Auth').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Auth').then((m) => ({ default: m.RegisterPage })));
const GamePage = lazy(() => import('./games/GamePage'));
const WalletPage = lazy(() => import('./pages/Wallet'));
const HistoryPage = lazy(() => import('./pages/History'));
const RewardsPage = lazy(() => import('./pages/Rewards'));
const LeaderboardPage = lazy(() => import('./pages/Leaderboard'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const HelpPage = lazy(() => import('./pages/Help'));
const AdminApp = lazy(() => import('./admin/AdminApp'));

function RequireAuth({ admin }: { admin?: boolean }) {
  const { user, isLoading, error, refetch } = useSession();
  const location = useLocation();
  if (isLoading) return <LoadingState label="Loading your table…" className="min-h-dvh" />;
  if (error) return <ErrorState className="min-h-dvh" message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Outlet />
    </Suspense>
  );
}

function TitleSync() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  return null;
}

export function App() {
  return (
    <>
      <TitleSync />
      <Routes>
        <Route element={<Page />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="games" element={<GamesPage />} />
            <Route element={<Page />}>
              <Route path="games/:gameId" element={<GamePage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="rewards" element={<RewardsPage />} />
              <Route path="leaderboard" element={<LeaderboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="help" element={<HelpPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route element={<RequireAuth admin />}>
          <Route
            path="admin/*"
            element={
              <Suspense fallback={<LoadingState label="Loading admin…" className="min-h-dvh" />}>
                <AdminApp />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </>
  );
}
