import { motion } from 'framer-motion';
import { Leaf, ShieldCheck, MapPinned, BadgeInfo, Sparkles } from 'lucide-react';

const pillars = [
  {
    icon: Leaf,
    title: 'Track civic impact',
    description: 'EcoSync helps citizens report problems, log green actions, and see the effect of their daily choices in one place.',
  },
  {
    icon: MapPinned,
    title: 'Make local issues visible',
    description: 'Issue reports, territory status, and authority workflows are kept simple so communities can move faster on real problems.',
  },
  {
    icon: ShieldCheck,
    title: 'Keep it accountable',
    description: 'Each account sees its own reports and progress, while leaders can manage city-wide operations when needed.',
  },
];

const stats = [
  { label: 'Purpose', value: 'Civic action', note: 'Report, learn, and improve together.' },
  { label: 'Focus', value: 'Account privacy', note: 'Users only see their own reports in their account.' },
  { label: 'Experience', value: 'Gamified growth', note: 'Points, challenges, and rewards keep momentum high.' },
];

export function About() {
  return (
    <div className="relative flex-1 h-screen overflow-y-auto bg-[#050505] text-white p-8 md:p-12 pl-[300px] md:pl-[320px]">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[60vw] h-[60vw] rounded-full bg-cyan-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-8 md:p-10 overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold tracking-[0.25em] uppercase text-emerald-300">
              <BadgeInfo size={14} /> About EcoSync
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-black tracking-tight">
              A civic platform built for everyday action.
            </h1>
            <p className="mt-5 text-lg md:text-xl text-zinc-300 leading-relaxed max-w-2xl">
              EcoSync connects reporting, learning, rewards, and community accountability in one place.
              The goal is simple: make it easier for citizens to spot problems, take action, and see measurable progress over time.
            </p>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <motion.article
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + index * 0.08 }}
                className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-7 backdrop-blur-2xl"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5">
                  <Icon size={24} />
                </div>
                <h2 className="text-xl font-bold mb-3">{pillar.title}</h2>
                <p className="text-zinc-400 leading-relaxed">{pillar.description}</p>
              </motion.article>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6 backdrop-blur-2xl">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{stat.label}</p>
              <p className="mt-3 text-2xl font-black text-white">{stat.value}</p>
              <p className="mt-2 text-sm text-zinc-400">{stat.note}</p>
            </div>
          ))}
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-8 md:p-10 backdrop-blur-2xl"
        >
          <div className="flex items-center gap-3 text-emerald-400 mb-4">
            <Sparkles size={20} />
            <span className="text-xs font-semibold uppercase tracking-[0.25em]">What makes it different</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-zinc-300 leading-relaxed">
            <p>
              The app combines reporting, impact tracking, and rewards so the user does not have to jump between separate tools.
              Citizens can submit issues, follow progress, and build healthy habits through a single account.
            </p>
            <p>
              The interface also keeps account data private by design. Report lists, dashboard counts, and activity summaries are scoped to the signed-in user so the account stays personal and clear.
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
