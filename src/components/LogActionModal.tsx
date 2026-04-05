import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Wind, Droplets, Recycle, CheckCircle2, Bus, ShoppingBag, Leaf } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogAction?: (categoryId: string, title: string, points: number, amount: number) => void;
}

export function LogActionModal({ isOpen, onClose, onLogAction }: LogActionModalProps) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  const categories = [
    { id: 'water_leak', label: 'Reported Water Leak', icon: Droplets, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20', unit: 'leaks reported', pointsPerUnit: 50 },
    { id: 'transit', label: 'Transit Trailblazer', icon: Bus, color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/20', unit: 'km traveled', pointsPerUnit: 10 },
    { id: 'cleanup', label: 'Community Cleanup', icon: Recycle, color: 'text-teal-400', bg: 'bg-teal-400/10', border: 'border-teal-400/20', unit: 'hours spent', pointsPerUnit: 100 },
    { id: 'groceries', label: 'Zero Waste Groceries', icon: ShoppingBag, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', unit: 'bags saved', pointsPerUnit: 25 },
    { id: 'carbon', label: 'Green Transit', icon: Wind, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', unit: 'km traveled', pointsPerUnit: 5 },
  ];

  const handleLog = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(3); // Success step
    
    // Calculate points and call the callback
    const selectedCat = categories.find(c => c.id === category);
    const earnedPoints = selectedCat ? (parseInt(amount) || 1) * selectedCat.pointsPerUnit : 25;
    
    const loggedAmount = parseInt(amount) || 1;
    if (onLogAction && selectedCat) {
      onLogAction(selectedCat.id, selectedCat.label, earnedPoints, loggedAmount);
    }

    setTimeout(() => {
      onClose();
      setTimeout(() => { setStep(1); setCategory(null); setAmount(''); }, 500);
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 z-50 shadow-2xl shadow-emerald-500/10"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="text-2xl font-bold text-white mb-2">Log Daily Impact</h2>
                <p className="text-zinc-400 mb-8">What eco-friendly action did you take today?</p>
                
                <div className="grid grid-cols-1 gap-4">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => { setCategory(cat.id); setStep(2); }}
                        className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all group text-left"
                      >
                        <div className={cn("p-3 rounded-xl border", cat.bg, cat.color, cat.border)}>
                          <Icon size={24} />
                        </div>
                        <div>
                          <h3 className="text-white font-medium text-lg group-hover:text-emerald-400 transition-colors">{cat.label}</h3>
                          <p className="text-zinc-500 text-sm">Track your {cat.unit}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 2 && category && (
              <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleLog}>
                <button type="button" onClick={() => setStep(1)} className="text-sm text-emerald-400 mb-6 hover:underline">
                  &larr; Back to categories
                </button>
                <h2 className="text-2xl font-bold text-white mb-2">Enter Amount</h2>
                <p className="text-zinc-400 mb-8">
                  How many {categories.find(c => c.id === category)?.unit} did you achieve?
                </p>

                <div className="mb-8">
                  <div className="relative flex items-center">
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-4xl font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="0"
                    />
                    <span className="absolute right-6 text-zinc-500 font-medium">
                      {categories.find(c => c.id === category)?.unit.split(' ')[0]}
                    </span>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-lg transition-colors"
                >
                  Log Impact & Earn Leaves
                </button>
              </motion.form>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Impact Logged!</h2>
                <p className="text-emerald-400 font-medium mb-2">
                  +{categories.find(c => c.id === category)?.pointsPerUnit ? (parseInt(amount) || 1) * categories.find(c => c.id === category)!.pointsPerUnit : 25} Leaves earned
                </p>
                <p className="text-zinc-500">Your dashboard is updating...</p>
              </motion.div>
            )}

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
