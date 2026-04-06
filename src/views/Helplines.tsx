import { motion } from 'framer-motion';
import { AlertCircle, Mail, Phone, ShieldAlert, Droplets, Trash2, Trees } from 'lucide-react';

const helplineCards = [
  {
    title: 'Municipal Emergency Control Room',
    phone: '112',
    purpose: 'Immediate public safety emergencies and urgent civic escalation.',
    icon: ShieldAlert,
    accent: 'from-red-500/25 to-red-700/10 border-red-400/30',
  },
  {
    title: 'Water Supply & Leakage Helpline',
    phone: '1916',
    purpose: 'Burst pipes, severe leakage, and water supply disruption reports.',
    icon: Droplets,
    accent: 'from-cyan-500/25 to-cyan-700/10 border-cyan-400/30',
  },
  {
    title: 'Solid Waste / Dumping Helpline',
    phone: '155303',
    purpose: 'Garbage overflow, illegal dumping, and delayed waste pickup.',
    icon: Trash2,
    accent: 'from-amber-500/25 to-amber-700/10 border-amber-400/30',
  },
  {
    title: 'Urban Green Damage Helpline',
    phone: '1800-425-3399',
    purpose: 'Fallen trees, damaged planters, and green belt restoration needs.',
    icon: Trees,
    accent: 'from-emerald-500/25 to-emerald-700/10 border-emerald-400/30',
  },
] as const;

export function Helplines() {
  return (
    <div className="relative flex-1 h-screen overflow-y-auto bg-[#050505] text-white p-8 md:p-12 pl-[300px] md:pl-[320px]">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-8%] h-[45vw] w-[45vw] rounded-full bg-rose-600/10 blur-[110px]" />
        <div className="absolute bottom-[-15%] left-[8%] h-[55vw] w-[55vw] rounded-full bg-emerald-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.22em] text-zinc-300">
            <AlertCircle size={14} />
            Help Session
          </p>
          <h2 className="text-4xl font-bold tracking-tight">Helplines</h2>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Use these contacts for urgent civic issues. If anything goes wrong in the app or reporting flow,
            contact project support directly at main@gmail.com.
          </p>
        </motion.header>

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Primary Escalation</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xl font-semibold text-white">main@gmail.com</p>
              <p className="text-zinc-400">For app issues, incorrect AI results, and unresolved authority workflow problems.</p>
            </div>
            <a
              href="mailto:main@gmail.com?subject=EcoSync%20Support%20Request"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-5 py-3 font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/30"
            >
              <Mail size={18} />
              Contact main@gmail.com
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 pb-8">
          {helplineCards.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className={`rounded-3xl border bg-gradient-to-br ${item.accent} p-6 shadow-[0_10px_28px_rgba(0,0,0,0.35)]`}
              >
                <div className="mb-4 inline-flex rounded-2xl border border-white/15 bg-black/25 p-3 text-white">
                  <Icon size={20} />
                </div>
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-zinc-200/90">{item.purpose}</p>
                <a
                  href={`tel:${item.phone.replace(/[^\d+]/g, '')}`}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/25 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black/40"
                >
                  <Phone size={16} />
                  {item.phone}
                </a>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
