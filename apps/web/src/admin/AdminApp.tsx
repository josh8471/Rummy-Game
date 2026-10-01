import { Route, Routes } from 'react-router';
import { NotFoundPage } from '../pages/NotFound';
import { AdminLayout } from './AdminLayout';
import { AuditLogPage } from './AuditLog';
import { GamesConfigPage } from './GamesConfig';
import { OverviewPage } from './Overview';
import { PlayerDetailPage } from './PlayerDetail';
import { PlayersPage } from './Players';
import { ProfilesPage } from './Profiles';
import { SecurityPage } from './Security';

/** The admin area is its own lazily-loaded bundle; players never download it. */
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="players/:playerId" element={<PlayerDetailPage />} />
        <Route path="profiles" element={<ProfilesPage />} />
        <Route path="games" element={<GamesConfigPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
