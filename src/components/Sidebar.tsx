import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, AlertTriangle, BookOpen, Gift, ShieldAlert, Leaf, PhoneCall, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE } from '../lib/api';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin';
  };
  onSignOut: () => void;
}

export function Sidebar({ currentView, setCurrentView, user, onSignOut }: SidebarProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [auraStatus, setAuraStatus] = useState<'none' | 'green' | 'red'>(() => {
    const cached = localStorage.getItem('ecoAuraStatus');
    return cached === 'green' || cached === 'red' ? cached : 'none';
  });
  const isLeader = user.role === 'admin';

  useEffect(() => {
    const refreshAura = async () => {
      if (!API_BASE || !user?.id) return;

      try {
        const response = await fetch(`${API_BASE}/api/adoptions/status?userId=${encodeURIComponent(user.id)}`);
        if (!response.ok) return;

        const data = (await response.json()) as { aura?: string };
        const nextAura = data?.aura === 'green' || data?.aura === 'red' ? data.aura : 'none';
        setAuraStatus(nextAura);
        localStorage.setItem('ecoAuraStatus', nextAura);
      } catch {
        // Keep cached aura state.
      }
    };

    void refreshAura();
    const timer = setInterval(() => {
      void refreshAura();
    }, 60000);

    return () => clearInterval(timer);
  }, [user]);

  const navItems = [
    { id: 'dashboard', label: 'My Impact', icon: LayoutDashboard },
    { id: 'report', label: 'Report Issue', icon: AlertTriangle },
    { id: 'chatbot', label: 'AI Chatbot', icon: MessageCircle },
    { id: 'helplines', label: 'Helplines', icon: PhoneCall },
    { id: 'learn', label: 'Learn', icon: BookOpen },
    { id: 'rewards', label: 'Rewards', icon: Gift },
    ...(isLeader ? [{ id: 'authority', label: 'Authority Portal', icon: ShieldAlert }] : []),
  ];

  return (
    <div className="w-[280px] h-screen p-4 flex flex-col relative z-50 shrink-0">
      {/* iOS Glassmorphism Container */}
      <div className="flex-1 flex flex-col bg-white/[0.02] backdrop-blur-[50px] saturate-[1.5] border border-white/[0.08] rounded-[32px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden relative">
        
        {/* Subtle top highlight reflection */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none"></div>

        <div className="p-6 pb-2 relative z-10 mt-2">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-[12px] bg-gradient-to-b from-emerald-400 to-emerald-600 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(16,185,129,0.4)] border border-black/20 shrink-0">
              <Leaf className="text-white drop-shadow-md" size={20} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-lg font-bold text-white tracking-tight leading-none mb-1">
                EcoSync
              </h1>
              <p className="text-[9px] text-zinc-400 font-bold tracking-widest uppercase leading-none">
                Civic Platform
              </p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-6 relative z-10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className="relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors duration-300 group outline-none"
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 bg-white/[0.08] rounded-2xl border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon 
                  size={20} 
                  className={cn(
                    "relative z-10 transition-all duration-300", 
                    isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"
                  )} 
                />
                <span 
                  className={cn(
                    "relative z-10 font-medium transition-all duration-300", 
                    isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 relative z-10 mb-2">
          <div className="relative rounded-2xl bg-black/20 border border-white/[0.05] p-4 overflow-hidden group hover:bg-black/40 transition-colors duration-300 shadow-inner">
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10 shadow-inner">
                <span className="text-emerald-400 font-bold text-sm">{user.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-emerald-400/80 font-medium truncate">{user.email}</p>
                {auraStatus !== 'none' && (
                  <p className={auraStatus === 'green' ? 'text-[11px] text-emerald-300 mt-1' : 'text-[11px] text-red-300 mt-1'}>
                    Territory Aura: {auraStatus === 'green' ? 'Green' : 'Red'}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              className="mt-4 w-full rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-200 uppercase tracking-[0.2em] py-2 transition-colors hover:bg-white/10"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isConfirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
              onClick={() => setIsConfirmOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed left-1/2 top-1/2 z-[80] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl"
            >
              <p className="text-sm tracking-[0.22em] uppercase text-emerald-400">Confirm Action</p>
              <h3 className="mt-2 text-2xl font-bold text-white">Are you sure you want to sign out?</h3>
              <p className="mt-2 text-sm text-zinc-400">You will need to sign in again to continue tracking your progress.</p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(false)}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmOpen(false);
                    onSignOut();
                  }}
                  className="rounded-2xl border border-red-400/20 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/30"
                >
                  Yes, Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
