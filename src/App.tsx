import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CitizenDashboard } from './views/CitizenDashboard';
import { LearnModules } from './views/LearnModules';
import { Rewards } from './views/Rewards';
import { AuthorityPortal } from './views/AuthorityPortal';
import { ReportIssue } from './views/ReportIssue';
import { AuthPage } from './views/AuthPage';
import { Helplines } from './views/Helplines';
import { About } from './views/About';
import { AIChatbot } from './components/AIChatbot';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
};

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState<AuthUser | null>(null);
  const isLeader = user?.role === 'admin';
  const navItems = [
    { id: 'dashboard', label: 'My Impact' },
    { id: 'report', label: 'Report Issue' },
    { id: 'learn', label: 'Learn' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'about', label: 'About' },
    ...(isLeader ? [{ id: 'authority', label: 'Authority' }] : []),
    { id: 'helplines', label: 'Helplines' },
  ];

  useEffect(() => {
    const storedUser = localStorage.getItem('ecoSyncUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('ecoSyncUser');
      }
    }
  }, []);

  const handleAuthSuccess = (authenticatedUser: AuthUser) => {
    setUser(authenticatedUser);
    localStorage.setItem('ecoSyncUser', JSON.stringify(authenticatedUser));
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('ecoSyncUser');
    Object.keys(localStorage)
      .filter((key) => key.startsWith('eco'))
      .forEach((key) => localStorage.removeItem(key));
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <CitizenDashboard user={user} />;
      case 'report':
        return <ReportIssue user={user} />;
      case 'learn':
        return <LearnModules />;
      case 'rewards':
        return <Rewards user={user} />;
      case 'about':
        return <About />;
      case 'helplines':
        return <Helplines />;
      case 'authority':
        return isLeader ? <AuthorityPortal /> : <CitizenDashboard user={user} />;
      default:
        return <CitizenDashboard user={user} />;
    }
  };

  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="relative flex min-h-screen md:h-screen w-full bg-[#050505] overflow-x-hidden font-sans">
      <div className="hidden md:block absolute top-0 left-0 h-full z-50 pointer-events-none">
        <div className="pointer-events-auto h-full">
          <Sidebar currentView={currentView} setCurrentView={setCurrentView} user={user} onSignOut={handleSignOut} />
        </div>
      </div>

      <div className="md:hidden fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <select
            value={currentView}
            onChange={(event) => setCurrentView(event.target.value)}
            className="flex-1 rounded-xl border border-white/15 bg-zinc-900 text-zinc-100 px-3 py-2 text-sm"
          >
            {navItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl border border-red-400/30 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative pt-16 md:pt-0">
        {renderView()}
      </div>
      <AIChatbot user={user} />
    </div>
  );
}
