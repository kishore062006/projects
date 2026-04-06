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

type AdoptionZone = {
  id: string;
  name: string;
  type: 'park' | 'street' | 'lobby';
  lat: number;
  lng: number;
  radiusKm: number;
  adoptionCost: number;
  openIssueCount: number;
  health: 'healthy' | 'alert';
  adoptedByUserId: string | null;
  isOwnedByCurrentUser: boolean;
};

type AdoptionStatusResponse = {
  hasAdoption: boolean;
  aura: 'none' | 'green' | 'red';
  balance: number;
  passivePointsAwarded: number;
  openIssueCount?: number;
  zone?: {
    id: string;
    name: string;
  };
  passiveRatePerHour?: number;
};

interface RewardsProps {
  user: AuthUser | null;
}

export function Rewards({ user }: RewardsProps) {
  // ADDED: Real Balance State
  const [balance, setBalance] = useState(0);
  const [waterSaved, setWaterSaved] = useState(0);
  const [transitDays, setTransitDays] = useState(0);
  const [validatedChallenges, setValidatedChallenges] = useState<Record<string, boolean>>({});
  const [adoptionZones, setAdoptionZones] = useState<AdoptionZone[]>([]);
  const [adoptionStatus, setAdoptionStatus] = useState<AdoptionStatusResponse | null>(null);
  const [isAdoptionBusy, setIsAdoptionBusy] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const isHost = user?.role === 'admin' || String(user?.email || '').toLowerCase() === 'main@gmail.com';

  const countTransitLogs = (actions: Array<{ type?: string; title?: string }>) => {
    return actions.filter((action) => {
      const actionType = String(action?.type || '').toLowerCase();
      const actionTitle = String(action?.title || '').toLowerCase();
      return actionType === 'transit' || actionTitle.includes('transit');
    }).length;
  };

  useEffect(() => {
    const savedPoints = localStorage.getItem('ecoPoints');
    if (savedPoints) {
      setBalance(parseInt(savedPoints));
    }

    const savedWater = localStorage.getItem('ecoWaterSaved');
    if (savedWater) {
      setWaterSaved(parseFloat(savedWater));
    }

    const savedActions = JSON.parse(localStorage.getItem('ecoActions') || '[]') as Array<{ type?: string; title?: string }>;
    if (Array.isArray(savedActions)) {
      setTransitDays(countTransitLogs(savedActions));
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
            localStorage.setItem('ecoGraphData', JSON.stringify(dashboardData.graphData));
          }
        }
      } catch {
        // Keep local fallback values.
      }

      try {
        const actionsResponse = await fetch(`${API_BASE}/api/actions?userId=${encodeURIComponent(user.id)}`);
        if (actionsResponse.ok) {
          const actionsData = (await actionsResponse.json()) as Array<{ type?: string; title?: string }>;
          if (Array.isArray(actionsData)) {
            setTransitDays(countTransitLogs(actionsData));
            localStorage.setItem('ecoActions', JSON.stringify(actionsData));
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

      try {
        const zonesResponse = await fetch(
          `${API_BASE}/api/adopt-zones?userId=${encodeURIComponent(user.id)}`,
        );
        if (zonesResponse.ok) {
          const zonesData = (await zonesResponse.json()) as AdoptionZone[];
          setAdoptionZones(Array.isArray(zonesData) ? zonesData : []);
        }
      } catch {
        // Keep fallback values.
      }

      try {
        const statusResponse = await fetch(
          `${API_BASE}/api/adoptions/status?userId=${encodeURIComponent(user.id)}`,
        );
        if (statusResponse.ok) {
          const statusData = (await statusResponse.json()) as AdoptionStatusResponse;
          setAdoptionStatus(statusData);
          if (typeof statusData.balance === 'number') {
            setBalance(statusData.balance);
            localStorage.setItem('ecoPoints', String(statusData.balance));
          }
          localStorage.setItem('ecoAuraStatus', String(statusData.aura || 'none'));
        }
      } catch {
        // Keep fallback values.
      }
    };

    void loadDynamicChallengeData();
  }, [user]);

  const refreshAdoptionData = async () => {
    if (!API_BASE || !user?.id) return;

    try {
      const [zonesResponse, statusResponse] = await Promise.all([
        fetch(`${API_BASE}/api/adopt-zones?userId=${encodeURIComponent(user.id)}`),
        fetch(`${API_BASE}/api/adoptions/status?userId=${encodeURIComponent(user.id)}`),
      ]);

      if (zonesResponse.ok) {
        const zonesData = (await zonesResponse.json()) as AdoptionZone[];
        setAdoptionZones(Array.isArray(zonesData) ? zonesData : []);
      }

      if (statusResponse.ok) {
        const statusData = (await statusResponse.json()) as AdoptionStatusResponse;
        setAdoptionStatus(statusData);
        if (typeof statusData.balance === 'number') {
          setBalance(statusData.balance);
          localStorage.setItem('ecoPoints', String(statusData.balance));
        }
        localStorage.setItem('ecoAuraStatus', String(statusData.aura || 'none'));
      }
    } catch {
      // Keep existing values.
    }
  };

  const handleAdoptZone = async (zoneId: string) => {
    if (!API_BASE || !user?.id || isAdoptionBusy) return;
    setIsAdoptionBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/adoptions/adopt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, zoneId }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        alert(data.message || 'Unable to adopt this zone right now.');
        return;
      }

      await refreshAdoptionData();
      alert(data.message || 'Zone adopted successfully.');
    } catch {
      alert('Unable to adopt this zone right now.');
    } finally {
      setIsAdoptionBusy(false);
    }
  };

  const handleReleaseZone = async () => {
    if (!API_BASE || !user?.id || isAdoptionBusy) return;
    setIsAdoptionBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/adoptions/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        alert(data.message || 'Unable to release your zone.');
        return;
      }

      await refreshAdoptionData();
      alert(data.message || 'Adoption released.');
    } catch {
      alert('Unable to release your zone.');
    } finally {
      setIsAdoptionBusy(false);
    }
  };

  const handleForceReleaseZone = async (ownerUserId: string, zoneName: string) => {
    if (!API_BASE || !ownerUserId || isAdoptionBusy || !isHost) return;

    const confirmed = window.confirm(`Force release \"${zoneName}\" from user ${ownerUserId}?`);
    if (!confirmed) return;

    setIsAdoptionBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/adoptions/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ownerUserId }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        alert(data.message || 'Unable to force release this zone.');
        return;
      }

      await refreshAdoptionData();
      alert(`Force release successful for ${zoneName}.`);
    } catch {
      alert('Unable to force release this zone right now.');
    } finally {
      setIsAdoptionBusy(false);
    }
  };

  const transitTrailblazerProgress = Math.min(5, transitDays);
  const waterSaverProgress = Math.min(120, Math.floor(waterSaved));
  const territoryStewardProgress = adoptionStatus?.hasAdoption && adoptionStatus?.aura === 'green' ? 1 : 0;
  const selectedZone = adoptionZones.find((zone) => zone.id === selectedZoneId) || null;

  const activeChallenges = [
    {
      key: 'transitTrailblazer',
      title: 'Transit Trailblazer (SDG 11)',
      progress: transitTrailblazerProgress,
      total: 5,
      reward: 250,
      unitLabel: 'Trips',
      delay: 0.7,
    },
    {
      key: 'waterSaverSprint',
      title: 'Water Saver Sprint (SDG 6)',
      progress: waterSaverProgress,
      total: 120,
      reward: 220,
      unitLabel: 'Liters',
      delay: 0.8,
    },
    {
      key: 'territorySteward',
      title: 'Territory Steward (SDG 13)',
      progress: territoryStewardProgress,
      total: 1,
      reward: 320,
      unitLabel: 'Zone',
      delay: 0.9,
    },
  ] as const;

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

  const handleValidateChallenge = (
    challengeKey: string,
    progress: number,
    total: number,
    reward: number,
    challengeName: string,
    unitLabel: string,
  ) => {
    if (validatedChallenges[challengeKey]) {
      alert(`Challenge already validated: ${challengeName}.`);
      return;
    }

    if (progress < total) {
      alert(`You can validate \"${challengeName}\" after reaching ${total} ${unitLabel.toLowerCase()}.`);
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
          {activeChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.key}
              title={challenge.title}
              progress={challenge.progress}
              total={challenge.total}
              reward={challenge.reward}
              unitLabel={challenge.unitLabel}
              delay={challenge.delay}
              isValidated={Boolean(validatedChallenges[challenge.key])}
              onValidate={() =>
                handleValidateChallenge(
                  challenge.key,
                  challenge.progress,
                  challenge.total,
                  challenge.reward,
                  challenge.title,
                  challenge.unitLabel,
                )
              }
            />
          ))}
        </div>

        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="text-2xl font-serif font-medium mt-16 mb-3 text-white"
        >
          Adopt-a-Spot Territory Game
        </motion.h3>
        <p className="text-white/70 mb-6">
          Spend Leaves to adopt one zone. Keep it clean for a green aura and passive points.
          Open pollution or damage reports inside your zone turn your aura red.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-emerald-200">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Green Zone: Healthy
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1 text-red-200">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            Red Zone: Alert
          </div>
        </div>

        {selectedZone && (
          <div className="mb-6 rounded-2xl border border-[#D4AF37]/25 bg-[#1A050C] p-4">
            <p className="text-xs uppercase tracking-widest text-white/60 mb-1">Selected Zone</p>
            <p className="text-white font-medium">{selectedZone.name}</p>
            <p className={selectedZone.health === 'healthy' ? 'text-emerald-300 text-sm mt-1' : 'text-red-300 text-sm mt-1'}>
              {selectedZone.health === 'healthy'
                ? 'Status: Green (Healthy)'
                : `Status: Red (Alert) - ${selectedZone.openIssueCount} open issues`}
            </p>
          </div>
        )}

        <div className="bg-[#1A050C] border border-[#D4AF37]/20 rounded-2xl p-5 mb-6">
          {adoptionStatus?.hasAdoption ? (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/70 uppercase tracking-wider mb-1">Current Territory</p>
                <p className="text-xl text-white font-medium">{adoptionStatus.zone?.name}</p>
                <p className={adoptionStatus.aura === 'green' ? 'text-emerald-400 mt-1' : 'text-red-400 mt-1'}>
                  Aura: {adoptionStatus.aura === 'green' ? 'Green (Healthy)' : 'Red (Needs Cleanup)'}
                </p>
                <p className="text-white/70 text-sm mt-1">
                  Open issue count: {adoptionStatus.openIssueCount || 0} • Passive rate: +{adoptionStatus.passiveRatePerHour || 20} Leaves/hour
                </p>
                {adoptionStatus.passivePointsAwarded > 0 && (
                  <p className="text-emerald-300 text-sm mt-1">
                    Passive points credited: +{adoptionStatus.passivePointsAwarded}
                  </p>
                )}
              </div>
              <button
                onClick={handleReleaseZone}
                disabled={isAdoptionBusy}
                className="px-5 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-100 hover:bg-red-500/30 transition-colors disabled:opacity-60"
              >
                Release Zone
              </button>
            </div>
          ) : (
            <p className="text-white/80">No zone adopted yet. Choose one below.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
          {adoptionZones.map((zone) => {
            const isTakenByOther = Boolean(zone.adoptedByUserId && !zone.isOwnedByCurrentUser);
            const isSelected = selectedZoneId === zone.id;
            return (
              <div
                key={zone.id}
                onClick={() => setSelectedZoneId(zone.id)}
                className={`cursor-pointer bg-[#3D101D] rounded-2xl border p-5 transition-all ${
                  isSelected
                    ? 'ring-2 ring-[#D4AF37]/70 shadow-[0_0_0_1px_rgba(212,175,55,0.45)]'
                    : ''
                } ${zone.health === 'healthy' ? 'border-emerald-500/40' : 'border-red-500/40'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">{zone.name}</p>
                    <p className="text-white/60 text-sm capitalize mt-1">{zone.type} • Radius {zone.radiusKm} km</p>
                    <p className={zone.health === 'healthy' ? 'text-emerald-300 text-sm mt-2' : 'text-red-300 text-sm mt-2'}>
                      {zone.health === 'healthy' ? 'Healthy zone' : `Alert: ${zone.openIssueCount} open issues`}
                    </p>
                  </div>
                  <span className="text-white/80 text-sm">{zone.adoptionCost} Leaves</span>
                </div>
                <button
                  onClick={() => handleAdoptZone(zone.id)}
                  disabled={isAdoptionBusy || !!adoptionStatus?.hasAdoption || isTakenByOther}
                  className="mt-4 w-full py-2 rounded-xl bg-[#D4AF37]/15 text-white font-semibold hover:bg-[#D4AF37]/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {zone.isOwnedByCurrentUser
                    ? 'Already Adopted By You'
                    : isTakenByOther
                    ? 'Adopted By Another User'
                    : 'Adopt This Zone'}
                </button>

                {isHost && isTakenByOther && zone.adoptedByUserId && (
                  <button
                    onClick={() => handleForceReleaseZone(zone.adoptedByUserId as string, zone.name)}
                    disabled={isAdoptionBusy}
                    className="mt-2 w-full py-2 rounded-xl bg-red-500/20 border border-red-400/35 text-red-100 font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Force Release (Host)
                  </button>
                )}
              </div>
            );
          })}
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

function ChallengeCard({ title, progress, total, reward, unitLabel = 'Days', delay = 0, onValidate, isValidated }: any) {
  const percentage = total > 0 ? (progress / total) * 100 : 0;
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
          <span className="text-sm font-bold text-white/70">{progress}/{total} {unitLabel}</span>
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