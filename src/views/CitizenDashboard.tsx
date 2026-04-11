import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis, XAxis } from 'recharts';
import { Droplets, Wind, Recycle, Activity, ArrowUpRight, Leaf, Plus, Footprints, X } from 'lucide-react';
import { LogActionModal } from '../components/LogActionModal';
import type { AuthUser } from '../App';
import { API_BASE } from '../lib/api';
import { scopeReportsToAccount } from '../lib/utils';

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

const WALK_SAMPLE_INTERVAL_MS = 5000;

const haversineKm = (a: WalkPoint, b: WalkPoint) => {
  const radiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * radiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const calculateRouteDistanceKm = (points: WalkPoint[]) => {
  const orderedPoints = [...points].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let distanceKm = 0;

  for (let index = 1; index < orderedPoints.length; index += 1) {
    distanceKm += haversineKm(orderedPoints[index - 1], orderedPoints[index]);
  }

  return Number(distanceKm.toFixed(3));
};

type DashboardResponse = {
  points: number;
  resolvedCount: number;
  pendingCount: number;
  graphData: Array<{ name: string; carbon: number }>;
  recentActions: Array<{ id: number; title: string; time: string; points: number | string; type: string }>;
};

type WalkPoint = {
  lat: number;
  lng: number;
  timestamp: string;
  accuracyMeters?: number;
};

type WalkTrackResponse = {
  sessionId: string;
  userId: string;
  day: string;
  startedAt: string;
  updatedAt: string;
  startPoint: WalkPoint;
  sampleCount: number;
  accepted?: boolean;
  trackedDistanceKm?: number;
  message?: string;
};

type WalkSessionSummary = {
  sessionId: string;
  userId: string;
  day: string;
  startedAt: string;
  updatedAt: string;
  startPoint: WalkPoint;
  sampleCount: number;
};

type WalkStopResponse = {
  sessionId: string;
  distanceKm: number;
  awardedLeaves: number;
  carbonSaved: number;
  day: string;
  durationMinutes: number;
  aura: string;
  verified?: boolean;
};

type UserReportItem = {
  id: string;
  type?: string;
  location?: string;
  status?: string;
  time?: string;
  priority?: string;
  timestamp?: string;
  reporter?: string;
  ownerUserId?: string;
};

interface CitizenDashboardProps {
  user: AuthUser | null;
}

export function CitizenDashboard({ user }: CitizenDashboardProps) {
  const [isLoggingAction, setIsLoggingAction] = useState(false);
  const [isWalkStarting, setIsWalkStarting] = useState(false);
  const [isWalkStopping, setIsWalkStopping] = useState(false);
  const [isWalkTracking, setIsWalkTracking] = useState(false);
  const [logActionError, setLogActionError] = useState('');
  
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [waterSaved, setWaterSaved] = useState(0);
  const [wasteReduced, setWasteReduced] = useState(0);
  
  const [resolvedCount, setResolvedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [myReports, setMyReports] = useState<UserReportItem[]>([]);

  const [graphData, setGraphData] = useState(defaultGraphData);
  
  const [isWalkModalOpen, setIsWalkModalOpen] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);
  const [walkDay, setWalkDay] = useState('Monday');
  const [walkSession, setWalkSession] = useState<WalkSessionSummary | null>(null);
  const [walkPoints, setWalkPoints] = useState<WalkPoint[]>([]);
  const [walkEstimatedKm, setWalkEstimatedKm] = useState(0);
  const [walkStatus, setWalkStatus] = useState('Start a verified walk session to earn Leaves.');
  const [walkError, setWalkError] = useState('');
  const walkSamplingBusyRef = useRef(false);
  const walkIntervalRef = useRef<number | null>(null);
  const walkSessionRef = useRef<WalkSessionSummary | null>(null);

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

  const parseActionPoints = (value: number | string) => {
    if (typeof value === 'number') {
      return value;
    }
    const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatActionPoints = (value: number | string) => {
    const numericPoints = parseActionPoints(value);
    const sign = numericPoints > 0 ? '+' : numericPoints < 0 ? '-' : '';
    return `${sign}${Math.abs(numericPoints)}`;
  };

  const actionPointsClassName = (value: number | string) => {
    const numericPoints = parseActionPoints(value);
    if (numericPoints < 0) {
      return 'text-red-400 bg-red-400/10';
    }
    if (numericPoints > 0) {
      return 'text-emerald-400 bg-emerald-400/10';
    }
    return 'text-zinc-300 bg-zinc-300/10';
  };

  const formatReportIssuedAt = (report: UserReportItem) => {
    const rawIssuedAt = String(report.timestamp || '').trim();
    if (rawIssuedAt) {
      const parsed = new Date(rawIssuedAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString();
      }
    }

    const fallbackTime = String(report.time || '').trim();
    return fallbackTime || 'Just now';
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
    const scopedReports = scopeReportsToAccount(savedReports, user) as UserReportItem[];
    setMyReports(
      [...scopedReports].sort((left, right) => {
        const leftTime = new Date(left.timestamp || left.time || 0).getTime();
        const rightTime = new Date(right.timestamp || right.time || 0).getTime();
        return rightTime - leftTime;
      }),
    );
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
              points: typeof action.points === 'number' ? action.points : Number(action.points || 0),
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

    const loadReports = async () => {
      if (!user?.id) return;

      if (API_BASE) {
        try {
          const response = await fetch(
            `${API_BASE}/api/reports?userId=${encodeURIComponent(user.id)}&role=${encodeURIComponent(user.role)}`,
          );

          if (response.ok) {
            const data = (await response.json()) as UserReportItem[];
            const scoped = scopeReportsToAccount(Array.isArray(data) ? data : [], user) as UserReportItem[];
            setMyReports(
              [...scoped].sort((left, right) => {
                const leftTime = new Date(left.timestamp || left.time || 0).getTime();
                const rightTime = new Date(right.timestamp || right.time || 0).getTime();
                return rightTime - leftTime;
              }),
            );
            localStorage.setItem('ecoSyncReports', JSON.stringify(scoped));
            return;
          }
        } catch {
          // Fall back to local data below.
        }
      }

      const savedReports = JSON.parse(localStorage.getItem('ecoSyncReports') || '[]') as UserReportItem[];
      const scoped = scopeReportsToAccount(savedReports, user) as UserReportItem[];
      setMyReports(
        [...scoped].sort((left, right) => {
          const leftTime = new Date(left.timestamp || left.time || 0).getTime();
          const rightTime = new Date(right.timestamp || right.time || 0).getTime();
          return rightTime - leftTime;
        }),
      );
    };

    void loadDashboard();
    void loadMetrics();
    void loadReports();
  }, [user]);

  useEffect(() => {
    return () => {
      if (walkIntervalRef.current) {
        window.clearInterval(walkIntervalRef.current);
        walkIntervalRef.current = null;
      }
      walkSessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const restoreWalkSession = async () => {
      if (!API_BASE || !user?.id) return;

      try {
        const response = await fetch(`${API_BASE}/api/walk-sessions/status?userId=${encodeURIComponent(user.id)}`);
        if (!response.ok) return;

        const data = (await response.json()) as { active?: boolean } & WalkSessionSummary;
        if (!data.active) {
          return;
        }

        const restoredSession: WalkSessionSummary = {
          sessionId: data.sessionId,
          userId: data.userId,
          day: data.day,
          startedAt: data.startedAt,
          updatedAt: data.updatedAt,
          startPoint: data.startPoint,
          sampleCount: data.sampleCount,
        };
        walkSessionRef.current = restoredSession;
        setWalkSession(restoredSession);
        setWalkPoints([data.startPoint]);
        setWalkDay(data.day);
        setWalkStatus('Verified walk session is active. GPS sampling has resumed.');
        setIsWalkTracking(true);
        setIsWalkModalOpen(true);
        if (walkIntervalRef.current) {
          window.clearInterval(walkIntervalRef.current);
        }
        walkIntervalRef.current = window.setInterval(() => {
          void trackWalkPoint();
        }, WALK_SAMPLE_INTERVAL_MS);
      } catch {
        // Keep local default state.
      }
    };

    void restoreWalkSession();
  }, [user]);

  const requestCurrentWalkPoint = () => {
    return new Promise<WalkPoint>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date().toISOString(),
            accuracyMeters: Number(position.coords.accuracy),
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  };

  const updateTrackedPoints = (nextPoints: WalkPoint[]) => {
    setWalkPoints(nextPoints);
    setWalkEstimatedKm(calculateRouteDistanceKm(nextPoints));
  };

  const appendTrackedPoint = (point: WalkPoint) => {
    setWalkPoints((previousPoints) => {
      const nextPoints = [...previousPoints, point];
      setWalkEstimatedKm(calculateRouteDistanceKm(nextPoints));
      return nextPoints;
    });
  };

  const trackWalkPoint = async () => {
    if (!API_BASE || !user?.id || !walkSessionRef.current || walkSamplingBusyRef.current) return;

    walkSamplingBusyRef.current = true;
    try {
      const point = await requestCurrentWalkPoint();
      const response = await fetch(`${API_BASE}/api/walk-sessions/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, point }),
      });

      const payload = (await response.json()) as WalkTrackResponse;
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to record walk sample.');
      }

      if (typeof payload.trackedDistanceKm === 'number') {
        setWalkEstimatedKm(Number(payload.trackedDistanceKm));
      }

      if (payload.accepted) {
        appendTrackedPoint(point);
        setWalkStatus('Tracking verified walk session...');
      } else {
        setWalkStatus('GPS drift ignored. Keep walking in open sky for accurate tracking.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to record walk sample.';
      setWalkError(message);
    } finally {
      walkSamplingBusyRef.current = false;
    }
  };

  const startWalkSession = async () => {
    if (!API_BASE || !user?.id) {
      setWalkError('Walk verification requires a server connection.');
      return;
    }

    setIsWalkStarting(true);
    setWalkError('');

    try {
      const startPoint = await requestCurrentWalkPoint();
      const response = await fetch(`${API_BASE}/api/walk-sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, day: walkDay, startPoint }),
      });

      const payload = (await response.json()) as { message?: string } & WalkSessionSummary;
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to start walk session.');
      }

      const nextSession: WalkSessionSummary = {
        sessionId: payload.sessionId,
        userId: payload.userId,
        day: payload.day,
        startedAt: payload.startedAt,
        updatedAt: payload.updatedAt,
        startPoint: payload.startPoint,
        sampleCount: payload.sampleCount,
      };

      walkSessionRef.current = nextSession;
      setWalkSession(nextSession);
      updateTrackedPoints([startPoint]);
      setWalkStatus('Walk session started. GPS will be sampled every 5 seconds.');
      setIsWalkTracking(true);
      setIsWalkModalOpen(true);
      if (walkIntervalRef.current) {
        window.clearInterval(walkIntervalRef.current);
      }
      walkIntervalRef.current = window.setInterval(() => {
        void trackWalkPoint();
      }, WALK_SAMPLE_INTERVAL_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start verified walk.';
      setWalkError(message);
      setWalkStatus('Ready to start a verified walk session.');
    } finally {
      setIsWalkStarting(false);
    }
  };

  const stopWalkSession = async () => {
    if (!API_BASE || !user?.id || !walkSessionRef.current) {
      return;
    }

    setIsWalkStopping(true);
    setWalkError('');

    if (walkIntervalRef.current) {
      window.clearInterval(walkIntervalRef.current);
      walkIntervalRef.current = null;
    }

    try {
      const response = await fetch(`${API_BASE}/api/walk-sessions/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const payload = (await response.json()) as { message?: string } & WalkStopResponse;
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to verify walk session.');
      }

      if (walkIntervalRef.current) {
        window.clearInterval(walkIntervalRef.current);
        walkIntervalRef.current = null;
      }

      const verifiedDistanceKm = Number(payload.distanceKm || 0);
      const awardedLeaves = Number(payload.awardedLeaves || 0);
      const carbonSaved = Number(payload.carbonSaved || 0);
      const isVerified = Boolean(payload.verified);
      const nextTotalPoints = totalPoints + awardedLeaves;

      const nextActions = isVerified
        ? [
            {
              id: Date.now(),
              title: `Verified walk: ${verifiedDistanceKm.toFixed(2)} km`,
              time: 'Just now',
              points: awardedLeaves,
              type: 'verified-walk',
            },
            ...recentActions,
          ].slice(0, 20)
        : [
            {
              id: Date.now(),
              title: 'Walk session stopped without verification',
              time: 'Just now',
              points: 0,
              type: 'walk-stopped',
            },
            ...recentActions,
          ].slice(0, 20);

      const nextGraphData = isVerified
        ? graphData.map((day) =>
            day.name === payload.day ? { ...day, carbon: Number((day.carbon + carbonSaved).toFixed(1)) } : day,
          )
        : graphData;

      setTotalPoints(nextTotalPoints);
      setRecentActions(nextActions);
      setGraphData(nextGraphData);
      setIsWalkTracking(false);
      setWalkSession(null);
      walkSessionRef.current = null;
      setWalkPoints([]);
      setWalkEstimatedKm(0);
      setWalkStatus(
        isVerified
          ? `Verified by server. You earned ${awardedLeaves} Leaves for ${verifiedDistanceKm.toFixed(2)} km.`
          : 'Walk session stopped. No Leaves were awarded because the session did not meet verification rules.',
      );
      localStorage.setItem('ecoPoints', String(nextTotalPoints));
      localStorage.setItem('ecoActions', JSON.stringify(nextActions));
      localStorage.setItem('ecoGraphData', JSON.stringify(nextGraphData));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify walk.';
      setWalkError(message);
    } finally {
      setIsWalkStopping(false);
    }
  };

  const handleLogAction = (categoryId: string, title: string, points: number, amount: number) => {
    // Store previous state for potential rollback
    const previousActions = recentActions;
    const previousTotalPoints = totalPoints;
    const previousWaterSaved = waterSaved;
    const previousWasteReduced = wasteReduced;
    const previousGraphData = graphData;
    
    setLogActionError('');

    const newAction = {
      id: Date.now(),
      title,
      time: 'Just now',
      points,
      type: categoryId,
    };
    
    const updatedActions = [newAction, ...recentActions].slice(0, 20); 
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

    let nextGraphData = graphData;
    if (categoryId === 'transit') {
      const todayName = defaultGraphData[(new Date().getDay() + 6) % 7].name;
      const carbonSaved = Number((amount * IMPACT_FACTORS.CAR_EMISSIONS_KG_CO2_PER_KM).toFixed(1));
      nextGraphData = graphData.map((day) =>
        day.name === todayName
          ? { ...day, carbon: Number((day.carbon + carbonSaved).toFixed(1)) }
          : day,
      );
      setGraphData(nextGraphData);
    }

    localStorage.setItem('ecoActions', JSON.stringify(updatedActions));
    localStorage.setItem('ecoPoints', newTotalPoints.toString());
    localStorage.setItem('ecoWaterSaved', newWater.toString());
    localStorage.setItem('ecoWasteReduced', newWaste.toString());
    localStorage.setItem('ecoGraphData', JSON.stringify(nextGraphData));

    const syncMetrics = async () => {
      if (!user?.id || !API_BASE) return;

      try {
        const response = await fetch(`${API_BASE}/api/users/${user.id}/metrics/log-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId, amount }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string };
          const errorMessage = errorData?.message || 'Unable to log impact. Please check your input.';
          
          // Revert optimistic UI updates
          setRecentActions(previousActions);
          setTotalPoints(previousTotalPoints);
          setWaterSaved(previousWaterSaved);
          setWasteReduced(previousWasteReduced);
          setGraphData(previousGraphData);
          
          // Revert localStorage
          localStorage.setItem('ecoActions', JSON.stringify(previousActions));
          localStorage.setItem('ecoPoints', previousTotalPoints.toString());
          localStorage.setItem('ecoWaterSaved', previousWaterSaved.toString());
          localStorage.setItem('ecoWasteReduced', previousWasteReduced.toString());
          localStorage.setItem('ecoGraphData', JSON.stringify(previousGraphData));
          
          // Show error notification
          setLogActionError(errorMessage);
          alert(`⚠️ Daily Cap Exceeded\n\n${errorMessage}`);
          return;
        }
        
        const data = await response.json();
        if (typeof data?.waterSaved === 'number') {
          setWaterSaved(data.waterSaved);
          localStorage.setItem('ecoWaterSaved', String(data.waterSaved));
        }
        if (typeof data?.wasteReduced === 'number') {
          setWasteReduced(data.wasteReduced);
          localStorage.setItem('ecoWasteReduced', String(data.wasteReduced));
        }
        if (Array.isArray(data?.graphData)) {
          const normalized = normalizeGraphData(data.graphData);
          setGraphData(normalized);
          localStorage.setItem('ecoGraphData', JSON.stringify(normalized));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Network error while logging impact';
        setLogActionError(errorMsg);
        alert(`❌ Error\n\n${errorMsg}`);
      }
    };

    const syncAction = async () => {
      if (!API_BASE || !user?.id) return;

      try {
        const response = await fetch(`${API_BASE}/api/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, amount, type: categoryId, userId: user.id }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string };
          const errorMessage = errorData?.message || 'Unable to record action';

          // Revert optimistic UI updates if points are rejected by server
          setRecentActions(previousActions);
          setTotalPoints(previousTotalPoints);
          setWaterSaved(previousWaterSaved);
          setWasteReduced(previousWasteReduced);
          setGraphData(previousGraphData);
          localStorage.setItem('ecoActions', JSON.stringify(previousActions));
          localStorage.setItem('ecoPoints', previousTotalPoints.toString());
          localStorage.setItem('ecoWaterSaved', previousWaterSaved.toString());
          localStorage.setItem('ecoWasteReduced', previousWasteReduced.toString());
          localStorage.setItem('ecoGraphData', JSON.stringify(previousGraphData));

          setLogActionError(errorMessage);
          alert(`⚠️ Action Not Recorded\n\n${errorMessage}`);
          return false;
        }

        const actionData = (await response.json()) as { points?: number };
        if (typeof actionData?.points === 'number') {
          const serverPoints = actionData.points;
          const adjustedTotalPoints = previousTotalPoints + serverPoints;
          const adjustedActions = [
            {
              ...newAction,
              points: serverPoints,
            },
            ...previousActions,
          ].slice(0, 20);

          setTotalPoints(adjustedTotalPoints);
          setRecentActions(adjustedActions);
          localStorage.setItem('ecoPoints', adjustedTotalPoints.toString());
          localStorage.setItem('ecoActions', JSON.stringify(adjustedActions));
        }

        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Network error while recording action';
        setRecentActions(previousActions);
        setTotalPoints(previousTotalPoints);
        setWaterSaved(previousWaterSaved);
        setWasteReduced(previousWasteReduced);
        localStorage.setItem('ecoActions', JSON.stringify(previousActions));
        localStorage.setItem('ecoPoints', previousTotalPoints.toString());
        localStorage.setItem('ecoWaterSaved', previousWaterSaved.toString());
        localStorage.setItem('ecoWasteReduced', previousWasteReduced.toString());
        setLogActionError(errorMsg);
        alert(`❌ Error\n\n${errorMsg}`);
        return false;
      }
    };

    const syncAll = async () => {
      const actionSynced = await syncAction();
      if (!actionSynced) {
        return;
      }
      await syncMetrics();
    };

    void syncAll();
  };

  const handleWalkSessionAction = () => {
    if (isWalkStarting || isWalkStopping) {
      return;
    }

    if (walkSession) {
      void stopWalkSession();
      return;
    }

    void startWalkSession();
  };

  const rankImprovement = (resolvedCount * 2) + Math.floor(totalPoints / 50);
  const currentRank = Math.max(1, 15 - rankImprovement); 
  const rankTrend = Math.max(1, rankImprovement); 
  const visibleActions = showAllActions ? recentActions : recentActions.slice(0, 5);

  return (
    <div className="relative flex-1 h-screen overflow-y-auto bg-[#050505] text-zinc-50 selection:bg-emerald-500/30">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-12 pl-4 md:pl-[320px]">
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
              Start Walk
            </button>

            <button 
              onClick={() => setIsLoggingAction(true)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
            >
              <Plus size={20} />
              Log Impact
            </button>
            {logActionError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 p-3 bg-red-500/20 border border-red-500 text-red-200 rounded-lg text-sm"
              >
                ⚠️ {logActionError}
              </motion.div>
            )}
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
              <button
                onClick={() => setShowAllActions((current) => !current)}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {showAllActions ? 'Show Recent' : 'View All'}
              </button>
            </div>
            
            <div className="flex-1 relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/50 via-white/10 to-transparent"></div>
              
              <div className="space-y-8 relative z-10">
                {recentActions.length === 0 ? (
                  <p className="text-zinc-500 text-sm ml-8">No actions logged yet.</p>
                ) : (
                  visibleActions.map((action, i) => (
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
                        <span className={`text-sm font-bold px-2 py-1 rounded-md ${actionPointsClassName(action.points)}`}>
                          {formatActionPoints(action.points)}
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="md:col-span-12 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] p-8 backdrop-blur-2xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-400" /> My Reports
                </p>
                <h3 className="text-2xl font-bold text-white">Your recent submissions</h3>
              </div>
              <div className="text-sm text-zinc-400">
                {myReports.length === 0 ? 'No reports submitted yet' : `${myReports.length} report${myReports.length === 1 ? '' : 's'}`}
              </div>
            </div>

            {myReports.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-zinc-400">
                Your submitted reports will appear here once you create them.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {myReports.slice(0, 6).map((report) => {
                  const statusIsResolved = String(report.status || '').toLowerCase() === 'resolved';
                  return (
                    <div key={report.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{report.type || 'Civic Report'}</p>
                          <p className="text-xs text-zinc-500 mt-1">{report.location || 'Location unavailable'}</p>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusIsResolved ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                          {report.status || 'Open'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                        <span className="rounded-full border border-white/10 px-3 py-1">Issued: {formatReportIssuedAt(report)}</span>
                        {report.priority && <span className="rounded-full border border-white/10 px-3 py-1">Priority: {report.priority}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

        </div>
      </div>

      <LogActionModal 
        isOpen={isLoggingAction} 
        onClose={() => {
          setIsLoggingAction(false);
          setLogActionError('');
        }}
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
              <p className="text-zinc-400 mb-4 leading-relaxed">Walking instead of driving saves ~0.2kg of CO2 per kilometer. This mode verifies your movement with live GPS, then the server awards Leaves only after validation.</p>

              <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs uppercase tracking-wider text-emerald-400 mb-1">Session Status</p>
                <p className="text-sm text-zinc-200">{walkStatus}</p>
                {walkError && <p className="text-sm text-red-300 mt-2">{walkError}</p>}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2 ml-1">Which day did you walk?</label>
                  <select 
                    value={walkDay}
                    onChange={(e) => setWalkDay(e.target.value)}
                    disabled={Boolean(walkSession)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer disabled:opacity-60"
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

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-zinc-500 uppercase tracking-wider text-xs mb-1">Estimated Route</p>
                    <p className="text-white font-bold text-lg">{walkEstimatedKm.toFixed(2)} km</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-zinc-500 uppercase tracking-wider text-xs mb-1">GPS Samples</p>
                    <p className="text-white font-bold text-lg">{walkPoints.length + (walkSession ? 1 : 0)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                  <p className="font-medium text-white mb-1">Server checks</p>
                  <ul className="space-y-1 text-zinc-400 list-disc pl-5">
                    <li>Minimum walk duration: 5 minutes</li>
                    <li>Rejects impossible speed spikes and teleport jumps</li>
                    <li>Leaves are awarded only after server approval</li>
                  </ul>
                </div>

                <button 
                  type="button"
                  onClick={handleWalkSessionAction}
                  disabled={isWalkStarting || isWalkStopping}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-lg transition-colors mt-4 disabled:opacity-60"
                >
                  {walkSession
                    ? (isWalkStopping ? 'Stopping Session...' : 'Stop & Verify Walk')
                    : (isWalkStarting ? 'Starting Session...' : 'Start Walk Session')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}