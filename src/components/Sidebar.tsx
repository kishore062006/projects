import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, AlertTriangle, BookOpen, Gift, ShieldAlert, Leaf } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  user: {
    name: string;
    email: string;
  };
  onSignOut: () => void;
}

export function Sidebar({ currentView, setCurrentView, user, onSignOut }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'My Impact', icon: LayoutDashboard },
    { id: 'report', label: 'Report Issue', icon: AlertTriangle },
    { id: 'learn', label: 'Learn', icon: BookOpen },
    { id: 'rewards', label: 'Rewards', icon: Gift },
    { id: 'authority', label: 'Authority Portal', icon: ShieldAlert },
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
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="mt-4 w-full rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-200 uppercase tracking-[0.2em] py-2 transition-colors hover:bg-white/10"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
