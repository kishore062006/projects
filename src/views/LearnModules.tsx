import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Droplets, ThermometerSun, Recycle, X, CheckCircle2 } from 'lucide-react';

type ModuleItem = {
  number: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  image: string;
  reverse?: boolean;
  lessonPoints: string[];
  actionSteps: string[];
};

const modules: ModuleItem[] = [
  {
    number: '01',
    title: 'Water Scarcity & SDG 6',
    description:
      'By 2025, half of the world\'s population will be living in water-stressed areas. Learn how micro-actions like greywater recycling can save thousands of liters annually.',
    icon: Droplets,
    color: 'from-blue-500 to-cyan-400',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop',
    lessonPoints: [
      'Freshwater is less than 3% of all water on Earth, and much of it is inaccessible.',
      'Leak prevention and efficient fixtures reduce domestic water stress quickly.',
      'Community reporting and rapid response prevent large-scale water loss.',
    ],
    actionSteps: [
      'Report visible leaks immediately.',
      'Track household water use weekly.',
      'Adopt bucket/rinse reuse where possible.',
    ],
  },
  {
    number: '02',
    title: 'Urban Waste & SDG 11',
    description:
      'Cities generate 70% of global waste. Discover the lifecycle of a plastic bottle and how circular economies are transforming urban landscapes.',
    icon: Recycle,
    color: 'from-emerald-500 to-green-400',
    image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=2070&auto=format&fit=crop',
    reverse: true,
    lessonPoints: [
      'Urban disposal systems are strained by mixed waste streams.',
      'Segregation at source significantly improves recycling outcomes.',
      'Community cleanups reduce landfill pressure and local pollution.',
    ],
    actionSteps: [
      'Reduce single-use packaging purchases.',
      'Log cleanup and segregation actions weekly.',
      'Support local circular-economy stores.',
    ],
  },
  {
    number: '03',
    title: 'Global Heating & SDG 13',
    description:
      'The science behind the 1.5C threshold. Understand your carbon footprint and the systemic changes required to halt climate change.',
    icon: ThermometerSun,
    color: 'from-orange-500 to-red-500',
    image: 'https://images.unsplash.com/photo-1615092296061-e2ccfeb2f3d6?q=80&w=2070&auto=format&fit=crop',
    lessonPoints: [
      'Transport and energy use are core personal carbon contributors.',
      'Short-distance modal shifts have measurable impact over time.',
      'City-scale reporting helps prioritize high-impact interventions.',
    ],
    actionSteps: [
      'Prefer walking/transit for short trips.',
      'Track weekly low-carbon travel distance.',
      'Encourage neighborhood carbon-saving campaigns.',
    ],
  },
];

export function LearnModules() {
  const [activeModule, setActiveModule] = useState<ModuleItem | null>(null);

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30">
      {/* Hero Section */}
      <div className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Removed expensive mix-blend-luminosity, replaced with hardware-friendly grayscale */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-15 grayscale"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 via-zinc-950/80 to-zinc-950"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 text-center pl-4 md:pl-[320px]">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-[0.85] will-change-[opacity,transform]"
          >
            The Climate <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">Crisis</span> Is Now.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="mt-8 text-xl text-zinc-400 max-w-2xl mx-auto font-light will-change-opacity"
          >
            Education is the first step to action. Explore our interactive modules to understand your impact and how to change it.
          </motion.p>
        </div>
      </div>

      {/* Modules List */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-24 space-y-32 pl-4 md:pl-[320px]">
        {modules.map((module) => (
          <ModuleSection
            key={module.number}
            number={module.number}
            title={module.title}
            description={module.description}
            icon={module.icon}
            color={module.color}
            image={module.image}
            reverse={module.reverse}
            onStart={() => setActiveModule(module)}
          />
        ))}
      </div>

      <AnimatePresence>
        {activeModule && (
          <ModuleViewer module={activeModule} onClose={() => setActiveModule(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ModuleSection({ number, title, description, icon: Icon, color, image, reverse = false, onStart }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} gap-12 items-center will-change-[opacity,transform]`}
    >
      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold tracking-widest text-zinc-500">{number}</span>
          <div className={`h-px flex-1 bg-gradient-to-r ${color} opacity-50`}></div>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight">{title}</h2>
        <p className="text-lg text-zinc-400 leading-relaxed font-light">{description}</p>
        <button
          onClick={onStart}
          className="group flex items-center gap-3 text-sm font-bold uppercase tracking-wider mt-8 hover:text-emerald-400 transition-colors"
        >
          Start Module 
          <span className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:translate-x-2 transition-all will-change-transform">
            <ArrowRight size={16} />
          </span>
        </button>
      </div>
      <div className="flex-1 w-full">
        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden group transform-gpu">
          <div className="absolute inset-0 bg-zinc-900/20 group-hover:bg-transparent transition-colors z-10"></div>
          <img src={image} alt={title} className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700 ease-out will-change-transform" referrerPolicy="no-referrer" />
          <div className="absolute bottom-6 left-6 z-20">
            <div className={`p-4 rounded-2xl bg-zinc-950/80 backdrop-blur-md border border-white/10 text-white transform-gpu`}>
              <Icon size={32} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ModuleViewer({ module, onClose }: { module: ModuleItem; onClose: () => void }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-x-0 top-10 z-50 mx-auto w-[min(900px,92vw)] max-h-[86vh] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-8"
      >
        <button onClick={onClose} className="absolute right-5 top-5 text-zinc-400 hover:text-white">
          <X size={20} />
        </button>

        <div className="pr-10">
          <p className="text-xs tracking-[0.25em] text-emerald-400">MODULE {module.number}</p>
          <h3 className="mt-3 text-3xl font-bold">{module.title}</h3>
          <p className="mt-3 text-zinc-400 leading-relaxed">{module.description}</p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
              <h4 className="text-sm font-bold tracking-wider text-zinc-300">What You Learn</h4>
              <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                {module.lessonPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 text-emerald-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
              <h4 className="text-sm font-bold tracking-wider text-zinc-300">Action Plan</h4>
              <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                {module.actionSteps.map((step) => (
                  <li key={step} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 text-cyan-400" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
