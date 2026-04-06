import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CitizenDashboard } from './views/CitizenDashboard';
import { LearnModules } from './views/LearnModules';
import { Rewards } from './views/Rewards';
import { AuthorityPortal } from './views/AuthorityPortal';
import { ReportIssue } from './views/ReportIssue';
import { AuthPage } from './views/AuthPage';
import { Helplines } from './views/Helplines';

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
    <div className="relative flex h-screen w-full bg-[#050505] overflow-hidden font-sans">
      <div className="absolute top-0 left-0 h-full z-50 pointer-events-none">
        <div className="pointer-events-auto h-full">
          <Sidebar currentView={currentView} setCurrentView={setCurrentView} user={user} onSignOut={handleSignOut} />
        </div>
      </div>
      <div className="flex-1 w-full h-full relative">
        {renderView()}
      </div>
    </div>
  );
}
