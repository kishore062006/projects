import { useState, useEffect } from 'react';
import { Leaf, Coffee, Bus, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AuthUser } from '../App';
import { API_BASE } from '../lib/api';

type UserMetricsResponse = {
  waterSaved: number;
  wasteReduced: number;
};

type DashboardResponse = {
  points: number;
  graphData: Array<{ name: string; carbon: number }>;
};

const CHALLENGE_FACTORS = {
  BUCKET_BATH_DAILY_WATER_LITERS: 31,
} as const;

interface RewardsProps {
  user: AuthUser | null;
}

export function Rewards({ user }: RewardsProps) {
  // ADDED: Real Balance State
  const [balance, setBalance] = useState(0);
  const [waterSaved, setWaterSaved] = useState(0);
  const [transitDays, setTransitDays] = useState(0);
  const [validatedChallenges, setValidatedChallenges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const savedPoints = localStorage.getItem('ecoPoints');
    if (savedPoints) {
      setBalance(parseInt(savedPoints));
    }

    const savedWater = localStorage.getItem('ecoWaterSaved');
    if (savedWater) {
      setWaterSaved(parseFloat(savedWater));
    }

    const savedGraph = JSON.parse(localStorage.getItem('ecoGraphData') || '[]') as Array<{ name: string; carbon: number }>;
    if (Array.isArray(savedGraph)) {
      setTransitDays(savedGraph.filter((day) => Number(day?.carbon || 0) > 0).length);
    }

    const savedValidatedChallenges = JSON.parse(localStorage.getItem('ecoValidatedChallenges') || '{}') as Record<string, boolean>;
    if (savedValidatedChallenges && typeof savedValidatedChallenges === 'object') {
      setValidatedChallenges(savedValidatedChallenges);
    }

    const loadDynamicChallengeData = async () => {
      if (!API_BASE || !user?.id) return;

      try {
        const dashboardResponse = await fetch(
          `${API_BASE}/api/dashboard?userId=${encodeURIComponent(user.id)}&role=${encodeURIComponent(user.role)}`,
        );
        if (dashboardResponse.ok) {
          const dashboardData = (await dashboardResponse.json()) as DashboardResponse;
          const nextBalance = Number(dashboardData?.points || 0);
          setBalance(nextBalance);
          localStorage.setItem('ecoPoints', String(nextBalance));

          if (Array.isArray(dashboardData?.graphData)) {
            const nextTransitDays = dashboardData.graphData.filter((day) => Number(day?.carbon || 0) > 0).length;
            setTransitDays(nextTransitDays);
            localStorage.setItem('ecoGraphData', JSON.stringify(dashboardData.graphData));
          }
        }
      } catch {
        // Keep local fallback values.
      }

      try {
        const metricsResponse = await fetch(`${API_BASE}/api/users/${user.id}/metrics`);
        if (!metricsResponse.ok) return;

        const metricsData = (await metricsResponse.json()) as UserMetricsResponse;
        const nextWaterSaved = Number(metricsData?.waterSaved || 0);
        setWaterSaved(nextWaterSaved);
        localStorage.setItem('ecoWaterSaved', String(nextWaterSaved));
      } catch {
        // Keep local fallback values.
      }
    };

    void loadDynamicChallengeData();
  }, [user]);

  const bucketBathProgress = Math.min(7, Math.floor(waterSaved / CHALLENGE_FACTORS.BUCKET_BATH_DAILY_WATER_LITERS));
  const transitTrailblazerProgress = Math.min(5, transitDays);

  // ADDED: Redeem Logic
  const handleRedeem = (cost: number, rewardName: string) => {
    if (balance >= cost) {
      const newBalance = balance - cost;
      setBalance(newBalance);
      localStorage.setItem('ecoPoints', newBalance.toString());
      alert(`Successfully redeemed: ${rewardName}! You have ${newBalance} Leaves remaining.`);
    } else {
      alert(`Not enough Leaves! You need ${cost - balance} more to redeem this reward.`);
    }
  };

  const handleValidateChallenge = (challengeKey: string, progress: number, total: number, reward: number, challengeName: string) => {
    if (validatedChallenges[challengeKey]) {
      alert(`Challenge already validated: ${challengeName}.`);
      return;
    }

    if (progress < total) {
      alert(`You can validate \"${challengeName}\" after completing ${total} days.`);
      return;
    }

    const nextBalance = balance + reward;
    const nextValidatedChallenges = {
      ...validatedChallenges,
      [challengeKey]: true,
    };

    setBalance(nextBalance);
    setValidatedChallenges(nextValidatedChallenges);
    localStorage.setItem('ecoPoints', String(nextBalance));
    localStorage.setItem('ecoValidatedChallenges', JSON.stringify(nextValidatedChallenges));

    alert(`Challenge validated: ${challengeName}! +${reward} Leaves added.`);
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#2A0813] text-white p-8 md:p-12 pl-[300px] md:pl-[320px]">
      <motion.header 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-12 max-w-4xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-[#D4AF37]/10 rounded-2xl text-white">
            <Leaf size={28} />
          </div>
          <h2 className="text-4xl font-serif font-medium text-white">Eco Rewards</h2>
        </div>
        <p className="text-white/80 text-lg">Redeem your hard-earned EcoPoints for real-world benefits. Support local, sustainable businesses.</p>
      </motion.header>

      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-[#1A050C] border border-[#D4AF37]/20 rounded-[2rem] p-8 md:p-10 text-white flex flex-col md:flex-row justify-between items-center gap-8 mb-16 shadow-2xl shadow-black/50"
        >
          <div>
            <p className="text-white/60 font-medium mb-2 uppercase tracking-wider text-sm">Current Balance</p>
            <div className="flex items-baseline gap-3">
              {/* ADDED: Dynamic Balance */}
              <h3 className="text-6xl font-serif text-white">{balance}</h3>
              <span className="text-2xl text-white/60">Leaves</span>
            </div>
            <p className="mt-4 text-white/70 max-w-sm">
              {balance < 3000 ? `You're ${3000 - balance} Leaves away from the "Guardian" tier. Keep logging!` : 'You are currently in the Guardian Tier!'}
            </p>
          </div>
          <div className="w-full md:w-auto bg-[#D4AF37]/5 backdrop-blur-md border border-[#D4AF37]/20 rounded-3xl p-6 text-center">
            <p className="text-sm font-medium mb-2 text-white">Current Tier</p>
            <div className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#2A0813] px-4 py-2 rounded-full font-bold">
              <CheckCircle2 size={18} className="text-[#2A0813]" />
              {balance >= 3000 ? 'Guardian' : 'Warden'}
            </div>
          </div>
        </motion.div>

        <motion.h3 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-2xl font-serif font-medium mb-6 text-white"
        >
          Available Rewards
        </motion.h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <RewardCard 
            icon={Bus}
            title="City Transit Pass"
            description="Free 24-hour unlimited ride pass for all municipal buses and trains."
            cost={500}
            color="bg-[#D4AF37]/10"
            iconColor="text-white"
            delay={0.3}
            onRedeem={() => handleRedeem(500, "City Transit Pass")} // ADDED
          />
          <RewardCard 
            icon={Coffee}
            title="Free Organic Coffee"
            description="One free fair-trade coffee at participating local GreenCafes."
            cost={300}
            color="bg-[#D4AF37]/10"
            iconColor="text-white"
            delay={0.4}
            onRedeem={() => handleRedeem(300, "Free Organic Coffee")} // ADDED
          />
          <RewardCard 
            icon={ShoppingBag}
            title="15% Off Zero-Waste"
            description="Discount voucher for the EarthFirst bulk grocery store."
            cost={800}
            color="bg-[#D4AF37]/10"
            iconColor="text-white"
            delay={0.5}
            onRedeem={() => handleRedeem(800, "15% Off Zero-Waste")} // ADDED
          />
        </div>

        <motion.h3 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-2xl font-serif font-medium mt-16 mb-6 text-white"
        >
          Active Challenges
        </motion.h3>
        <div className="space-y-4">
          <ChallengeCard 
            title="The 7-Day Bucket Bath (SDG 6)"
            progress={bucketBathProgress}
            total={7}
            reward={300}
            delay={0.7}
            isValidated={Boolean(validatedChallenges.bucketBath)}
            onValidate={() => handleValidateChallenge('bucketBath', bucketBathProgress, 7, 300, 'The 7-Day Bucket Bath')}
          />
          <ChallengeCard 
            title="Transit Trailblazer (SDG 11)"
            progress={transitTrailblazerProgress}
            total={5}
            reward={250}
            delay={0.8}
            isValidated={Boolean(validatedChallenges.transitTrailblazer)}
            onValidate={() => handleValidateChallenge('transitTrailblazer', transitTrailblazerProgress, 5, 250, 'Transit Trailblazer')}
          />
        </div>
      </div>
    </div>
  );
}

// ADDED: onRedeem prop
function RewardCard({ icon: Icon, title, description, cost, color, iconColor, delay = 0, onRedeem }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-[#3D101D] rounded-3xl p-6 border border-[#D4AF37]/20 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/40 transition-shadow flex flex-col h-full"
    >
      <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-6`}>
        <Icon size={28} className={iconColor} />
      </div>
      <h4 className="text-xl font-medium mb-2 text-white">{title}</h4>
      <p className="text-white/70 text-sm flex-1 mb-6">{description}</p>
      <button 
        onClick={onRedeem} // ADDED
        className="w-full py-3 rounded-xl bg-[#D4AF37]/10 text-white font-semibold hover:bg-[#D4AF37]/20 transition-colors flex items-center justify-center gap-2"
      >
        Redeem • {cost} <Leaf size={16} />
      </button>
    </motion.div>
  );
}

function ChallengeCard({ title, progress, total, reward, delay = 0, onValidate, isValidated }: any) {
  const percentage = (progress / total) * 100;
  const isCompleted = progress >= total;
  const canValidate = isCompleted && !isValidated;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-[#3D101D] rounded-2xl p-6 border border-[#D4AF37]/20 flex flex-col md:flex-row items-center gap-6 shadow-lg shadow-black/20"
    >
      <div className="flex-1 w-full">
        <div className="flex justify-between items-end mb-2">
          <h4 className="font-medium text-lg text-white">{title}</h4>
          <span className="text-sm font-bold text-white/70">{progress}/{total} Days</span>
        </div>
        <div className="h-3 w-full bg-[#1A050C] rounded-full overflow-hidden border border-[#D4AF37]/10">
          <div 
            className="h-full bg-[#D4AF37] rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(212,175,55,0.5)]"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
      <div className="flex-col flex items-center justify-center min-w-[100px]">
        <span className="text-sm text-white/70 mb-1">Reward</span>
        <div className="flex items-center gap-1 font-bold text-white">
          +{reward} <Leaf size={16} />
        </div>
        <button
          onClick={onValidate}
          disabled={!canValidate}
          className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#D4AF37]/10 text-white hover:bg-[#D4AF37]/20"
        >
          {isValidated ? 'Validated' : 'Validate'}
        </button>
      </div>
    </motion.div>
  );
}