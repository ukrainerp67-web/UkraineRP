import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Railway/AI Studio Alias fix: 
const findDatabaseUrl = () => {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== 'placeholder' && process.env.DATABASE_URL.trim() !== '') {
    return process.env.DATABASE_URL;
  }
  // Шукаємо в усіх змінних щось схоже на postgres url
  for (const key in process.env) {
    const val = process.env[key];
    if (val && typeof val === 'string' && val.startsWith('postgresql://')) {
      console.log(`[CONFIG] Found database URL in variable: ${key}`);
      return val;
    }
  }
  return null;
};

const rawUrl = findDatabaseUrl();
if (rawUrl) {
  process.env.DATABASE_URL = rawUrl;
}

const JWT_SECRET = process.env.JWT_SECRET || 'ukraine-rp-secret-key-2024';

// Initialize Prisma with explicit URL if available
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

let dbLastError = '';

// Перевірка підключення до бази даних з ретраями (збільшено до 20 спроб)
async function checkDatabase(retries = 20) {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === '' || url === 'placeholder') {
    dbLastError = 'DATABASE_URL is missing or empty. Please check Railway Variables.';
    console.error('❌ КРИТИЧНО: DATABASE_URL не знайдено!');
    return false;
  }
  
  console.log(`[DB] Attempting to connect to ${url.split('@')[1] || 'database'}...`);

  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      // Перевірка чи існують таблиці (якщо ні - це помилка схеми)
      await prisma.player.count().catch(async (e) => {
         if (e.message.includes('does not exist')) {
            console.log('[DB] Tables missing, schema sync might be needed.');
            throw new Error('Таблиці не знайдено. Railway виконує синхронізацію...');
         }
         throw e;
      });
      console.log('✅ Успішно підключено до PostgreSQL');
      dbLastError = '';
      return true;
    } catch (e: any) {
      if (e.message.includes('postgres.railway.internal') || e.message.includes('Can\'t reach database server')) {
        dbLastError = 'Помилка підключення: RAILWAY INTERNAL URL не працює ззовні. Будь ласка, вставте PUBLIC CONNECTION STRING у Settings -> Environment Variables в AI Studio.';
      } else {
        dbLastError = e.message;
      }
      console.error(`❌ Спроба ${i+1}/${retries}: Помилка:`, e.message);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 4000));
      }
    }
  }
  return false;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  let isDbReady = false;
  
  async function initSystemData() {
    try {
      const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
      if (!config) {
        await prisma.systemConfig.create({
          data: {
            id: 'global',
            budget: 1000000,
            taxRate: 0.20,
            trustRating: 60
          }
        });
        console.log('[SERVER] Global system config initialized');
      }
    } catch (err) {
      console.error('[SERVER] Failed to init system config:', err);
    }
  }

  checkDatabase().then(async (ready) => {
    isDbReady = ready;
    if (ready) {
      await initSystemData();
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: isDbReady ? 'ok' : (dbLastError ? 'db_error' : 'connecting'), 
      db: isDbReady,
      error: dbLastError,
      env: {
        has_url: !!process.env.DATABASE_URL,
        url_prefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.split(':')[0] : 'none',
        keys: Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DATABASE'))
      }
    });
  });

  // Middleware для перевірки БД перед запитами до API
  app.use('/api', (req, res, next) => {
    // Дозволяємо системний конфіг навіть якщо БД не готова (для відображення початкового UI)
    if (req.path.includes('/system/global')) return next();

    if (!isDbReady) {
       console.warn(`[API] Запит ${req.path} проігноровано: БД не підключена або несправна`);
       return res.status(503).json({ 
         error: 'База даних недоступна', 
         message: 'Будь ласка, перевірте DATABASE_URL у налаштуваннях Settings (postgresql://...)' 
       });
    }
    next();
  });


  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));

  // --- Auth Routes (Replacement for Firebase) ---
  app.post('/api/auth/register', async (req, res) => {
    const { email, password, username, firstName, lastName, sex, birthDate, signature } = req.body;
    try {
      const existingUser = await prisma.player.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'Цей Gmail вже зареєстрований. Спробуйте увійти.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const uid = `up-${Math.random().toString(36).substring(2, 11)}`;
      const isAdmin = email.toLowerCase() === 'ukrainerp67@gmail.com';
      
      const player = await prisma.player.create({
        data: {
          uid,
          email,
          username: username || email.split('@')[0] + '-' + Math.floor(Math.random() * 1000),
          passwordHash: hashedPassword,
          firstName: firstName || 'Гість',
          lastName: lastName || 'України',
          sex: sex || 'M',
          birthDate: birthDate || '2000-01-01',
          signature: signature || '',
          balance: isAdmin ? 10000000 : 5000,
          socialRating: isAdmin ? 1000 : 50,
          status: isAdmin ? 'Головний Адмін' : 'Громадянин',
          role: isAdmin ? 'admin' : 'user',
          isVerified: isAdmin,
          bankCards: isAdmin ? [
            {
              type: 'standard',
              number: '0000 0000 0000 0001',
              balance: 10000000,
              label: 'Держ Карта',
              createdAt: new Date().toISOString(),
              passportId: `UA-${uid.toUpperCase()}`
            }
          ] : []
        }
      });

      const token = jwt.sign({ uid: player.uid, email: player.email }, JWT_SECRET, { expiresIn: '14d' });
      res.json({ success: true, token, user: { uid: player.uid, email: player.email } });
    } catch (e: any) {
      console.error('[AUTH] Register error:', e.message);
      res.status(400).json({ success: false, error: 'Помилка реєстрації. Перевірте з\'єднання з БД.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const player = await prisma.player.findUnique({ where: { email } });
      if (!player || !player.passwordHash) {
        return res.status(401).json({ success: false, error: 'Невірний email або пароль' });
      }

      const isMatch = await bcrypt.compare(password, player.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Невірний email або пароль' });
      }

      const token = jwt.sign({ uid: player.uid, email: player.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, token, user: { uid: player.uid, email: player.email } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
    
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const player = await prisma.player.findUnique({ where: { uid: decoded.uid } });
      if (!player) return res.status(404).json({ error: 'Користувача не знайдено' });
      res.json({ user: { uid: player.uid, email: player.email } });
    } catch (e) {
      res.status(401).json({ error: 'Сесія завершена, увійдіть знову' });
    }
  });

  // --- API Routes ---

  app.get('/api/profile/email/:email', async (req, res) => {
    const email = req.params.email;
    console.log(`[PROFILE] Searching for email: ${email}`);
    try {
      const user = await prisma.player.findUnique({ where: { email } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/users', async (req, res) => {
    try {
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
      const users = await prisma.player.findMany();
      res.json(users || []);
    } catch (error: any) {
      console.error('[ADMIN] Error fetching users:', error.message);
      res.json([]); 
    }
  });

  app.get('/api/profile/:uid', async (req, res) => {
    const uid = req.params.uid;
    const email = req.query.email as string;
    console.log(`[PROFILE] Fetching uid=${uid}, email=${email}`);
    
    try {
      let user = await prisma.player.findUnique({ where: { uid } });
      
      if (!user && email) {
        console.log(`[RECOVERY] Searching for orphaned account by email: ${email}`);
        user = await prisma.player.findUnique({ where: { email } });
        if (user) {
          console.log(`[RECOVERY] Found orphaned user! Relinking ${email} from ${user.uid} to ${uid}`);
          user = await prisma.player.update({
            where: { email },
            data: { uid, updatedAt: new Date() }
          });
        }
      }
      
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Owner auto-admin
      if (user.email.toLowerCase() === 'ukrainerp67@gmail.com' && user.role !== 'admin') {
        user = await prisma.player.update({
          where: { uid: user.uid },
          data: { role: 'admin', status: 'Головний Адмін', isVerified: true }
        });
      }

      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/profile', async (req, res) => {
    const { uid, email, firstName, lastName, sex, birthDate, passportPhoto, signature, role, status, balance, socialRating, bankCards, businesses, properties, inventory, isVerified } = req.body;
    console.log(`[PROFILE] Attempting to save user: ${uid} (${email})`);

    try {
      const isAdmin = email?.toLowerCase() === 'ukrainerp67@gmail.com';
      const userRole = isAdmin ? 'admin' : (role || 'user');
      const userStatus = isAdmin ? 'Головний Адмін' : (status || 'Громадянин');
      const userBalance = isAdmin && (!balance || balance < 1000000) ? 10000000 : (balance !== undefined ? balance : 5000);

      // Ensure we don't have unique constraint conflicts on username
      const generatedUsername = email ? email.split('@')[0] + '-' + uid.substring(0, 5) : `user-${uid.substring(0, 8)}`;

      const user = await prisma.player.upsert({
        where: { uid },
        update: {
          email, 
          firstName, 
          lastName, 
          sex, 
          birthDate, 
          passportPhoto, 
          signature,
          role: userRole,
          status: userStatus,
          balance: userBalance,
          socialRating: socialRating !== undefined ? socialRating : undefined,
          bankCards: bankCards || undefined,
          properties: properties || undefined,
          inventory: inventory || undefined,
          isVerified: isAdmin || isVerified,
          updatedAt: new Date(),
          lastLogin: new Date()
        },
        create: {
          uid, 
          email, 
          username: generatedUsername,
          firstName, 
          lastName, 
          sex, 
          birthDate, 
          passportPhoto, 
          signature,
          role: userRole,
          status: userStatus,
          balance: userBalance,
          socialRating: socialRating || 50,
          bankCards: bankCards || [],
          properties: properties || [],
          inventory: inventory || [],
          isVerified: isAdmin || isVerified
        }
      });
      console.log(`[PROFILE] Success for ${uid}`);
      res.json({ success: true, user });
    } catch (error: any) {
      console.error(`[PROFILE] CRITICAL ERROR saving user ${uid}:`, error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        code: error.code
      });
    }
  });

  app.patch('/api/profile/:uid', async (req, res) => {
    const updates = req.body;
    const uid = req.params.uid;
    try {
      const user = await prisma.player.update({
        where: { uid },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });
      res.json({ success: true, user });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.patch('/api/profile/:uid/relink', async (req, res) => {
    const { email } = req.body;
    const newUid = req.params.uid;
    console.log(`[PROFILE] Relinking user ${email} to new UID ${newUid}`);
    try {
      await prisma.player.update({
        where: { email },
        data: { uid: newUid, updatedAt: new Date() }
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[PROFILE] Relink error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Global State
  app.get('/api/system/global', async (req, res) => {
    try {
      const state = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
      res.json(state);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/system/global', async (req, res) => {
    const { budget, taxRate, trustRating } = req.body;
    try {
      const state = await prisma.systemConfig.update({
        where: { id: 'global' },
        data: {
          budget: budget !== undefined ? { increment: budget } : undefined,
          taxRate,
          trustRating
        }
      });
      res.json({ success: true, state });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Events
  app.get('/api/events', async (req, res) => {
    try {
      const events = await prisma.globalEvent.findMany({
        orderBy: { id: 'desc' },
        take: 50
      });
      res.json(events);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/events', async (req, res) => {
    const { type, message, player } = req.body;
    try {
      await prisma.globalEvent.create({
        data: { type, message, player }
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Notifications
  app.get('/api/users/:uid/notifications', async (req, res) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.params.uid },
        orderBy: { id: 'desc' }
      });
      res.json(notifications || []);
    } catch (e: any) {
      console.error('[NOTIFICATIONS] Error fetching notifications:', e);
      res.json([]);
    }
  });

  app.post('/api/users/:uid/notifications', async (req, res) => {
    const { title, message, type } = req.body;
    try {
      await prisma.notification.create({
        data: { userId: req.params.uid, title, message, type }
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
      await prisma.notification.update({
        where: { id: parseInt(req.params.id) },
        data: { read: true }
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Messages / Chat
  app.get('/api/messages', async (req, res) => {
    try {
      const messages = await prisma.globalEvent.findMany({
        where: { type: 'chat' },
        orderBy: { id: 'desc' },
        take: 100
      });
      res.json((messages || []).reverse());
    } catch (e: any) {
      console.error('[MESSAGES] Error fetching messages:', e);
      res.json([]);
    }
  });

  app.post('/api/messages', async (req, res) => {
    const { player, message } = req.body;
    try {
      await prisma.globalEvent.create({
        data: { type: 'chat', message, player }
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Transfer Money (Atomic)
  app.post('/api/transfer', async (req, res) => {
    const { fromId, toId, amount } = req.body;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const fromUser = await tx.player.findUnique({ where: { uid: fromId } });
        const toUser = await tx.player.findUnique({ where: { uid: toId } });

        if (!fromUser || !toUser) throw new Error('User not found');
        if (fromUser.balance < amount) throw new Error('Insufficient funds');

        await tx.player.update({ where: { uid: fromId }, data: { balance: { decrement: amount } } });
        await tx.player.update({ where: { uid: toId }, data: { balance: { increment: amount } } });

        return true;
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/users/:uid/fines', async (req, res) => {
    const { amount, reason, deadline } = req.body;
    try {
      await prisma.fine.create({
        data: { userId: req.params.uid, amount, reason, deadline }
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.patch('/api/fines/:id', async (req, res) => {
    const { status } = req.body;
    try {
      await prisma.fine.update({
        where: { id: parseInt(req.params.id) },
        data: { 
          status, 
          paidAt: status === 'paid' ? new Date() : null 
        }
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Online Players
  app.get('/api/users/search', async (req, res) => {
    const queryStr = req.query.q as string;
    if (!queryStr || queryStr.length < 2) return res.json([]);
    try {
      const users = await prisma.player.findMany({
        where: {
          OR: [
            { firstName: { contains: queryStr, mode: 'insensitive' } },
            { lastName: { contains: queryStr, mode: 'insensitive' } },
            { uid: { contains: queryStr } }
          ]
        },
        take: 20
      });
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/online', async (req, res) => {
    try {
      const thirtySecondsAgo = new Date(Date.now() - 30000);
      const onlinePresence = await prisma.presence.findMany({
        where: {
          status: 'online',
          lastActive: { gt: thirtySecondsAgo }
        },
        select: { uid: true }
      });
      const uids = onlinePresence.map(p => p.uid);
      const users = await prisma.player.findMany({
        where: { uid: { in: uids } }
      });
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/profile/:uid', async (req, res) => {
    const uid = req.params.uid;
    try {
      await prisma.$transaction([
        prisma.player.delete({ where: { uid } }),
        prisma.presence.deleteMany({ where: { uid } }),
        prisma.notification.deleteMany({ where: { userId: uid } }),
        prisma.fine.deleteMany({ where: { userId: uid } })
      ]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/users/:uid/fines', async (req, res) => {
    try {
      const fines = await prisma.fine.findMany({
        where: { userId: req.params.uid },
        orderBy: { issuedAt: 'desc' }
      });
      res.json(fines);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/presence/:uid', async (req, res) => {
    try {
      await prisma.presence.upsert({
        where: { uid: req.params.uid },
        update: { lastActive: new Date(), status: 'online' },
        create: { uid: req.params.uid, lastActive: new Date(), status: 'online' }
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Background Jobs ---
  setInterval(async () => {
    if (!isDbReady) return;
    try {
      const players = await prisma.player.findMany({
        select: { uid: true, properties: true } 
      });
      const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
      if (!config) return;

      let totalTaxCollected = 0;
      // Mock tax collection loop
      totalTaxCollected = Math.floor(Math.random() * 500); 

      if (totalTaxCollected > 0) {
        await prisma.systemConfig.update({
          where: { id: 'global' },
          data: { budget: { increment: totalTaxCollected } }
        });
      }
    } catch (e) {
      // Silent log for background jobs to avoid spamming if DB flickers
      console.error('[JOBS] Cycle failed (likely DB connection):', e instanceof Error ? e.message : 'Unknown error');
    }
  }, 60000);

  // Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --- Error Handling ---
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[SERVER ERROR]', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`New Game Server running on http://localhost:${PORT}`);
  });
}

startServer();
