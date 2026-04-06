import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis, XAxis } from 'recharts';
import { Droplets, Wind, Recycle, Activity, ArrowUpRight, Leaf, Plus, Footprints, X } from 'lucide-react';
import { LogActionModal } from '../components/LogActionModal';
import type { AuthUser } from '../App';
import { API_BASE } from '../lib/api';

// Average-based impact factors sourced from official datasets.
// - US EPA: Passenger vehicle emits ~404 g CO2 per mile -> ~0.251 kg CO2 per km.
// - US EPA: A faucet dripping once/second can waste ~3,000 gallons/year -> ~31 L/day.
// - World Bank (What a Waste 2.0): Global municipal solid waste avg ~0.74 kg/person/day.
const IMPACT_FACTORS = {
  CAR_EMISSIONS_KG_CO2_PER_KM: 0.251,
  WATER_SAVED_PER_REPORTED_LEAK_L: 31,
  WASTE_AVOIDED_PER_GROCERY_ACTION_KG: 0.74,
  WASTE_COLLECTED_PER_CLEANUP_HOUR_KG: 1.48,
} as const;

// FIXED: Graph starts at 0 for all days. It will only grow when the user inputs data!
const defaultGraphData = [
  { name: 'Monday', carbon: 0 },
  { name: 'Tuesday', carbon: 0 },
  { name: 'Wednesday', carbon: 0 },
  { name: 'Thursday', carbon: 0 },
  { name: 'Friday', carbon: 0 },
  { name: 'Saturday', carbon: 0 },
  { name: 'Sunday', carbon: 0 },
];

type DashboardResponse = {
  points: number;
  resolvedCount: number;
  pendingCount: number;
  graphData: Array<{ name: string; carbon: number }>;
  recentActions: Array<{ id: number; title: string; time: string; points: number | string; type: string }>;
};

interface CitizenDashboardProps {
  user: AuthUser | null;
}

