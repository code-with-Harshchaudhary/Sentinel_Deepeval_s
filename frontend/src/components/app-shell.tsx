import { AnimatePresence, motion } from 'framer-motion';
import { Activity, BarChart3, BookOpen, Braces, Database, FlaskConical, KeyRound, Menu, Search, Settings, TestTube2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const navigation = [
  { to: '/', label: 'Overview', icon: BarChart3 },
  { to: '/datasets', label: 'Datasets', icon: Database },
  { to: '/metrics', label: 'Metrics', icon: Braces },
  { to: '/runs', label: 'Test runs', icon: TestTube2 },
  { to: '/experiments', label: 'Experiments', icon: FlaskConical },
  { to: '/traces', label: 'Traces', icon: Activity },
];
const secondary = [
  { to: '/api-keys', label: 'API keys', icon: KeyRound },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/docs', label: 'Documentation', icon: BookOpen },
];

type SearchHit = { type: string; id: number; title: string; href: string };

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const environmentName = import.meta.env.PROD ? 'Production environment' : 'Local environment';
  const apiName = import.meta.env.PROD ? 'Render API' : 'API on :8000';
  const environmentDetail = apiConnected === null ? `Checking ${apiName}…` : apiConnected ? `${apiName} connected` : `${apiName} unavailable`;
  const location = useLocation(); const navigate = useNavigate();
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    let active = true;
    api('/health').then(() => { if (active) setApiConnected(true); }).catch(() => { if (active) setApiConnected(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    const timer = setTimeout(() => api<SearchHit[]>(`/search?q=${encodeURIComponent(query)}`).then(setHits).catch(() => setHits([])), 180);
    return () => clearTimeout(timer);
  }, [query]);
  const nav = (items: typeof navigation) => items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={17} /><span>{label}</span></NavLink>);
  return <div className="app-shell">
    <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><div className="brand-mark"><span /><span /><span /></div><div><strong>sentinel_deepeval</strong><small>Evaluation control plane</small></div><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button></div>
      <nav><p className="nav-label">Observe</p>{nav(navigation)}<p className="nav-label nav-label-spaced">System</p>{nav(secondary)}</nav>
      <div className="sidebar-foot"><div className={`signal-dot ${apiConnected === null ? 'pending' : apiConnected ? '' : 'offline'}`} /><div><strong>{environmentName}</strong><small>{environmentDetail}</small></div></div>
    </aside>
    {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <div className="workspace">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu /></button><div className="search-wrap"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search datasets, runs, metrics…" aria-label="Search workspace" /><kbd>⌘ K</kbd>{hits.length > 0 && <div className="search-results">{hits.map(hit => <button key={`${hit.type}-${hit.id}`} onClick={() => { navigate(hit.href); setQuery(''); setHits([]); }}><span>{hit.title}</span><small>{hit.type}</small></button>)}</div>}</div><div className="topbar-status"><span>Workspace</span><strong>Production review</strong></div></header>
      <div className="evaluation-rail"><span className="rail-node active">Dataset</span><i /><span className="rail-node active">Evaluate</span><i /><span className="rail-node">Inspect</span><p>Evidence, not vibes.</p></div>
      <main><AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.18 }}><Outlet /></motion.div></AnimatePresence></main>
    </div>
  </div>;
}
