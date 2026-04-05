import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';

type ReportStatus = 'Open' | 'In Progress' | 'Resolved';

type Report = {
  id: string;
  type: string;
  location: string;
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

type AppState = {
  points: number;
  graphData: Array<{ name: string; carbon: number }>;
  actions: Action[];
  reports: Report[];
  rewards: Reward[];
  modules: ModuleItem[];
  users: User[];
};

type StateRow = {
  id: string;
  state: AppState;
  updated_at: string;
};

const STATE_ROW_ID = 'ecosync-app-state';
const MAX_STATE_WRITE_RETRIES = 5;

const defaultState: AppState = {
  points: 0,
  graphData: [],
  actions: [],
  reports: [],
  rewards: [],
  modules: [],
  users: [],
};

const cloneState = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeState = (state?: Partial<AppState> | null): AppState => ({
  points: state?.points ?? defaultState.points,
  graphData: state?.graphData ?? cloneState(defaultState.graphData),
  actions: state?.actions ?? cloneState(defaultState.actions),
  reports: state?.reports ?? cloneState(defaultState.reports),
  rewards: state?.rewards ?? cloneState(defaultState.rewards),
  modules: state?.modules ?? cloneState(defaultState.modules),
  users: state?.users ?? cloneState(defaultState.users),
});

async function startServer() {
  const expressModule = await import('express');
  const express = (expressModule as any).default ?? expressModule;

  const app = express();
  const PORT = Number(process.env.PORT || 4001);
  const isProduction = process.env.NODE_ENV === 'production';
  const corsAllowedOrigin = process.env.CORS_ALLOWED_ORIGIN?.trim() || '';
  if (isProduction && !corsAllowedOrigin) {
    throw new Error('CORS_ALLOWED_ORIGIN must be set in production.');
  }

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
  const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);
  const hashPassword = async (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);
  const isBcryptHash = (hash: string) => hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
  const verifyPassword = async (password: string, storedHash: string) => {
    if (isBcryptHash(storedHash)) {
      return bcrypt.compare(password, storedHash);
    }
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    return legacyHash === storedHash;
  };

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
    if (corsAllowedOrigin) {
      res.header('Access-Control-Allow-Origin', corsAllowedOrigin);
      res.header('Vary', 'Origin');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  }

  app.use(express.json());
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
    try {
      const state = await readState();
      res.json(state.actions.slice(0, 20));
    } catch (error) {
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
      const passwordHash = await hashPassword(String(password));

      const user: User = {
        id: `USR-${Date.now()}`,
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'user',
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
      const user = state.users.find((item) => item.email === normalizedEmail);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const isValidPassword = await verifyPassword(String(password), user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      if (!isBcryptHash(user.passwordHash)) {
        const upgradedHash = await hashPassword(String(password));
        await mutateState((currentState) => {
          const userIndex = currentState.users.findIndex((item) => item.id === user.id);
          if (userIndex === -1) {
            return { nextState: currentState, result: null };
          }

          const currentUser = currentState.users[userIndex];
          if (isBcryptHash(currentUser.passwordHash)) {
            return { nextState: currentState, result: null };
          }

          const users = [...currentState.users];
          users[userIndex] = { ...currentUser, passwordHash: upgradedHash };
          return {
            nextState: { ...currentState, users },
            result: null,
          };
        });
      }

      res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/actions', async (req: Request, res: Response) => {
    const { title, points, type } = req.body;
    if (!title || typeof points !== 'number') {
      return res.status(400).json({ message: 'Invalid action payload.' });
    }

    try {
      const action: Action = {
        id: Date.now(),
        title,
        time: 'Just now',
        points,
        type: type || 'user-logged',
      };

      await mutateState((state) => ({
        nextState: {
          ...state,
          actions: [action, ...state.actions],
          points: state.points + points,
        },
        result: null,
      }));

      res.status(201).json(action);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.get('/api/reports', async (_req: Request, res: Response) => {
    try {
      const state = await readState();
      res.json(state.reports);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/reports', async (req: Request, res: Response) => {
    const { type, location, priority, reporter, description, image } = req.body;
    if (!type || !location || !reporter || !description) {
      return res.status(400).json({ message: 'Missing required report fields.' });
    }

    try {
      const id = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
      const report: Report = {
        id,
        type,
        location,
        priority: priority || 'High',
        status: 'Open',
        time: 'Just now',
        reporter,
        description,
        image: image || null,
        timestamp: new Date().toISOString(),
      };

      await mutateState((state) => ({
        nextState: {
          ...state,
          reports: [report, ...state.reports],
          actions: [
            {
              id: Date.now() + 1,
              title: `Reported ${type}`,
              time: 'Just now',
              points: 50,
              type: 'report',
            },
            ...state.actions,
          ],
          points: state.points + 50,
        },
        result: null,
      }));

      res.status(201).json(report);
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.patch('/api/reports/:id/resolve', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const resolvedReport = await mutateState((state) => {
        const reportIndex = state.reports.findIndex((item) => item.id === id);
        if (reportIndex === -1) {
          throw new Error('REPORT_NOT_FOUND');
        }

        const report = { ...state.reports[reportIndex], status: 'Resolved' as const, time: 'Resolved' };
        const reports = [...state.reports];
        reports[reportIndex] = report;

        return {
          nextState: {
            ...state,
            reports,
            points: state.points + 150,
            actions: [
              {
                id: Date.now() + 2,
                title: `Resolved ${report.type}`,
                time: 'Just now',
                points: 150,
                type: 'resolution',
              },
              ...state.actions,
            ],
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
    try {
      const state = await readState();
      const resolvedCount = state.reports.filter((report) => report.status === 'Resolved').length;
      const pendingCount = state.reports.filter((report) => report.status !== 'Resolved').length;
      const totalCarbon = state.graphData.reduce((sum, item) => sum + item.carbon, 0);
      const rankImprovement = resolvedCount * 2 + Math.floor((state.points - 2450) / 50);
      const currentRank = Math.max(1, 15 - rankImprovement);
      const rankTrend = Math.max(1, rankImprovement);

      res.json({
        points: state.points,
        resolvedCount,
        pendingCount,
        graphData: state.graphData,
        recentActions: state.actions.slice(0, 5),
        totalCarbon,
        currentRank,
        rankTrend,
      });
    } catch (error) {
      handleStorageError(res, error);
    }
  });

  app.post('/api/graph', async (req: Request, res: Response) => {
    const { day, carbon } = req.body;
    if (!day || typeof carbon !== 'number') {
      return res.status(400).json({ message: 'Invalid graph payload.' });
    }

    try {
      const graphEntry = await mutateState((state) => {
        const itemIndex = state.graphData.findIndex((entry) => entry.name === day);
        if (itemIndex === -1) {
          throw new Error('DAY_NOT_FOUND');
        }

        const graphData = [...state.graphData];
        graphData[itemIndex] = {
          ...graphData[itemIndex],
          carbon: Number((graphData[itemIndex].carbon + carbon).toFixed(1)),
        };

        return {
          nextState: { ...state, graphData },
          result: graphData[itemIndex],
        };
      });

      res.json(graphEntry);
    } catch (error) {
      if (error instanceof Error && error.message === 'DAY_NOT_FOUND') {
        return res.status(404).json({ message: 'Day not found.' });
      }
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
