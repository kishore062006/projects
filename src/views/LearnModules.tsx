import { motion } from 'framer-motion';
import { ArrowRight, Droplets, ThermometerSun, Recycle } from 'lucide-react';

export function LearnModules() {
  return (
    <div className="flex-1 h-screen overflow-y-auto bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30">
      {/* Hero Section */}
      <div className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Removed expensive mix-blend-luminosity, replaced with hardware-friendly grayscale */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-15 grayscale"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 via-zinc-950/80 to-zinc-950"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-8 text-center pl-[280px] md:pl-[320px]">
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
      <div className="max-w-6xl mx-auto px-8 py-24 space-y-32 pl-[280px] md:pl-[320px]">
        <ModuleSection 
          number="01"
          title="Water Scarcity & SDG 6"
          description="By 2025, half of the world's population will be living in water-stressed areas. Learn how micro-actions like greywater recycling can save thousands of liters annually."
          icon={Droplets}
          color="from-blue-500 to-cyan-400"
          image="https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop"
        />
        
        <ModuleSection 
          number="02"
          title="Urban Waste & SDG 11"
          description="Cities generate 70% of global waste. Discover the lifecycle of a plastic bottle and how circular economies are transforming urban landscapes."
          icon={Recycle}
          color="from-emerald-500 to-green-400"
          image="https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=2070&auto=format&fit=crop"
          reverse
        />

        <ModuleSection 
          number="03"
          title="Global Heating & SDG 13"
          description="The science behind the 1.5°C threshold. Understand your carbon footprint and the systemic changes required to halt climate change."
          icon={ThermometerSun}
          color="from-orange-500 to-red-500"
          image="https://images.unsplash.com/photo-1615092296061-e2ccfeb2f3d6?q=80&w=2070&auto=format&fit=crop"
        />
      </div>
    </div>
  );
}

function ModuleSection({ number, title, description, icon: Icon, color, image, reverse = false }: any) {
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
        <button className="group flex items-center gap-3 text-sm font-bold uppercase tracking-wider mt-8 hover:text-emerald-400 transition-colors">
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
