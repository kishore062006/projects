import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import type { Request, Response } from 'express';

dotenv.config({ path: '.env.local' });
dotenv.config();

type ReportStatus = 'Open' | 'In Progress' | 'Resolved';

type Report = {
  id: string;
  type: string;
  location: string;
  address?: string;
  ownerUserId?: string;
  status: ReportStatus;
  priority: string;
  time: string;
  reporter: string;
  description: string;
  image: string | null;
  timestamp: string;
};

type Action = {
  id: number;
  title: string;
  time: string;
  points: number;
  type: string;
  userId?: string;
};

type UserDashboardState = {
  points: number;
  graphData: Array<{ name: string; carbon: number }>;
  actions: Action[];
};

type WalkPoint = {
  lat: number;
  lng: number;
  timestamp: string;
};

type WalkSession = {
  id: string;
  userId: string;
  day: string;
  startedAt: string;
  updatedAt: string;
  startPoint: WalkPoint;
  points: WalkPoint[];
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

type AdoptionZone = {
  id: string;
  name: string;
  type: 'park' | 'street' | 'lobby';
  lat: number;
  lng: number;
  radiusKm: number;
  adoptionCost: number;
};

type ZoneAdoption = {
  userId: string;
  zoneId: string;
  adoptedAt: string;
  lastPassiveAwardAt: string;
};

type Reward = {
  id: string;
  name: string;
  cost: number;
  description: string;
  available: boolean;
};

type ModuleItem = {
  id: string;
  title: string;
  description: string;
  category: string;
};

type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
};

type UserMetrics = {
  waterSaved: number;
  wasteReduced: number;
  updatedAt: string;
};

type AppState = {
  points: number;
  graphData: Array<{ name: string; carbon: number }>;
  actions: Action[];
  reports: Report[];
  rewards: Reward[];
  modules: ModuleItem[];
  users: User[];
  userMetrics: Record<string, UserMetrics>;
  userDashboards: Record<string, UserDashboardState>;
  adoptionZones: AdoptionZone[];
  zoneAdoptions: Record<string, ZoneAdoption>;
  walkSessions: Record<string, WalkSession>;
};

const LEADERSHIP_EMAILS = new Set(['main@gmail.com']);
const getRoleForEmail = (email: string): User['role'] =>
  LEADERSHIP_EMAILS.has(email.trim().toLowerCase()) ? 'admin' : 'user';

const defaultWeeklyGraphData: Array<{ name: string; carbon: number }> = [
  { name: 'Monday', carbon: 0 },
  { name: 'Tuesday', carbon: 0 },
  { name: 'Wednesday', carbon: 0 },
  { name: 'Thursday', carbon: 0 },
  { name: 'Friday', carbon: 0 },
  { name: 'Saturday', carbon: 0 },
  { name: 'Sunday', carbon: 0 },
];

type StateRow = {
  id: string;
  state: AppState;
  updated_at: string;
};

const STATE_ROW_ID = 'ecosync-app-state';
const MAX_STATE_WRITE_RETRIES = 5;

// Average-based impact factors sourced from official datasets.
// - US EPA: A faucet dripping once/second can waste ~3,000 gallons/year -> ~31 L/day.
// - World Bank (What a Waste 2.0): Global municipal solid waste avg ~0.74 kg/person/day.
const IMPACT_FACTORS = {
  CAR_EMISSIONS_KG_CO2_PER_KM: 0.251,
  WATER_SAVED_PER_REPORTED_LEAK_L: 31,
  WASTE_AVOIDED_PER_GROCERY_ACTION_KG: 0.74,
  WASTE_COLLECTED_PER_CLEANUP_HOUR_KG: 1.48,
} as const;

const REPORT_CATEGORIES = [
  'Water Leakage (SDG 6)',
  'Illegal Dumping (SDG 11)',
  'Polluted Water Body (SDG 6)',
  'Damaged Green Infrastructure (SDG 13)',
] as const;

const PASSIVE_POINTS_PER_HOUR = 20;
const PASSIVE_AWARD_WINDOW_MS = 15 * 60 * 1000;
const WALK_MIN_DURATION_MS = 5 * 60 * 1000;
const WALK_MAX_SPEED_KMH = 12;
const WALK_MIN_DISTANCE_KM = 0.15;
const WALK_POINTS_PER_KM = 5;

// Server-side action points (clients cannot specify points directly)
const VALID_ACTIONS: Record<string, number> = {
  'saved-energy': 25,
  'recycled': 15,
  'used-transit': 20,
  'carpooled': 30,
  'planted-tree': 40,
  'participated-cleanup': 35,
};

// Daily caps per impact category to prevent farming
const IMPACT_CATEGORY_DAILY_CAPS: Record<string, number> = {
  'water_leak': 5,
  'groceries': 10,
  'cleanup': 3,
};

// Report limits
const REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 report per day
const REPORT_REWARD_POINTS = 10; // Reduced from 50 to prevent farming

const defaultAdoptionZones: AdoptionZone[] = [
  {
    id: 'zone-lalbagh',
    name: 'Lalbagh Botanical Garden Perimeter',
    type: 'park',
    lat: 12.9507,
    lng: 77.5848,
    radiusKm: 0.7,
    adoptionCost: 600,
  },
  {
    id: 'zone-cubbon',
    name: 'Cubbon Park Belt',
    type: 'park',
    lat: 12.9763,
    lng: 77.5929,
    radiusKm: 0.65,
    adoptionCost: 650,
  },
  {
    id: 'zone-mg-road',
    name: 'MG Road Civic Stretch',
    type: 'street',
    lat: 12.9756,
    lng: 77.6066,
    radiusKm: 0.5,
    adoptionCost: 550,
  },
  {
    id: 'zone-indiranagar',
    name: 'Indiranagar 100 Ft Road Block',
    type: 'street',
    lat: 12.9719,
    lng: 77.6412,
    radiusKm: 0.45,
    adoptionCost: 500,
  },
  {
    id: 'zone-ubcity',
    name: 'UB City Lobby & Access Zone',
    type: 'lobby',
    lat: 12.9718,
    lng: 77.5950,
    radiusKm: 0.3,
    adoptionCost: 450,
  },
] as const;

