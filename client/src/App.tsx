import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './lib/store';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ResultsPage from './pages/ResultsPage';
import LeaderboardPage from './pages/LeaderboardPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile } = useStore();
  if (!user || !profile) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/lobby" element={<RequireAuth><LobbyPage /></RequireAuth>} />
        <Route path="/game" element={<RequireAuth><GamePage /></RequireAuth>} />
        <Route path="/results" element={<RequireAuth><ResultsPage /></RequireAuth>} />
        <Route path="/leaderboard" element={<RequireAuth><LeaderboardPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
