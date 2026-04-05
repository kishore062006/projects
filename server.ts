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

type Database = {
  points: number;
  graphData: Array<{ name: string; carbon: number }>;
  actions: Action[];
  reports: Report[];
  rewards: Reward[];
  modules: ModuleItem[];
  users: User[];
};

async function startServer() {
  const expressModule = await import('express');
  const express = (expressModule as any).default ?? expressModule;
  const fs = await import('fs');
  const path = await import('path');

  const app = express();
  const PORT = Number(process.env.PORT || 4001);
  const DB_PATH = path.join(process.cwd(), 'server', 'db.json');

  const crypto = await import('crypto');
  const hashPassword = (password: string) => crypto.createHash('sha256').update(password).digest('hex');

  const defaultDb = {
    points: 0,
    graphData: [],
    actions: [],
    reports: [],
    rewards: [],
    modules: [],
    users: [],
  } as Database;

  function ensureDb() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2), 'utf8');
    }
  }

  function readDb(): Database {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(raw) as Database;
    } catch (error) {
      console.error('Could not read database file:', error);
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2), 'utf8');
      return defaultDb;
    }
  }

  function writeDb(db: Database) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  }

  function corsMiddleware(req: Request, res: Response, next: () => void) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  }

  ensureDb();
  app.use(express.json());
  app.use(corsMiddleware);

  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/modules', (_req: Request, res: Response) => {
    const db = readDb();
    res.json(db.modules);
  });

  app.get('/api/rewards', (_req: Request, res: Response) => {
    const db = readDb();
    res.json(db.rewards);
  });

  app.get('/api/actions', (_req: Request, res: Response) => {
    const db = readDb();
    res.json(db.actions.slice(0, 20));
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const db = readDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.users.some((user) => user.email === normalizedEmail)) {
      return res.status(400).json({ message: 'Email already in use.' });
    }

    const user: User = {
      id: `USR-${Date.now()}`,
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(String(password)),
      role: 'user',
    };

    db.users.push(user);
    writeDb(db);
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const db = readDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordHash = hashPassword(String(password));
    const user = db.users.find((item) => item.email === normalizedEmail && item.passwordHash === passwordHash);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  app.post('/api/actions', (req: Request, res: Response) => {
    const { title, points, type } = req.body;
    if (!title || typeof points !== 'number') {
      return res.status(400).json({ message: 'Invalid action payload.' });
    }

    const db = readDb();
    const action: Action = {
      id: Date.now(),
      title,
      time: 'Just now',
      points,
      type: type || 'user-logged',
    };
    db.actions.unshift(action);
    db.points += points;
    writeDb(db);
    res.status(201).json(action);
  });

  app.get('/api/reports', (_req: Request, res: Response) => {
    const db = readDb();
    res.json(db.reports);
  });

  app.post('/api/reports', (req: Request, res: Response) => {
    const { type, location, priority, reporter, description, image } = req.body;
    if (!type || !location || !reporter || !description) {
      return res.status(400).json({ message: 'Missing required report fields.' });
    }

    const db = readDb();
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
    db.reports.unshift(report);
    db.actions.unshift({
      id: Date.now() + 1,
      title: `Reported ${type}`,
      time: 'Just now',
      points: 50,
      type: 'report',
    });
    db.points += 50;
    writeDb(db);
    res.status(201).json(report);
  });

  app.patch('/api/reports/:id/resolve', (req: Request, res: Response) => {
    const { id } = req.params;
    const db = readDb();
    const report = db.reports.find((item) => item.id === id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }
    report.status = 'Resolved';
    report.time = 'Resolved';
    db.points += 150;
    db.actions.unshift({
      id: Date.now() + 2,
      title: `Resolved ${report.type}`,
      time: 'Just now',
      points: 150,
      type: 'resolution',
    });
    writeDb(db);
    res.json(report);
  });

  app.post('/api/redeem', (req: Request, res: Response) => {
    const { rewardId } = req.body;
    if (!rewardId) {
      return res.status(400).json({ message: 'Reward ID is required.' });
    }

    const db = readDb();
    const reward = db.rewards.find((item) => item.id === rewardId);
    if (!reward) {
      return res.status(404).json({ message: 'Reward not found.' });
    }
    if (db.points < reward.cost) {
      return res.status(400).json({ message: 'Insufficient points.' });
    }

    db.points -= reward.cost;
    reward.available = false;
    writeDb(db);
    res.json({ message: 'Reward redeemed', reward, balance: db.points });
  });

  app.get('/api/dashboard', (_req: Request, res: Response) => {
    const db = readDb();
    const resolvedCount = db.reports.filter((report) => report.status === 'Resolved').length;
    const pendingCount = db.reports.filter((report) => report.status !== 'Resolved').length;
    const totalCarbon = db.graphData.reduce((sum, item) => sum + item.carbon, 0);
    const rankImprovement = resolvedCount * 2 + Math.floor((db.points - 2450) / 50);
    const currentRank = Math.max(1, 15 - rankImprovement);
    const rankTrend = Math.max(1, rankImprovement);

    res.json({
      points: db.points,
      resolvedCount,
      pendingCount,
      graphData: db.graphData,
      recentActions: db.actions.slice(0, 5),
      totalCarbon,
      currentRank,
      rankTrend,
    });
  });

  app.post('/api/graph', (req: Request, res: Response) => {
    const { day, carbon } = req.body;
    if (!day || typeof carbon !== 'number') {
      return res.status(400).json({ message: 'Invalid graph payload.' });
    }
    const db = readDb();
    const item = db.graphData.find((entry) => entry.name === day);
    if (!item) {
      return res.status(404).json({ message: 'Day not found.' });
    }
    item.carbon = Number((item.carbon + carbon).toFixed(1));
    writeDb(db);
    res.json(item);
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
