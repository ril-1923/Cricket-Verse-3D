import { Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Layout } from './components/layout/Layout';
import Home from './pages/Home';

const Arena = lazy(() => import('./pages/StadiumArena'));
const Setup = lazy(() => import('./pages/MatchSetup'));
const Live = lazy(() => import('./pages/LiveMatch'));
const Teams = lazy(() => import('./pages/Teams'));
const Players = lazy(() => import('./pages/PlayerProfiles'));
const Scorecard = lazy(() => import('./pages/Scorecard'));
const Centre = lazy(() => import('./pages/MatchCentre'));
const Stats = lazy(() => import('./pages/Statistics'));
const Tournament = lazy(() => import('./pages/Tournament'));
const History = lazy(() => import('./pages/MatchHistory'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <Suspense fallback={<div className="p-5 text-center dim">Loading…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="arena" element={<Arena />} />
          <Route path="setup" element={<Setup />} />
          <Route path="live" element={<Live />} />
          <Route path="teams" element={<Teams />} />
          <Route path="players" element={<Players />} />
          <Route path="players/:id" element={<Players />} />
          <Route path="scorecard" element={<Scorecard />} />
          <Route path="scorecard/:id" element={<Scorecard />} />
          <Route path="centre" element={<Centre />} />
          <Route path="stats" element={<Stats />} />
          <Route path="tournament" element={<Tournament />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<div className="empty glass m-4"><h4>Page not found</h4></div>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