type ReportCategory = (typeof REPORT_CATEGORIES)[number];

const extractDataUrlPayload = (value: string) => {
  const match = value.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64Data: match[2],
  };
};

const parseModelJson = (raw: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const fallbackMatch = raw.match(/\{[\s\S]*\}/);
    if (!fallbackMatch) {
      return null;
    }

    try {
      return JSON.parse(fallbackMatch[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
};

const parseCoordinates = (value: string): [number, number] | null => {
  const parts = String(value || '')
    .split(',')
    .map((part) => part.trim());

  if (parts.length !== 2) {
    return null;
  }

  const parsePart = (part: string) => {
    const numeric = Number.parseFloat(part.replace(/[^\d.-]/g, ''));
    if (Number.isNaN(numeric)) {
      return null;
    }

    if (/[sSwW]/.test(part)) {
      return -Math.abs(numeric);
    }
    if (/[nNeE]/.test(part)) {
      return Math.abs(numeric);
    }
    return numeric;
  };

  const lat = parsePart(parts[0]);
  const lng = parsePart(parts[1]);
  if (lat === null || lng === null) {
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return [lat, lng];
};

const areSameCoordinates = (a: [number, number], b: [number, number]) => {
  const precisionThreshold = 0.0001;
  return Math.abs(a[0] - b[0]) <= precisionThreshold && Math.abs(a[1] - b[1]) <= precisionThreshold;
};

const haversineKm = (a: [number, number], b: [number, number]) => {
  const radiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * radiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const calculateRouteMetrics = (points: WalkPoint[]) => {
  const orderedPoints = [...points].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let distanceKm = 0;
  let maxSpeedKmh = 0;
  let minSegmentSeconds = Number.POSITIVE_INFINITY;

  for (let index = 1; index < orderedPoints.length; index += 1) {
    const previousPoint = orderedPoints[index - 1];
    const nextPoint = orderedPoints[index];
    const previousTime = new Date(previousPoint.timestamp).getTime();
    const nextTime = new Date(nextPoint.timestamp).getTime();
    const elapsedMs = nextTime - previousTime;
    if (elapsedMs <= 0) {
      throw new Error('INVALID_ROUTE_TIMESTAMPS');
    }

    const segmentDistance = haversineKm([previousPoint.lat, previousPoint.lng], [nextPoint.lat, nextPoint.lng]);
    const segmentHours = elapsedMs / (1000 * 60 * 60);
    const segmentSpeed = segmentHours > 0 ? segmentDistance / segmentHours : Number.POSITIVE_INFINITY;
    const segmentSeconds = elapsedMs / 1000;

    distanceKm += segmentDistance;
    maxSpeedKmh = Math.max(maxSpeedKmh, segmentSpeed);
    minSegmentSeconds = Math.min(minSegmentSeconds, segmentSeconds);
  }

  return { distanceKm, maxSpeedKmh, minSegmentSeconds, orderedPoints };
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceKm = (a: [number, number], b: [number, number]) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusKm * centralAngle;
};

const getOpenIssueCountInZone = (state: AppState, zone: AdoptionZone) =>
  state.reports.filter((report) => {
    if (report.status === 'Resolved') {
      return false;
    }
    const reportCoords = parseCoordinates(report.location);
    if (!reportCoords) {
      return false;
    }
    return distanceKm([zone.lat, zone.lng], reportCoords) <= zone.radiusKm;
  }).length;

const defaultState: AppState = {
  points: 0,
  graphData: defaultWeeklyGraphData.map((item) => ({ ...item })),
  actions: [],
  reports: [],
  rewards: [],
  modules: [],
  users: [],
  userMetrics: {},
  userDashboards: {},
  adoptionZones: defaultAdoptionZones.map((zone) => ({ ...zone })),
  zoneAdoptions: {},
  walkSessions: {},
};

const cloneState = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeState = (state?: Partial<AppState> | null): AppState => ({
  points: state?.points ?? defaultState.points,
  graphData:
    state?.graphData && state.graphData.length > 0
      ? state.graphData
      : cloneState(defaultState.graphData),
  actions: state?.actions ?? cloneState(defaultState.actions),
  reports: state?.reports ?? cloneState(defaultState.reports),
  rewards: state?.rewards ?? cloneState(defaultState.rewards),
  modules: state?.modules ?? cloneState(defaultState.modules),
  users: state?.users ?? cloneState(defaultState.users),
  userMetrics: state?.userMetrics ?? cloneState(defaultState.userMetrics),
  userDashboards: state?.userDashboards ?? cloneState(defaultState.userDashboards),
  adoptionZones:
    state?.adoptionZones && state.adoptionZones.length > 0
      ? state.adoptionZones
      : cloneState(defaultState.adoptionZones),
  zoneAdoptions: state?.zoneAdoptions ?? cloneState(defaultState.zoneAdoptions),
  walkSessions: state?.walkSessions ?? cloneState(defaultState.walkSessions),
});

const createDefaultUserDashboard = (): UserDashboardState => ({
  points: 0,
  graphData: defaultWeeklyGraphData.map((item) => ({ ...item })),
  actions: [],
});

const getOrCreateUserDashboard = (state: AppState, userId: string): UserDashboardState =>
  state.userDashboards[userId] ?? createDefaultUserDashboard();

const getWalkSessionSummary = (session: WalkSession): WalkSessionSummary => ({
  sessionId: session.id,
  userId: session.userId,
  day: session.day,
  startedAt: session.startedAt,
  updatedAt: session.updatedAt,
  startPoint: session.startPoint,
  sampleCount: 1 + session.points.length,
});

async function startServer() {
  const expressModule = await import('express');
  const express = (expressModule as any).default ?? expressModule;

  const app = express();
  const PORT = Number(process.env.PORT || 4001);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set before starting the backend.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const crypto = await import('crypto');
  const hashPassword = (password: string) => crypto.createHash('sha256').update(password).digest('hex');
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || '';
  const geminiClient = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

  const readStateSnapshot = async (): Promise<StateRow> => {
    const { data, error } = await supabase.from('app_state').select('state,updated_at').eq('id', STATE_ROW_ID).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      const initialState = normalizeState();
      const updatedAt = new Date().toISOString();
      const { error: insertError } = await supabase
        .from('app_state')
        .upsert({ id: STATE_ROW_ID, state: initialState, updated_at: updatedAt } as StateRow);

      if (insertError) {
        throw insertError;
      }

      return { id: STATE_ROW_ID, state: cloneState(initialState), updated_at: updatedAt };
    }

    return {
      id: STATE_ROW_ID,
      state: normalizeState(data.state as Partial<AppState>),
      updated_at: data.updated_at || new Date().toISOString(),
    };
  };

  const readState = async (): Promise<AppState> => {
    const snapshot = await readStateSnapshot();
    return cloneState(snapshot.state);
  };

  const mutateState = async <T,>(
    mutator: (state: AppState) => { nextState: AppState; result: T },
  ): Promise<T> => {
    for (let attempt = 0; attempt < MAX_STATE_WRITE_RETRIES; attempt += 1) {
      const snapshot = await readStateSnapshot();
      const { nextState, result } = mutator(cloneState(snapshot.state));
      const nextUpdatedAt = new Date().toISOString();

      const { data, error } = await supabase
        .from('app_state')
        .update({ state: nextState, updated_at: nextUpdatedAt })
        .eq('id', STATE_ROW_ID)
        .eq('updated_at', snapshot.updated_at)
        .select('id')
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        return result;
      }
    }

    throw new Error('Could not persist state due to concurrent updates. Please retry.');
  };

  const handleStorageError = (res: Response, error: unknown) => {
    console.error('Supabase storage error:', error);
    res.status(500).json({ message: 'Database operation failed.' });
  };

  function corsMiddleware(req: Request, res: Response, next: () => void) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(corsMiddleware);

  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/modules', async (_req: Request, res: Response) => {
    try {
      const state = await readState();
      res.json(state.modules);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.get('/api/rewards', async (_req: Request, res: Response) => {
    try {
      const state = await readState();
      res.json(state.rewards);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.get('/api/actions', async (_req: Request, res: Response) => {
    const userId = String(_req.query.userId || '').trim();
    try {
      const state = await readState();
      if (!userId) {
        return res.json([]);
      }
      const dashboard = getOrCreateUserDashboard(state, userId);
      res.json(dashboard.actions.slice(0, 20));
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.get('/api/users/:userId/metrics', async (req: Request, res: Response) => {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    try {
      const state = await readState();
      const metrics = state.userMetrics[userId] ?? {
        waterSaved: 0,
        wasteReduced: 0,
        updatedAt: new Date(0).toISOString(),
      };

      res.json(metrics);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/users/:userId/metrics/log-action', async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { categoryId, amount } = req.body;

    if (!userId || !categoryId || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'Valid userId, categoryId, and amount are required.' });
    }

    // Validate amount against daily cap
    const dailyCap = IMPACT_CATEGORY_DAILY_CAPS[categoryId as keyof typeof IMPACT_CATEGORY_DAILY_CAPS];
    if (!dailyCap) {
      return res.status(400).json({ message: `Invalid category '${categoryId}'. Valid categories: ${Object.keys(IMPACT_CATEGORY_DAILY_CAPS).join(', ')}` });
    }

    if (amount > dailyCap) {
      return res.status(429).json({ message: `Daily cap for '${categoryId}' is ${dailyCap}. You requested ${amount}.` });
    }

    try {
      const metrics = await mutateState((state) => {
        const existing = state.userMetrics[userId] ?? {
          waterSaved: 0,
          wasteReduced: 0,
          updatedAt: new Date(0).toISOString(),
        };

        // Check daily cap by counting logs from today
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = (state.actions || [])
          .filter((action) => action.userId === userId && action.type === `impact-log-${categoryId}`)
          .filter((action) => action.time.includes(today))
          .length;

        if (todayLogs >= dailyCap) {
          throw new Error(`DAILY_CAP_EXCEEDED_${categoryId}`);
        }

        let nextWaterSaved = existing.waterSaved;
        let nextWasteReduced = existing.wasteReduced;

        if (categoryId === 'water_leak') {
          nextWaterSaved += amount * IMPACT_FACTORS.WATER_SAVED_PER_REPORTED_LEAK_L;
        }
        if (categoryId === 'groceries') {
          nextWasteReduced += amount * IMPACT_FACTORS.WASTE_AVOIDED_PER_GROCERY_ACTION_KG;
        }
        if (categoryId === 'cleanup') {
          nextWasteReduced += amount * IMPACT_FACTORS.WASTE_COLLECTED_PER_CLEANUP_HOUR_KG;
        }

        nextWaterSaved = Number(nextWaterSaved.toFixed(1));
        nextWasteReduced = Number(nextWasteReduced.toFixed(1));

        const nextMetrics: UserMetrics = {
          waterSaved: nextWaterSaved,
          wasteReduced: nextWasteReduced,
          updatedAt: new Date().toISOString(),
        };

        return {
          nextState: {
            ...state,
            userMetrics: {
              ...state.userMetrics,
              [userId]: nextMetrics,
            },
          },
          result: nextMetrics,
        };
      });

      res.json(metrics);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('DAILY_CAP_EXCEEDED_')) {
        const category = error.message.replace('DAILY_CAP_EXCEEDED_', '');
        const cap = IMPACT_CATEGORY_DAILY_CAPS[category as keyof typeof IMPACT_CATEGORY_DAILY_CAPS];
        return res.status(429).json({ message: `Daily cap of ${cap} reached for '${category}'. Try again tomorrow.` });
      }
      handleStorageError(res, error);
    }
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    try {
      const normalizedEmail = String(email).trim().toLowerCase();
      const passwordHash = hashPassword(String(password));

      const user: User = {
        id: `USR-${Date.now()}`,
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
        role: getRoleForEmail(normalizedEmail),
      };

      await mutateState((state) => {
        if (state.users.some((existingUser) => existingUser.email === normalizedEmail)) {
          throw new Error('EMAIL_ALREADY_EXISTS');
        }

        return {
          nextState: {
            ...state,
            users: [...state.users, user],
          },
          result: null,
        };
      });

      res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (error) {
      if (error instanceof Error && error.message === 'EMAIL_ALREADY_EXISTS') {
        return res.status(400).json({ message: 'Email already in use.' });
      }
      handleStorageError(res, error);
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
      const state = await readState();
      const normalizedEmail = String(email).trim().toLowerCase();
      const passwordHash = hashPassword(String(password));
      const user = state.users.find((item) => item.email === normalizedEmail);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      if (user.passwordHash !== passwordHash) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const effectiveRole = getRoleForEmail(user.email);
      res.json({ id: user.id, name: user.name, email: user.email, role: effectiveRole });
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/actions', async (req: Request, res: Response) => {
    const { title, type, userId } = req.body;
    if (!title || !type || !userId) {
      return res.status(400).json({ message: 'Invalid action payload. userId, title, and type are required.' });
    }

    // Server-side point validation - clients cannot specify arbitrary points
    const actionType = String(type).toLowerCase().trim();
    const serverPoints = VALID_ACTIONS[actionType];
    if (typeof serverPoints !== 'number') {
      return res.status(400).json({ message: `Invalid action type "${actionType}". Valid types: ${Object.keys(VALID_ACTIONS).join(', ')}` });
    }

    try {
      const action: Action = {
        id: Date.now(),
        title,
        time: 'Just now',
        points: serverPoints,
        type: actionType,
        userId: String(userId),
      };

      await mutateState((state) => {
        const targetUserId = String(userId);
        const dashboard = getOrCreateUserDashboard(state, targetUserId);
        const nextDashboard: UserDashboardState = {
          ...dashboard,
          points: dashboard.points + serverPoints,
          actions: [action, ...dashboard.actions],
        };

        return {
          nextState: {
            ...state,
            userDashboards: {
              ...state.userDashboards,
              [targetUserId]: nextDashboard,
            },
          },
          result: null,
        };
      });

      res.status(201).json(action);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/walk-sessions/start', async (req: Request, res: Response) => {
    const { userId, day, startPoint } = req.body as {
      userId?: string;
      day?: string;
      startPoint?: WalkPoint;
    };

    if (!userId || !day || !startPoint || typeof startPoint.lat !== 'number' || typeof startPoint.lng !== 'number') {
      return res.status(400).json({ message: 'userId, day, and startPoint are required.' });
    }

    try {
      const session = await mutateState((state) => {
        const targetUserId = String(userId).trim();
        const existing = state.walkSessions[targetUserId];
        if (existing) {
          throw new Error('SESSION_ALREADY_ACTIVE');
        }

        const nowIso = new Date().toISOString();
        const nextSession: WalkSession = {
          id: `WALK-${Date.now()}`,
          userId: targetUserId,
          day: String(day),
          startedAt: nowIso,
          updatedAt: nowIso,
          startPoint: {
            lat: Number(startPoint.lat),
            lng: Number(startPoint.lng),
            timestamp: startPoint.timestamp ? String(startPoint.timestamp) : nowIso,
          },
          points: [],
        };

        return {
          nextState: {
            ...state,
            walkSessions: {
              ...state.walkSessions,
              [targetUserId]: nextSession,
            },
          },
          result: getWalkSessionSummary(nextSession),
        };
      });

      res.status(201).json(session);
    } catch (error) {
      if (error instanceof Error && error.message === 'SESSION_ALREADY_ACTIVE') {
        return res.status(409).json({ message: 'A walk session is already active for this user.' });
      }
      handleStorageError(res, error);
    }
  });

  app.post('/api/walk-sessions/track', async (req: Request, res: Response) => {
    const { userId, point } = req.body as { userId?: string; point?: WalkPoint };
    if (!userId || !point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
      return res.status(400).json({ message: 'userId and point are required.' });
    }

    try {
      const session = await mutateState((state) => {
        const targetUserId = String(userId).trim();
        const current = state.walkSessions[targetUserId];
        if (!current) {
          throw new Error('SESSION_NOT_FOUND');
        }

        const lastPoint = current.points[current.points.length - 1] ?? current.startPoint;
        const nextPoint: WalkPoint = {
          lat: Number(point.lat),
          lng: Number(point.lng),
          timestamp: point.timestamp ? String(point.timestamp) : new Date().toISOString(),
        };

        const segmentDistance = haversineKm([lastPoint.lat, lastPoint.lng], [nextPoint.lat, nextPoint.lng]);
        const elapsedMs = new Date(nextPoint.timestamp).getTime() - new Date(lastPoint.timestamp).getTime();
        if (elapsedMs <= 0) {
          throw new Error('INVALID_TIMING');
        }

        const segmentHours = elapsedMs / (1000 * 60 * 60);
        const speedKmh = segmentDistance / segmentHours;
        if (segmentDistance > 0.4 || speedKmh > WALK_MAX_SPEED_KMH) {
          throw new Error('IMPOSSIBLE_MOVEMENT');
        }

        const nextSession: WalkSession = {
          ...current,
          updatedAt: nextPoint.timestamp,
          points: [...current.points, nextPoint],
        };

        return {
          nextState: {
            ...state,
            walkSessions: {
              ...state.walkSessions,
              [targetUserId]: nextSession,
            },
          },
          result: getWalkSessionSummary(nextSession),
        };
      });

      res.json(session);
    } catch (error) {
      if (error instanceof Error && error.message === 'SESSION_NOT_FOUND') {
        return res.status(404).json({ message: 'No active walk session found.' });
      }
      if (error instanceof Error && error.message === 'INVALID_TIMING') {
        return res.status(400).json({ message: 'Invalid point timing.' });
      }
      if (error instanceof Error && error.message === 'IMPOSSIBLE_MOVEMENT') {
        return res.status(400).json({ message: 'Movement looks invalid. Please walk naturally and keep GPS on.' });
      }
      handleStorageError(res, error);
    }
  });

  app.post('/api/walk-sessions/stop', async (req: Request, res: Response) => {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    try {
      const result = await mutateState((state) => {
        const targetUserId = String(userId).trim();
        const session = state.walkSessions[targetUserId];
        if (!session) {
          throw new Error('SESSION_NOT_FOUND');
        }

        const nowIso = new Date().toISOString();
        const allPoints = [session.startPoint, ...session.points];
        if (allPoints.length < 2) {
          throw new Error('NOT_ENOUGH_DATA');
        }

        const startTime = new Date(session.startedAt).getTime();
        const endTime = new Date(nowIso).getTime();
        const durationMs = endTime - startTime;
        if (durationMs < WALK_MIN_DURATION_MS) {
          throw new Error('WALK_TOO_SHORT');
        }

        const metrics = calculateRouteMetrics(allPoints);
        if (metrics.distanceKm < WALK_MIN_DISTANCE_KM) {
          throw new Error('WALK_TOO_SHORT');
        }
        if (metrics.maxSpeedKmh > WALK_MAX_SPEED_KMH) {
          throw new Error('IMPOSSIBLE_MOVEMENT');
        }

        const awardedLeaves = Math.max(1, Math.floor(metrics.distanceKm * WALK_POINTS_PER_KM));
        const carbonSaved = Number((metrics.distanceKm * IMPACT_FACTORS.CAR_EMISSIONS_KG_CO2_PER_KM).toFixed(1));
        const dashboard = getOrCreateUserDashboard(state, targetUserId);
        const nextDashboard: UserDashboardState = {
          ...dashboard,
          points: dashboard.points + awardedLeaves,
          actions: [
            {
              id: Date.now() + 5,
              title: `Verified walk: ${metrics.distanceKm.toFixed(2)} km`,
              time: 'Just now',
              points: awardedLeaves,
              type: 'verified-walk',
              userId: targetUserId,
            },
            ...dashboard.actions,
          ],
          graphData: dashboard.graphData.map((entry) =>
            entry.name === session.day
              ? { ...entry, carbon: Number((entry.carbon + carbonSaved).toFixed(1)) }
              : entry,
          ),
        };

        const nextWalkSessions = { ...state.walkSessions };
        delete nextWalkSessions[targetUserId];

        return {
          nextState: {
            ...state,
            walkSessions: nextWalkSessions,
            userDashboards: {
              ...state.userDashboards,
              [targetUserId]: nextDashboard,
            },
          },
          result: {
            sessionId: session.id,
            distanceKm: Number(metrics.distanceKm.toFixed(2)),
            awardedLeaves,
            carbonSaved,
            day: session.day,
            durationMinutes: Number((durationMs / 60000).toFixed(1)),
            aura: 'green',
          },
        };
      });

      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'SESSION_NOT_FOUND') {
        return res.status(404).json({ message: 'No active walk session found.' });
      }
      if (error instanceof Error && error.message === 'NOT_ENOUGH_DATA') {
        return res.status(400).json({ message: 'Not enough GPS data captured.' });
      }
      if (error instanceof Error && error.message === 'WALK_TOO_SHORT') {
        return res.status(400).json({ message: 'Walk too short to verify. Please walk for at least 5 minutes.' });
      }
      if (error instanceof Error && error.message === 'IMPOSSIBLE_MOVEMENT') {
        return res.status(400).json({ message: 'Movement looks invalid. Please walk naturally and keep GPS on.' });
      }
      handleStorageError(res, error);
    }
  });

  app.get('/api/walk-sessions/status', async (req: Request, res: Response) => {
    const userId = String(req.query.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    try {
      const state = await readState();
      const session = state.walkSessions[userId];
      if (!session) {
        return res.json({ active: false });
      }

      const metrics = calculateRouteMetrics([session.startPoint, ...session.points]);
      res.json({
        active: true,
        ...getWalkSessionSummary(session),
        trackedDistanceKm: Number(metrics.distanceKm.toFixed(2)),
      });
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.get('/api/reports', async (req: Request, res: Response) => {
    const requesterUserId = String(req.query.userId || '').trim();
    const requesterRole = String(req.query.role || '').trim().toLowerCase();
    try {
      const state = await readState();
      if (requesterRole === 'admin') {
        return res.json(state.reports);
      }

      if (!requesterUserId) {
        return res.json([]);
      }

      const filteredReports = state.reports.filter((report) => String(report.ownerUserId || '') === requesterUserId);
      res.json(filteredReports);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/reports', async (req: Request, res: Response) => {
    const { type, location, address, priority, reporter, description, image, userId } = req.body;
    if (!type || !location || !reporter || !description || !userId || !image) {
      return res.status(400).json({ message: 'Missing required report fields. Photo/image evidence is required.' });
    }

    try {
      const targetUserId = String(userId);
      const id = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
      const report: Report = {
        id,
        type,
        location,
        address: address ? String(address).trim() : '',
        ownerUserId: targetUserId,
        priority: priority || 'High',
        status: 'Open',
        time: 'Just now',
        reporter,
        description,
        image: image || null,
        timestamp: new Date().toISOString(),
      };

      await mutateState((state) => {
        const dashboard = getOrCreateUserDashboard(state, targetUserId);

        // Check for report cooldown - user can only report once per 24 hours
        const oneDayAgo = new Date(Date.now() - REPORT_COOLDOWN_MS).toISOString();
        const userRecentReports = state.reports.filter(
          (r) => String(r.ownerUserId || '') === targetUserId && r.timestamp > oneDayAgo
        );

        if (userRecentReports.length > 0) {
          throw new Error('REPORT_COOLDOWN_ACTIVE');
        }

        // Check for duplicate location
        const nextCoords = parseCoordinates(report.location);
        if (nextCoords) {
          const hasDuplicate = state.reports.some((existingReport) => {
            if (String(existingReport.ownerUserId || '') !== targetUserId) {
              return false;
            }
            const existingCoords = parseCoordinates(existingReport.location);
            if (!existingCoords) {
              return false;
            }
            return areSameCoordinates(existingCoords, nextCoords);
          });

          if (hasDuplicate) {
            throw new Error('DUPLICATE_LOCATION');
          }
        }

        return {
          nextState: {
            ...state,
            reports: [report, ...state.reports],
            userDashboards: {
              ...state.userDashboards,
              [targetUserId]: {
                ...dashboard,
                points: dashboard.points + REPORT_REWARD_POINTS,
                actions: [
                  {
                    id: Date.now() + 1,
                    title: `Reported ${type}`,
                    time: 'Just now',
                    points: REPORT_REWARD_POINTS,
                    type: 'report',
                    userId: targetUserId,
                  },
                  ...dashboard.actions,
                ],
              },
            },
          },
          result: null,
        };
      });

      res.status(201).json(report);
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_LOCATION') {
        return res.status(409).json({ message: 'This location has already been reported. Please ignore duplicate submissions.' });
      }
      if (error instanceof Error && error.message === 'REPORT_COOLDOWN_ACTIVE') {
        return res.status(429).json({ message: 'You can only submit one report per 24 hours. Please try again tomorrow.' });
      }
      handleStorageError(res, error);
    }
  });

  app.get('/api/adopt-zones', async (req: Request, res: Response) => {
    const requesterUserId = String(req.query.userId || '').trim();
    try {
      const state = await readState();
      const zones = state.adoptionZones.map((zone) => {
        const openIssueCount = getOpenIssueCountInZone(state, zone);
        const adoptedByUserId = Object.values(state.zoneAdoptions).find((adoption) => adoption.zoneId === zone.id)?.userId || null;
        return {
          ...zone,
          openIssueCount,
          health: openIssueCount === 0 ? 'healthy' : 'alert',
          adoptedByUserId,
          isOwnedByCurrentUser: requesterUserId ? adoptedByUserId === requesterUserId : false,
        };
      });

      res.json(zones);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/adoptions/adopt', async (req: Request, res: Response) => {
    const { userId, zoneId } = req.body;
    if (!userId || !zoneId) {
      return res.status(400).json({ message: 'userId and zoneId are required.' });
    }

    const targetUserId = String(userId).trim();
    const targetZoneId = String(zoneId).trim();

    try {
      const result = await mutateState((state) => {
        const zone = state.adoptionZones.find((item) => item.id === targetZoneId);
        if (!zone) {
          throw new Error('ZONE_NOT_FOUND');
        }

        const existingForUser = state.zoneAdoptions[targetUserId];
        if (existingForUser) {
          throw new Error('ALREADY_HAS_ZONE');
        }

        const existingOwner = Object.values(state.zoneAdoptions).find((adoption) => adoption.zoneId === targetZoneId);
        if (existingOwner) {
          throw new Error('ZONE_ALREADY_TAKEN');
        }

        const dashboard = getOrCreateUserDashboard(state, targetUserId);
        if (dashboard.points < zone.adoptionCost) {
          throw new Error('INSUFFICIENT_POINTS');
        }

        const nowIso = new Date().toISOString();
        const nextDashboard: UserDashboardState = {
          ...dashboard,
          points: dashboard.points - zone.adoptionCost,
          actions: [
            {
              id: Date.now() + 3,
              title: `Adopted ${zone.name}`,
              time: 'Just now',
              points: -zone.adoptionCost,
              type: 'adoption',
              userId: targetUserId,
            },
            ...dashboard.actions,
          ],
        };

        return {
          nextState: {
            ...state,
            userDashboards: {
              ...state.userDashboards,
              [targetUserId]: nextDashboard,
            },
            zoneAdoptions: {
              ...state.zoneAdoptions,
              [targetUserId]: {
                userId: targetUserId,
                zoneId: targetZoneId,
                adoptedAt: nowIso,
                lastPassiveAwardAt: nowIso,
              },
            },
          },
          result: {
            zone,
            balance: nextDashboard.points,
          },
        };
      });

      res.json({ message: 'Zone adopted successfully.', ...result });
    } catch (error) {
      if (error instanceof Error && error.message === 'ZONE_NOT_FOUND') {
        return res.status(404).json({ message: 'Selected zone does not exist.' });
      }
      if (error instanceof Error && error.message === 'ZONE_ALREADY_TAKEN') {
        return res.status(409).json({ message: 'This zone is already adopted by another user.' });
      }
      if (error instanceof Error && error.message === 'ALREADY_HAS_ZONE') {
        return res.status(400).json({ message: 'You already adopted a zone. Release it first.' });
      }
      if (error instanceof Error && error.message === 'INSUFFICIENT_POINTS') {
        return res.status(400).json({ message: 'Not enough Leaves to adopt this zone.' });
      }
      handleStorageError(res, error);
    }
  });

  app.post('/api/adoptions/release', async (req: Request, res: Response) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    const targetUserId = String(userId).trim();
    try {
      await mutateState((state) => {
        if (!state.zoneAdoptions[targetUserId]) {
          throw new Error('NO_ADOPTION');
        }

        const nextZoneAdoptions = { ...state.zoneAdoptions };
        delete nextZoneAdoptions[targetUserId];

        return {
          nextState: {
            ...state,
            zoneAdoptions: nextZoneAdoptions,
          },
          result: null,
        };
      });

      res.json({ message: 'Adoption released.' });
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_ADOPTION') {
        return res.status(404).json({ message: 'No adopted zone found for user.' });
      }
      handleStorageError(res, error);
    }
  });

  app.get('/api/adoptions/status', async (req: Request, res: Response) => {
    const userId = String(req.query.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    try {
      type AdoptionStatusPayload = {
        hasAdoption: boolean;
        aura: 'none' | 'green' | 'red';
        balance: number;
        passivePointsAwarded: number;
        openIssueCount: number;
        zone: AdoptionZone | null;
        adoptedAt: string | null;
        passiveRatePerHour: number;
      };

      const status = await mutateState<AdoptionStatusPayload>((state) => {
        const adoption = state.zoneAdoptions[userId];
        const dashboard = getOrCreateUserDashboard(state, userId);
        if (!adoption) {
          return {
            nextState: state,
            result: {
              hasAdoption: false,
              aura: 'none',
              balance: dashboard.points,
              passivePointsAwarded: 0,
              openIssueCount: 0,
              zone: null,
              adoptedAt: null,
              passiveRatePerHour: PASSIVE_POINTS_PER_HOUR,
            },
          };
        }

        const zone = state.adoptionZones.find((item) => item.id === adoption.zoneId);
        if (!zone) {
          const nextZoneAdoptions = { ...state.zoneAdoptions };
          delete nextZoneAdoptions[userId];
          return {
            nextState: {
              ...state,
              zoneAdoptions: nextZoneAdoptions,
            },
            result: {
              hasAdoption: false,
              aura: 'none',
              balance: dashboard.points,
              passivePointsAwarded: 0,
              openIssueCount: 0,
              zone: null,
              adoptedAt: null,
              passiveRatePerHour: PASSIVE_POINTS_PER_HOUR,
            },
          };
        }

        const openIssueCount = getOpenIssueCountInZone(state, zone);
        const isHealthy = openIssueCount === 0;
        let passivePointsAwarded = 0;
        let nextAdoption = adoption;
        let nextDashboard = dashboard;

        if (isHealthy) {
          const now = Date.now();
          const lastAward = new Date(adoption.lastPassiveAwardAt).getTime();
          const elapsedMs = Math.max(0, now - (Number.isNaN(lastAward) ? now : lastAward));
          const windows = Math.floor(elapsedMs / PASSIVE_AWARD_WINDOW_MS);
          if (windows > 0) {
            passivePointsAwarded = Math.floor((PASSIVE_POINTS_PER_HOUR / 4) * windows);
            nextAdoption = {
              ...adoption,
              lastPassiveAwardAt: new Date((Number.isNaN(lastAward) ? now : lastAward) + windows * PASSIVE_AWARD_WINDOW_MS).toISOString(),
            };

            if (passivePointsAwarded > 0) {
              nextDashboard = {
                ...dashboard,
                points: dashboard.points + passivePointsAwarded,
                actions: [
                  {
                    id: Date.now() + 4,
                    title: `Passive points from ${zone.name}`,
                    time: 'Just now',
                    points: passivePointsAwarded,
                    type: 'adoption-passive',
                    userId,
                  },
                  ...dashboard.actions,
                ],
              };
            }
          }
        }

        return {
          nextState: {
            ...state,
            zoneAdoptions: {
              ...state.zoneAdoptions,
              [userId]: nextAdoption,
            },
            userDashboards: {
              ...state.userDashboards,
              [userId]: nextDashboard,
            },
          },
          result: {
            hasAdoption: true,
            aura: isHealthy ? 'green' : 'red',
            balance: nextDashboard.points,
            passivePointsAwarded,
            openIssueCount,
            zone,
            adoptedAt: adoption.adoptedAt,
            passiveRatePerHour: PASSIVE_POINTS_PER_HOUR,
          },
        };
      });

      res.json(status);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/ai/report-analysis', async (req: Request, res: Response) => {
    const { imageDataUrl } = req.body as { imageDataUrl?: string };
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return res.status(400).json({ message: 'imageDataUrl is required.' });
    }

    const imagePayload = extractDataUrlPayload(imageDataUrl);
    if (!imagePayload) {
      return res.status(400).json({ message: 'Invalid image data format. Use a base64 data URL.' });
    }

    if (!geminiClient) {
      return res.status(503).json({ message: 'Gemini API key is not configured on the backend.' });
    }

    const prompt = [
      'You are classifying a civic/environmental issue from an image.',
      'Describe what is visibly in the image and provide useful report-ready context.',
      `Choose one category only from: ${REPORT_CATEGORIES.join(', ')}.`,
      'Return strict JSON only with keys: category, description, additionalDetails.',
      'description must be 1-2 concise sentences for a municipal issue report.',
      'additionalDetails must add 1-3 concise sentences with visible clues, likely cause, and urgency.',
    ].join(' ');

    try {
      const response = await geminiClient.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imagePayload.mimeType,
                  data: imagePayload.base64Data,
                },
              },
            ],
          },
        ],
      });

      const modelOutput = response.text?.trim() || '{}';
      const parsed = parseModelJson(modelOutput);
      if (!parsed) {
        return res.status(502).json({ message: 'Gemini returned an invalid response format.' });
      }

      const rawCategory = String(parsed.category || '').trim() as ReportCategory;
      const category = REPORT_CATEGORIES.includes(rawCategory)
        ? rawCategory
        : 'Damaged Green Infrastructure (SDG 13)';
      const fallbackDescription = `Potential ${category.split('(')[0].trim()} identified in the uploaded image. Please verify severity on-site.`;
      const description = String(parsed.description || '').trim() || fallbackDescription;
      const additionalDetails =
        String(parsed.additionalDetails || '').trim() ||
        'No extra visual details were returned by the model. Please review the image manually for context.';

      res.json({ category, description, additionalDetails });
    } catch (error) {
      console.error('Gemini analysis error:', error);
      res.status(500).json({ message: 'Failed to analyze image with Gemini.' });
    }
  });

  app.patch('/api/reports/:id/resolve', async (req: Request, res: Response) => {
    const { id } = req.params;
    const role = String(req.query.role || req.body?.role || '').toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only leaders can resolve reports.' });
    }

    try {
      const resolvedReport = await mutateState((state) => {
        const reportIndex = state.reports.findIndex((item) => item.id === id);
        if (reportIndex === -1) {
          throw new Error('REPORT_NOT_FOUND');
        }

        const report = { ...state.reports[reportIndex], status: 'Resolved' as const, time: 'Resolved' };
        const reports = [...state.reports];
        reports[reportIndex] = report;

        const reporterUserId = String(report.ownerUserId || '');
        const dashboard = reporterUserId ? getOrCreateUserDashboard(state, reporterUserId) : null;

        return {
          nextState: {
            ...state,
            reports,
            userDashboards:
              reporterUserId && dashboard
                ? {
                    ...state.userDashboards,
                    [reporterUserId]: {
                      ...dashboard,
                      points: dashboard.points + 150,
                      actions: [
                        {
                          id: Date.now() + 2,
                          title: `Resolved ${report.type}`,
                          time: 'Just now',
                          points: 150,
                          type: 'resolution',
                          userId: reporterUserId,
                        },
                        ...dashboard.actions,
                      ],
                    },
                  }
                : state.userDashboards,
          },
          result: report,
        };
      });

      res.json(resolvedReport);
    } catch (error) {
      if (error instanceof Error && error.message === 'REPORT_NOT_FOUND') {
        return res.status(404).json({ message: 'Report not found.' });
      }
      handleStorageError(res, error);
    }
  });

  app.post('/api/redeem', async (req: Request, res: Response) => {
    const { rewardId } = req.body;
    if (!rewardId) {
      return res.status(400).json({ message: 'Reward ID is required.' });
    }

    try {
      const redemption = await mutateState((state) => {
        const rewardIndex = state.rewards.findIndex((item) => item.id === rewardId);
        if (rewardIndex === -1) {
          throw new Error('REWARD_NOT_FOUND');
        }

        const reward = state.rewards[rewardIndex];
        if (state.points < reward.cost) {
          throw new Error('INSUFFICIENT_POINTS');
        }

        const rewards = [...state.rewards];
        rewards[rewardIndex] = { ...reward, available: false };

        const nextState = {
          ...state,
          points: state.points - reward.cost,
          rewards,
        };

        return {
          nextState,
          result: {
            reward: rewards[rewardIndex],
            balance: nextState.points,
          },
        };
      });

      res.json({ message: 'Reward redeemed', reward: redemption.reward, balance: redemption.balance });
    } catch (error) {
      if (error instanceof Error && error.message === 'REWARD_NOT_FOUND') {
        return res.status(404).json({ message: 'Reward not found.' });
      }
      if (error instanceof Error && error.message === 'INSUFFICIENT_POINTS') {
        return res.status(400).json({ message: 'Insufficient points.' });
      }
      handleStorageError(res, error);
    }
  });

  app.get('/api/dashboard', async (_req: Request, res: Response) => {
    const userId = String(_req.query.userId || '').trim();
    const role = String(_req.query.role || '').toLowerCase();
    try {
      const state = await readState();
      const dashboard = userId ? getOrCreateUserDashboard(state, userId) : createDefaultUserDashboard();
      const visibleReports =
        role === 'admin'
          ? state.reports
          : state.reports.filter((report) => String(report.ownerUserId || '') === userId);
      const resolvedCount = visibleReports.filter((report) => report.status === 'Resolved').length;
      const pendingCount = visibleReports.filter((report) => report.status !== 'Resolved').length;
      const totalCarbon = dashboard.graphData.reduce((sum, item) => sum + item.carbon, 0);
      const rankImprovement = resolvedCount * 2 + Math.floor((dashboard.points - 2450) / 50);
      const currentRank = Math.max(1, 15 - rankImprovement);
      const rankTrend = Math.max(1, rankImprovement);

      res.json({
        points: dashboard.points,
        resolvedCount,
        pendingCount,
        graphData: dashboard.graphData,
        recentActions: dashboard.actions.slice(0, 5),
        totalCarbon,
        currentRank,
        rankTrend,
      });
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/graph', async (req: Request, res: Response) => {
    const { day, carbon, userId } = req.body;
    if (!day || typeof carbon !== 'number' || !userId) {
      return res.status(400).json({ message: 'Invalid graph payload. userId is required.' });
    }

    try {
      const graphEntry = await mutateState((state) => {
        const targetUserId = String(userId);
        const dashboard = getOrCreateUserDashboard(state, targetUserId);
        const itemIndex = dashboard.graphData.findIndex((entry) => entry.name === day);
        if (itemIndex === -1) {
          const graphData = [...dashboard.graphData, { name: String(day), carbon: Number(carbon.toFixed(1)) }];
          return {
            nextState: {
              ...state,
              userDashboards: {
                ...state.userDashboards,
                [targetUserId]: {
                  ...dashboard,
                  graphData,
                },
              },
            },
            result: graphData[graphData.length - 1],
          };
        }

        const graphData = [...dashboard.graphData];
        graphData[itemIndex] = {
          ...graphData[itemIndex],
          carbon: Number((graphData[itemIndex].carbon + carbon).toFixed(1)),
        };

        return {
          nextState: {
            ...state,
            userDashboards: {
              ...state.userDashboards,
              [targetUserId]: {
                ...dashboard,
                graphData,
              },
            },
          },
          result: graphData[itemIndex],
        };
      });

      res.json(graphEntry);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.use((req: Request, res: Response) => {
    res.status(404).json({ message: 'Route not found.' });
  });

  const startOnPort = (port: number) => {
    const activeServer = app.listen(port, () => {
      console.log(`Backend server running at http://localhost:${port}`);
    });

    activeServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        const fallbackPort = port + 1;
        console.warn(`Port ${port} is already in use. Trying port ${fallbackPort}...`);
        startOnPort(fallbackPort);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });
  };

  startOnPort(PORT);
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
