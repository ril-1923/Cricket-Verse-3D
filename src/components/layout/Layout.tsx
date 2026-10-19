import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

const LINKS: [string, string, string][] = [
  ['/', 'Home', 'bi-house'], ['/arena', 'Arena', 'bi-geo-alt'], ['/setup', 'Match setup', 'bi-sliders'], ['/live', 'Live match', 'bi-broadcast'], ['/teams', 'Teams', 'bi-people'],
  ['/players', 'Players', 'bi-person-badge'], ['/scorecard', 'Scorecard', 'bi-card-list'], ['/centre', 'Match centre', 'bi-chat-square-text'], ['/stats', 'Statistics', 'bi-bar-chart'],
  ['/tournament', 'Tournament', 'bi-trophy'], ['/history', 'History', 'bi-clock-history'], ['/settings', 'Settings', 'bi-gear'],
];
export function Layout() {
  const [open, setOpen] = useState(false); const loc = useLocation(); const live = loc.pathname === '/live';
  return (
    <div className={`app ${live ? 'is-live' : ''}`}>
      <nav className="topnav">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}><span className="brand-mark">🏏</span><span>CricketVerse <b>3D</b></span></NavLink>
        <button className="btn btn-sm btn-outline-light d-lg-none ms-auto" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}><i className="bi bi-list" /></button>
        <div className={`links ${open ? 'open' : ''}`}>
          {LINKS.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `lnk ${isActive ? 'active' : ''}`}><i className={`bi ${icon}`} /> <span>{label}</span></NavLink>)}
        </div>
      </nav>
      <main className="page"><Outlet /></main>
    </div>
  );
}