export function CitizenDashboard({ user }: CitizenDashboardProps) {
  const [isLoggingAction, setIsLoggingAction] = useState(false);
  
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [waterSaved, setWaterSaved] = useState(0);
  const [wasteReduced, setWasteReduced] = useState(0);
  
  const [resolvedCount, setResolvedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const [graphData, setGraphData] = useState(defaultGraphData);
  
  const [isWalkModalOpen, setIsWalkModalOpen] = useState(false);
  const [walkKm, setWalkKm] = useState('');
  const [walkDay, setWalkDay] = useState('Monday');

  const normalizeGraphData = (incoming: Array<{ name: string; carbon: number }> | undefined) => {
    if (!incoming || incoming.length === 0) {
      return defaultGraphData;
    }

    const incomingMap = new Map(incoming.map((item) => [item.name, item.carbon]));
    return defaultGraphData.map((day) => ({
      name: day.name,
      carbon: Number(incomingMap.get(day.name) ?? day.carbon),
    }));
  };

  useEffect(() => {
    const savedActions = JSON.parse(localStorage.getItem('ecoActions') || 'null');
    if (savedActions) setRecentActions(savedActions);

    const savedPoints = localStorage.getItem('ecoPoints');
    if (savedPoints) setTotalPoints(parseInt(savedPoints));

    const savedWater = localStorage.getItem('ecoWaterSaved');
    if (savedWater) setWaterSaved(parseFloat(savedWater));

    const savedWaste = localStorage.getItem('ecoWasteReduced');
    if (savedWaste) setWasteReduced(parseFloat(savedWaste));

    const savedReports = JSON.parse(localStorage.getItem('ecoSyncReports') || '[]');
    const scopedReports = user?.id
      ? savedReports.filter((report: any) => String(report?.ownerUserId || '') === user.id)
      : [];
    const resolved = scopedReports.filter((report: any) => report.status === 'Resolved').length;
    const pending = scopedReports.filter((report: any) => report.status !== 'Resolved').length;
    
    setResolvedCount(resolved);
    setPendingCount(pending);

    const savedGraph = JSON.parse(localStorage.getItem('ecoGraphData') || 'null');
    if (savedGraph) setGraphData(normalizeGraphData(savedGraph));

    const loadDashboard = async () => {
      if (!API_BASE || !user?.id) return;

      try {
        const response = await fetch(
          `${API_BASE}/api/dashboard?userId=${encodeURIComponent(user.id)}&role=${encodeURIComponent(user.role)}`,
        );
        if (!response.ok) return;
        const data = (await response.json()) as DashboardResponse;

        setTotalPoints(Number(data.points || 0));
        setResolvedCount(Number(data.resolvedCount || 0));
        setPendingCount(Number(data.pendingCount || 0));
        setGraphData(normalizeGraphData(data.graphData));

        const normalizedActions = Array.isArray(data.recentActions)
          ? data.recentActions.map((action) => ({
              ...action,
              points: typeof action.points === 'number' ? `+${action.points}` : action.points,
            }))
          : [];
        setRecentActions(normalizedActions);

        localStorage.setItem('ecoPoints', String(Number(data.points || 0)));
        localStorage.setItem('ecoGraphData', JSON.stringify(normalizeGraphData(data.graphData)));
        localStorage.setItem('ecoActions', JSON.stringify(normalizedActions));
      } catch {
        // Keep local fallback values.
      }
    };

    const loadMetrics = async () => {
      if (!user?.id || !API_BASE) return;

      try {
        const response = await fetch(`${API_BASE}/api/users/${user.id}/metrics`);
        if (!response.ok) return;
        const data = await response.json();

        const nextWaterSaved = Number(data?.waterSaved || 0);
        const nextWasteReduced = Number(data?.wasteReduced || 0);

        setWaterSaved(nextWaterSaved);
        setWasteReduced(nextWasteReduced);
        localStorage.setItem('ecoWaterSaved', String(nextWaterSaved));
        localStorage.setItem('ecoWasteReduced', String(nextWasteReduced));
      } catch {
        // Keep local values if backend metrics fetch fails.
      }
    };

    void loadDashboard();
    void loadMetrics();
  }, [user]);

  const handleLogAction = (categoryId: string, title: string, points: number, amount: number) => {
    const newAction = {
      id: Date.now(),
      title,
      time: 'Just now',
      points: `+${points}`,
      type: 'user-logged'
    };
    
    const updatedActions = [newAction, ...recentActions].slice(0, 5); 
    setRecentActions(updatedActions);
    
    const newTotalPoints = totalPoints + points;
    setTotalPoints(newTotalPoints);

    let newWater = waterSaved;
    let newWaste = wasteReduced;

    if (categoryId === 'water_leak') {
      newWater += amount * IMPACT_FACTORS.WATER_SAVED_PER_REPORTED_LEAK_L;
    }
    if (categoryId === 'groceries') {
      newWaste += amount * IMPACT_FACTORS.WASTE_AVOIDED_PER_GROCERY_ACTION_KG;
    }
    if (categoryId === 'cleanup') {
      newWaste += amount * IMPACT_FACTORS.WASTE_COLLECTED_PER_CLEANUP_HOUR_KG;
    }

    newWater = Number(newWater.toFixed(1));
    newWaste = Number(newWaste.toFixed(1));

    setWaterSaved(newWater);
    setWasteReduced(newWaste);

    localStorage.setItem('ecoActions', JSON.stringify(updatedActions));
    localStorage.setItem('ecoPoints', newTotalPoints.toString());
    localStorage.setItem('ecoWaterSaved', newWater.toString());
    localStorage.setItem('ecoWasteReduced', newWaste.toString());

    const syncMetrics = async () => {
      if (!user?.id || !API_BASE) return;

      try {
        const response = await fetch(`${API_BASE}/api/users/${user.id}/metrics/log-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId, amount }),
        });

        if (!response.ok) return;
        const data = await response.json();
        if (typeof data?.waterSaved === 'number') {
          setWaterSaved(data.waterSaved);
          localStorage.setItem('ecoWaterSaved', String(data.waterSaved));
        }
        if (typeof data?.wasteReduced === 'number') {
          setWasteReduced(data.wasteReduced);
          localStorage.setItem('ecoWasteReduced', String(data.wasteReduced));
        }
      } catch {
        // Local fallback already applied above.
      }
    };

    const syncAction = async () => {
      if (!API_BASE || !user?.id) return;

      try {
        await fetch(`${API_BASE}/api/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, points, type: categoryId, userId: user.id }),
        });
      } catch {
        // Local fallback already applied.
      }
    };

    void syncMetrics();
    void syncAction();
  };

  const handleLogWalk = (e: React.FormEvent) => {
    e.preventDefault();
    const km = parseFloat(walkKm);
    if (isNaN(km) || km <= 0) return;

    const carbonSaved = Number((km * IMPACT_FACTORS.CAR_EMISSIONS_KG_CO2_PER_KM).toFixed(2));
    
    const updatedGraphData = graphData.map(day => 
      day.name === walkDay ? { ...day, carbon: parseFloat((day.carbon + carbonSaved).toFixed(1)) } : day
    );

    setGraphData([...updatedGraphData]);
    localStorage.setItem('ecoGraphData', JSON.stringify(updatedGraphData));

    const syncGraph = async () => {
      if (!API_BASE || !user?.id) return;

      try {
        await fetch(`${API_BASE}/api/graph`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day: walkDay, carbon: carbonSaved, userId: user.id }),
        });
      } catch {
        // Local fallback already applied.
      }
    };
    
    const realisticCarbon = carbonSaved;
    handleLogAction('carbon', `Walked ${km}km (Saved ${realisticCarbon}kg CO2)`, Math.floor(km * 5), km);
    void syncGraph();
    
    setIsWalkModalOpen(false);
    setWalkKm('');
  };

  const rankImprovement = (resolvedCount * 2) + Math.floor(totalPoints / 50);
  const currentRank = Math.max(1, 15 - rankImprovement); 
  const rankTrend = Math.max(1, rankImprovement); 

  return (
    <div className="relative flex-1 h-screen overflow-y-auto bg-[#050505] text-zinc-50 selection:bg-emerald-500/30">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-8 md:p-12 pl-[300px] md:pl-[320px]">
        <motion.header 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <h2 className="text-sm font-bold tracking-widest text-emerald-400 uppercase mb-2 flex items-center gap-2">
              <Activity size={16} /> Live Impact Sync
            </h2>
            <h1 className="text-5xl md:text-6xl font-light tracking-tighter">
              Your <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Ecosystem</span>
            </h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap justify-end">
            
            <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.05] rounded-full py-2 px-6 backdrop-blur-md">
              <span className="text-sm text-zinc-400">Global Rank</span>
              <span className="text-lg font-bold text-white">Top {currentRank}%</span>
              <div className="w-px h-4 bg-white/10"></div>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <ArrowUpRight size={16} /> {rankTrend}%
              </span>
            </div>

            <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.05] rounded-full py-2 px-6 backdrop-blur-md">
              <span className="text-sm text-zinc-400">Total Leaves</span>
              <span className="text-lg font-bold text-emerald-400 flex items-center gap-1"><Leaf size={16}/> {totalPoints}</span>
            </div>

            <button 
              onClick={() => setIsWalkModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 px-6 py-3 rounded-full font-bold transition-all"
            >
              <Footprints size={20} />
              Log Walk
            </button>

            <button 
              onClick={() => setIsLoggingAction(true)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
            >
              <Plus size={20} />
              Log Impact
            </button>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="md:col-span-8 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] p-8 relative overflow-hidden backdrop-blur-2xl group hover:bg-white/[0.04] transition-colors duration-500 flex flex-col min-h-[500px]"
          >
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
              
              <div>
                <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2 flex items-center justify-between">
                  Total Civic Reports
                  <span className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400"><Wind size={18} /></span>
                </p>
                
                <div className="flex flex-wrap items-baseline gap-6 mt-2">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-6xl font-black tracking-tighter text-white">{resolvedCount}</h3>
                    <span className="text-lg text-emerald-400 font-light">Fixed</span>
                  </div>
                  <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-6xl font-black tracking-tighter text-white/50">{pendingCount}</h3>
                    <span className="text-lg text-amber-400 font-light">Pending</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Total Carbon Saved This Week</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <h3 className="text-6xl font-black tracking-tighter text-emerald-400">
                    {graphData.reduce((acc, curr) => acc + curr.carbon, 0).toFixed(1)}
                  </h3>
                  <span className="text-lg text-zinc-500 font-light">kg Saved</span>
                </div>
                <p className="text-emerald-400 text-sm font-medium mt-2 flex items-center gap-2">
                  <Leaf size={16} /> Equivalent to planting a small forest!
                </p>
              </div>

            </div>

            <div className="flex-1 w-full min-h-[250px] opacity-80 group-hover:opacity-100 transition-opacity duration-500">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorCarbon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    cursor={{ stroke: '#ffffff20', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #ffffff10', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                  />
                  
                  <XAxis 
                    dataKey="name" 
                    stroke="#52525b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                    angle={-45}
                    textAnchor="end"
                  />
                  
                  <YAxis 
                    domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.2))]} 
                    stroke="#52525b" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`}
                    width={50}
                    label={{ 
                      value: 'Carbon Saved (kg)', 
                      angle: -90, 
                      position: 'insideLeft', 
                      offset: -5,
                      style: { fill: '#71717a', fontSize: 11, textAnchor: 'middle' } 
                    }}
                  />

                  <Area 
                    type="monotone" 
                    dataKey="carbon" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    fill="url(#colorCarbon)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="md:col-span-4 md:row-span-2 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] p-8 backdrop-blur-2xl flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-medium">Action Log</h3>
              <button className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">View All</button>
            </div>
            
            <div className="flex-1 relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/50 via-white/10 to-transparent"></div>
              
              <div className="space-y-8 relative z-10">
                {recentActions.length === 0 ? (
                  <p className="text-zinc-500 text-sm ml-8">No actions logged yet.</p>
                ) : (
                  recentActions.map((action, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 + (i * 0.1) }}
                      key={action.id} 
                      className="flex gap-6 group"
                    >
                      <div className="relative mt-1">
                        <div className="w-6 h-6 rounded-full bg-[#050505] border-2 border-emerald-500/30 flex items-center justify-center group-hover:border-emerald-400 transition-colors">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 scale-0 group-hover:scale-100 transition-transform"></div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors">{action.title}</h4>
                        <p className="text-xs text-zinc-500 mt-1">{action.time}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                          {action.points}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="md:col-span-4 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] p-8 backdrop-blur-2xl hover:bg-white/[0.04] transition-colors duration-500 group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform duration-500">
                <Droplets size={24} />
              </div>
              <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Water</span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-5xl font-black tracking-tighter text-white">{waterSaved}</h3>
                <span className="text-lg text-zinc-500 font-light">L</span>
              </div>
              <p className="text-cyan-400 text-sm font-medium mt-2">
                {waterSaved === 0 ? 'No data yet' : 'Liters saved from reported leaks'}
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="md:col-span-4 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] p-8 backdrop-blur-2xl hover:bg-white/[0.04] transition-colors duration-500 group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20 text-teal-400 group-hover:scale-110 transition-transform duration-500">
                <Recycle size={24} />
              </div>
              <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Waste</span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-5xl font-black tracking-tighter text-white">{wasteReduced}</h3>
                <span className="text-lg text-zinc-500 font-light">kg</span>
              </div>
              <p className="text-teal-400 text-sm font-medium mt-2">
                {wasteReduced === 0 ? 'No data yet' : 'Waste avoided through logged actions'}
              </p>
            </div>
          </motion.div>

        </div>
      </div>

      <LogActionModal 
        isOpen={isLoggingAction} 
        onClose={() => setIsLoggingAction(false)} 
        onLogAction={handleLogAction}
      />

      <AnimatePresence>
        {isWalkModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWalkModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#0a0a0a] border border-emerald-500/20 rounded-[2rem] p-8 z-50 shadow-2xl shadow-emerald-500/10"
            >
              <button 
                onClick={() => setIsWalkModalOpen(false)}
                className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                <Footprints size={32} />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">Track Your Walk</h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">Walking instead of driving saves ~0.2kg of CO2 per kilometer. Log your steps to update your impact graph!</p>

              <form onSubmit={handleLogWalk} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2 ml-1">Which day did you walk?</label>
                  <select 
                    value={walkDay}
                    onChange={(e) => setWalkDay(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="Monday" className="bg-zinc-900">Monday</option>
                    <option value="Tuesday" className="bg-zinc-900">Tuesday</option>
                    <option value="Wednesday" className="bg-zinc-900">Wednesday</option>
                    <option value="Thursday" className="bg-zinc-900">Thursday</option>
                    <option value="Friday" className="bg-zinc-900">Friday</option>
                    <option value="Saturday" className="bg-zinc-900">Saturday</option>
                    <option value="Sunday" className="bg-zinc-900">Sunday</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2 ml-1">Distance Walked</label>
                  <div className="relative flex items-center">
                    <input 
                      type="number" 
                      step="0.1"
                      min="0.1"
                      required
                      value={walkKm}
                      onChange={(e) => setWalkKm(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-4xl font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="0"
                    />
                    <span className="absolute right-6 text-zinc-500 font-medium">Kilometers</span>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-lg transition-colors mt-4"
                >
                  Update My Graph
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}