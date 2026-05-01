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
  // Пріоритет 1: Перевіряємо чи є вже DATABASE_URL і чи він не внутрішній
  if (process.env.DATABASE_URL && 
      process.env.DATABASE_URL !== 'placeholder' && 
      process.env.DATABASE_URL.trim() !== '' &&
      !process.env.DATABASE_URL.includes('railway.internal')) {
    return process.env.DATABASE_URL;
  }

  // Пріоритет 2: Шукаємо явний PUBLIC_URL
  for (const key in process.env) {
    if (key.includes('PUBLIC') && key.includes('URL') && process.env[key]?.startsWith('postgresql://')) {
      console.log(`[CONFIG] Found PUBLIC database URL in variable: ${key}`);
      return process.env[key];
    }
  }

  // Пріоритет 3: Будь-який postgres url (навіть внутрішній як останній шанс)
  for (const key in process.env) {
    const val = process.env[key];
    if (val && typeof val === 'string' && val.startsWith('postgresql://')) {
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

const FRACTION_STATUSES = [
  'Головний Адмін',
  'Президент',
  "Прем'єр-міністр",
  'Міністр фінансів',
  'Депутат',
  'Працівник ВФБ',
  'Голова Банку',
  'Директор кредитного відділу',
  'Керівник фінмоніторингу',
  'Головний касир',
  'Колектор банку',
  'Поліція',
  'Дон (Бос мафії)',
  'Консильєрі (Радник)',
  'Капо (Капітан)',
  'Бойовик (Силовик)',
  'Працівник оподаткування'
];

let globalGameState = {
  taxRate: 0.20,
  stateBudget: 5000000,
  activeProposals: [] as any[], // Laws/Bills for President
  maidanActive: false,
};

function resolveStatus(businesses: any[], currentStatus: string) {
  const hasBusinesses = Array.isArray(businesses) && businesses.length > 0;
  
  // Якщо у користувача є спеціальна фракційна роль, залишаємо її
  if (FRACTION_STATUSES.includes(currentStatus)) {
    return currentStatus;
  }
  
  // Інакше перемикаємо між Громадянином та Бізнесменом
  return hasBusinesses ? 'Бізнесмен' : 'Громадянин';
}

// Middleware for auth verification
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    if (req.path.includes('/auth/me')) {
       return next(); // Let /auth/me handle missing tokens gracefully
    }
    return res.status(401).json({ error: 'Сесія завершена, увійдіть знову' });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) {
      console.warn(`[AUTH] Token invalid for ${req.path}: ${err.message}`);
      return res.status(401).json({ error: 'Сесія завершена, увійдіть знову' });
    }
    
    req.user = user;
    
    try {
      const dbUser = await prisma.player.findUnique({ where: { uid: user.uid } });
      
      const path = req.path || '';
      const method = req.method;
      
      const isProfileRoute = path.includes('/profile');
      const isAuthMe = path.includes('/auth/me');
      const isPresence = path.includes('/presence');
      const isOnline = path.includes('/online');
      const isMessages = path.includes('/messages');
      const isHealth = path.includes('/health');
      const isNotifications = path.includes('/notifications');
      const isEvents = path.includes('/events');
      const isGlobal = path.includes('/system/global');
      const isFines = path.includes('/fines');
      const isConfig = path.includes('/config');
      const isRegistration = path.includes('/register');

      const isDiscovery = isProfileRoute || isAuthMe || isPresence || isOnline || isMessages || isHealth || isNotifications || isEvents || isGlobal || isFines || isConfig || isRegistration;

      if (!dbUser && !isDiscovery) {
        console.warn(`[AUTH] Restricted route access: ${method} ${path} - User ${user.uid} not in DB`);
        return res.status(403).json({ 
          error: 'У вас немає ігрового профілю. Будь ласка, завершіть реєстрацію персонажу.',
          isNewUser: true
        });
      }

      req.dbUser = dbUser;
      next();
    } catch (e) {
      console.error('Auth verification error:', e);
      // Fallback for transient DB issues
      next();
    }
  });
};

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
        // If user already exists, check password and log them in instead of error
        const isMatch = await bcrypt.compare(password, existingUser.passwordHash || '');
        if (isMatch) {
          const token = jwt.sign({ uid: existingUser.uid, email: existingUser.email }, JWT_SECRET, { expiresIn: '14d' });
          return res.json({ success: true, token, user: { uid: existingUser.uid, email: existingUser.email }, profile: existingUser });
        }
        return res.status(400).json({ success: false, error: 'Цей Gmail вже зареєстрований з іншим паролем.' });
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
          firstName: isAdmin ? 'Головний' : null,
          lastName: isAdmin ? 'Адмін' : null,
          sex: sex || (isAdmin ? 'M' : null),
          birthDate: birthDate || (isAdmin ? '2000-01-01' : null),
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
      res.json({ success: true, token, user: { uid: player.uid, email: player.email }, profile: player });
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
      res.json({ success: true, token, user: { uid: player.uid, email: player.email }, profile: player });
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
      
      if (!player) {
         // Check if user exists by email as fallback
         const playerByEmail = await prisma.player.findUnique({ where: { email: decoded.email } });
         if (playerByEmail) {
            return res.json({ user: { uid: playerByEmail.uid, email: playerByEmail.email } });
         }

        return res.json({ 
          user: { uid: decoded.uid, email: decoded.email }, 
          isNewUser: true 
        });
      }

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

  app.get('/api/admin/users', authenticateToken, async (req: any, res) => {
    try {
      // Ensure only admins can see all users
      const requester = await prisma.player.findUnique({ where: { uid: req.user.uid } });
      if (requester?.role !== 'admin' && requester?.email !== 'ukrainerp67@gmail.com') {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
      
      const [users, presence] = await Promise.all([
        prisma.player.findMany(),
        prisma.presence.findMany()
      ]);

      const combined = users.map(u => {
        const p = presence.find(pres => pres.uid === u.uid);
        return {
          ...u,
          lastActive: p ? p.lastActive : null
        };
      });

      res.json(combined || []);
    } catch (error: any) {
      console.error('[ADMIN] Error fetching users:', error.message);
      res.json([]); 
    }
  });

  app.patch('/api/admin/users/:targetUid', authenticateToken, async (req: any, res) => {
    try {
      const requester = await prisma.player.findUnique({ where: { uid: req.user.uid } });
      if (requester?.role !== 'admin' && requester?.email !== 'ukrainerp67@gmail.com') {
        return res.status(403).json({ error: 'Доступ заборонено' });
      }

      const { targetUid } = req.params;
      const updates = req.body;
      const isSuperAdmin = req.user.email === 'ukrainerp67@gmail.com';

      // Base updates
      const data: any = {
        balance: updates.balance,
        socialRating: updates.socialRating,
        isVerified: updates.isVerified,
        status: updates.status
      };

      // Only super admin can change functional roles
      if (isSuperAdmin && updates.role) {
        data.role = updates.role;
      }

      const updatedUser = await prisma.player.update({
        where: { uid: targetUid },
        data
      });

      res.json(updatedUser);
    } catch (e: any) {
      console.error('[ADMIN] Update user error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/profile/:uid', authenticateToken, async (req: any, res) => {
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

      // Auto-assign Businessman status if out of sync
      const currentStatus = user.status;
      const expectedStatus = resolveStatus((user.businesses as any[]) || [], currentStatus);
      if (currentStatus !== expectedStatus) {
        user = await prisma.player.update({
          where: { uid: user.uid },
          data: { status: expectedStatus }
        });
      }

      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/profile', authenticateToken, async (req: any, res) => {
    const { uid, email, firstName, lastName, sex, birthDate, passportPhoto, signature, role, status, balance, socialRating, bankCards, businesses, properties, inventory, isVerified } = req.body;
    
    // Security: uid must match authenticated user
    if (req.user.uid !== uid) return res.status(403).json({ error: 'UID mismatch' });
    console.log(`[PROFILE] Attempting to save user: ${uid} (${email})`);

    try {
      const isAdmin = email?.toLowerCase() === 'ukrainerp67@gmail.com';
      const userRole = isAdmin ? 'admin' : (role || 'user');
      const userStatus = isAdmin ? 'Головний Адмін' : resolveStatus(businesses || [], status || 'Громадянин');
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
          businesses: businesses || undefined,
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
          businesses: businesses || [],
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

  app.patch('/api/profile/:uid', authenticateToken, async (req: any, res) => {
    const updates = req.body;
    const uid = req.params.uid;
    
    // Security: Only self or admin
    const isAdmin = req.dbUser && req.dbUser.role === 'admin';
    if (req.user.uid !== uid && !isAdmin) return res.status(403).json({ error: 'Identity mismatch' });
    try {
      const existingUser = await prisma.player.findUnique({ where: { uid } });
      const currentStatus = existingUser?.status || 'Громадянин';
      const updatedStatus = updates.businesses !== undefined ? resolveStatus(updates.businesses, currentStatus) : (updates.status || currentStatus);

      const user = await prisma.player.update({
        where: { uid },
        data: {
          ...updates,
          status: updatedStatus,
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

  app.patch('/api/system/global', authenticateToken, async (req: any, res) => {
    const isGovLeader = req.dbUser && (
      req.dbUser.role === 'admin' || 
      req.dbUser.role === 'rada' ||
      [
        'Президент', 
        "Прем'єр Міністр", 
        "Прем'єр міністр", 
        "Прем'єр-міністр", 
        'Міністр фінансів'
      ].includes(req.dbUser.role) ||
      [
        'Президент', 
        "Прем'єр Міністр", 
        "Прем'єр міністр", 
        "Прем'єр-міністр", 
        'Міністр фінансів'
      ].includes(req.dbUser.status)
    );
    
    if (!isGovLeader) return res.status(403).json({ error: 'Доступ лише для членів уряду' });
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
  app.get('/api/users/:uid/notifications', authenticateToken, async (req: any, res) => {
    try {
      if (req.user.uid !== req.params.uid) return res.status(403).json({ error: 'Auth mismatch' });
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
  app.get('/api/messages', authenticateToken, async (req: any, res) => {
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
  app.post('/api/transfer', authenticateToken, async (req: any, res) => {
    const { fromId, toId, amount } = req.body;
    
    if (req.user.uid !== fromId) return res.status(403).json({ error: 'Identity mismatch' });
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

  app.post('/api/users/:uid/fines', authenticateToken, async (req: any, res) => {
    // Only officials can issue fines (or admin)
    const isOfficial = req.dbUser && (['admin', 'Президент', 'Депутат', 'Поліція'].includes(req.dbUser.role) || req.dbUser.status === 'Поліція');
    if (!isOfficial) return res.status(403).json({ error: 'Official only' });
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

  app.patch('/api/fines/:id', authenticateToken, async (req: any, res) => {
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

  app.get('/api/online', authenticateToken, async (req: any, res) => {
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

  app.delete('/api/profile/:uid', authenticateToken, async (req: any, res) => {
    const uid = req.params.uid;
    console.log(`[ADMIN-DELETE] Requested deletion of ${uid} by ${req.user.uid}`);
    try {
      const requester = await prisma.player.findUnique({ where: { uid: req.user.uid } });
      if (!requester || (requester.role !== 'admin' && requester.email !== 'ukrainerp67@gmail.com')) {
        return res.status(403).json({ success: false, error: 'Тільки адміністратори можуть видаляти акаунти' });
      }

      const targetPlayer = await prisma.player.findUnique({ where: { uid } });
      if (!targetPlayer) {
        return res.status(404).json({ success: false, error: 'Гравець не знайдений' });
      }

      const playerId = targetPlayer.id;

      console.log(`[ADMIN-DELETE] Attempting transaction for ${uid} (DB ID: ${playerId})`);
      try {
        await prisma.$transaction([
          prisma.playerAchievement.deleteMany({ where: { playerId } }),
          prisma.inventoryItem.deleteMany({ where: { playerId } }),
          prisma.notification.deleteMany({ where: { userId: uid } }),
          prisma.fine.deleteMany({ where: { userId: uid } }),
          prisma.presence.deleteMany({ where: { uid } }),
          prisma.player.delete({ where: { uid } })
        ]);
        console.log(`[ADMIN-DELETE] Transaction successful for ${uid}`);
      } catch (transError: any) {
        console.error('[ADMIN-DELETE] Transaction failed:', transError);
        throw new Error(`Transaction failed: ${transError.message}`);
      }
      
      res.json({ success: true });
    } catch (e: any) {
      console.error('[ADMIN-DELETE] CRITICAL ERROR:', e);
      res.status(500).json({ success: false, error: e.message || 'Unknown server error' });
    }
  });

  app.get('/api/users/:uid/fines', authenticateToken, async (req: any, res) => {
    if (req.user.uid !== req.params.uid && req.dbUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Identity mismatch' });
    }
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

  // --- GOVERNANCE & RADA SYSTEM ---

  // Get Global Game State
  app.get('/api/game-state', async (req, res) => {
    try {
      const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
      if (config) {
        globalGameState.taxRate = config.taxRate;
        globalGameState.stateBudget = config.budget;
      }
      res.json({
        ...globalGameState,
        taxRate: globalGameState.taxRate,
        stateBudget: globalGameState.stateBudget,
        maidanActive: globalGameState.maidanActive
      });
    } catch (e: any) {
      res.json(globalGameState);
    }
  });

  // Get All Players for Management
  app.get('/api/players/all', authenticateToken, async (req: any, res) => {
    try {
      const players = await prisma.player.findMany({
        orderBy: { lastLogin: 'desc' }
      });
      res.json(players);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Toggle Maidan (Manual)
  app.post('/api/rada/maidan', authenticateToken, async (req: any, res) => {
    const isGov = req.dbUser?.role === 'rada' || 
                  ['Президент', 'Депутат', 'Прем\'єр-міністр'].includes(req.dbUser?.status || '') || 
                  req.dbUser?.role === 'admin';
    if (!isGov) return res.status(403).json({ error: 'Доступ заборонено' });
    
    globalGameState.maidanActive = !globalGameState.maidanActive;
    await prisma.globalEvent.create({
      data: {
        type: 'rada',
        message: globalGameState.maidanActive ? '⚠️ В КРАЇНІ ОГОЛОШЕНО МАЙДАН!' : '✅ Ситуація в країні стабілізована.',
        player: req.dbUser.firstName
      }
    });
    res.json({ success: true, active: globalGameState.maidanActive });
  });

  // Propose Bill
  app.post('/api/rada/propose', authenticateToken, async (req: any, res) => {
    const { title, description } = req.body;
    if (req.dbUser?.status !== 'Депутат' && req.dbUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Тільки депутати можуть подавати законопроєкти' });
    }
    const proposal = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      description,
      proposer: `${req.dbUser.firstName} ${req.dbUser.lastName}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    globalGameState.activeProposals.push(proposal);
    res.json({ success: true, proposal });
  });

  // Manage Proposal
  app.post('/api/rada/manage-proposal', authenticateToken, async (req: any, res) => {
    const { proposalId, action } = req.body;
    if (req.dbUser?.status !== 'Президент' && req.dbUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Тільки Президент має право підпису' });
    }
    const idx = globalGameState.activeProposals.findIndex(p => p.id === proposalId);
    if (idx === -1) return res.status(404).json({ error: 'Запит не знайдено' });

    if (action === 'approve') {
       globalGameState.activeProposals[idx].status = 'approved';
       await prisma.globalEvent.create({
         data: {
           type: 'rada',
           message: `[УКАЗ] Президент підписав закон: ${globalGameState.activeProposals[idx].title}`,
           player: 'Президент'
         }
       });
    } else {
       globalGameState.activeProposals.splice(idx, 1);
    }
    res.json({ success: true });
  });

  // Set Tax Rate
  app.post('/api/rada/tax', authenticateToken, async (req: any, res) => {
    const { rate } = req.body;
    if (req.dbUser?.status !== 'Міністр фінансів' && req.dbUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ лише для Міністра Фінансів' });
    }
    const decimalRate = rate > 1 ? rate / 100 : rate;
    globalGameState.taxRate = decimalRate;
    await prisma.systemConfig.upsert({
      where: { id: 'global' },
      update: { taxRate: decimalRate },
      create: { id: 'global', taxRate: decimalRate, budget: globalGameState.stateBudget }
    });
    await prisma.globalEvent.create({
      data: {
        type: 'rada',
        message: `[ПОДАТКИ] Нова ставка: ${(decimalRate * 100).toFixed(0)}%`,
        player: 'МінФін'
      }
    });
    res.json({ success: true, rate: decimalRate });
  });

  // Confiscate Business
  app.post('/api/rada/confiscate', authenticateToken, async (req: any, res) => {
    const { targetUid, businessId, reason } = req.body;
    const isVFB = req.dbUser?.status === 'Працівник ВФБ' || req.dbUser?.status === 'Міністр фінансів' || req.dbUser?.role === 'admin';
    if (!isVFB) return res.status(403).json({ error: 'Доступ заборонено' });

    try {
      const target = await prisma.player.findUnique({ where: { uid: targetUid } });
      if (!target) return res.status(404).json({ error: 'Гравець не знайдений' });

      let businesses = (target.businesses as any[]) || [];
      const business = businesses.find(b => b.businessId === businessId);
      if (!business) return res.status(404).json({ error: 'Бізнес не знайдений' });

      const updatedBusinesses = businesses.filter(b => b.businessId !== businessId);
      const newStatus = resolveStatus(updatedBusinesses, target.status);

      await prisma.player.update({
        where: { uid: targetUid },
        data: { 
          businesses: updatedBusinesses,
          status: newStatus
        }
      });

      await prisma.notification.create({
        data: {
          userId: targetUid,
          title: '⚠️ КОНФІСКАЦІЯ МАЙНА',
          message: `Ваш бізнес "${business.name || businessId}" конфісковано! Причина: ${reason}`,
          type: 'alert'
        }
      });

      await prisma.globalEvent.create({
        data: {
          type: 'rada',
          message: `[ВФБ] Конфісковано бізнес у ${target.firstName} ${target.lastName}. Причина: ${reason}`,
          player: req.dbUser.firstName
        }
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Block/Unblock Business
  app.post('/api/rada/block-business', authenticateToken, async (req: any, res) => {
    const { targetUid, businessId, block } = req.body;
    const isOfficial = req.dbUser?.status === 'Працівник ВФБ' || req.dbUser?.status === 'Міністр фінансів' || req.dbUser?.role === 'admin';
    if (!isOfficial) return res.status(403).json({ error: 'Доступ заборонено' });

    try {
      const target = await prisma.player.findUnique({ where: { uid: targetUid } });
      if (!target) return res.status(404).json({ error: 'Гравець не знайдений' });

      let businesses = (target.businesses as any[]) || [];
      const bizIdx = businesses.findIndex(b => b.businessId === businessId);
      if (bizIdx === -1) return res.status(404).json({ error: 'Бізнес не знайдений' });

      businesses[bizIdx].isBlocked = block;

      await prisma.player.update({
        where: { uid: targetUid },
        data: { businesses }
      });

      await prisma.notification.create({
        data: {
          userId: targetUid,
          title: block ? '🚫 БІЗНЕС ЗАБЛОКОВАНО' : '✅ БІЗНЕС РОЗБЛОКОВАНО',
          message: block ? `Ваш бізнес "${businesses[bizIdx].name || businessId}" тимчасово заблоковано державою.` : `Ваш бізнес "${businesses[bizIdx].name || businessId}" розблоковано. Ви можете знову збирати прибуток.`,
          type: block ? 'alert' : 'success'
        }
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // RADA: Apply Bonus or Fine
  app.post('/api/rada/action', authenticateToken, async (req: any, res) => {
    const { actionType, targetId, amount, reason } = req.body;
    const isMinFin = req.dbUser?.status === 'Міністр фінансів' || req.dbUser?.role === 'admin' || req.dbUser?.status === 'Президент';
    if (!isMinFin) return res.status(403).json({ error: 'Немає повноважень' });

    try {
      if (actionType === 'bonus') {
        const target = await prisma.player.findUnique({ where: { uid: targetId } });
        if (!target) return res.status(404).json({ error: 'Ціль не знайдена' });

        await prisma.player.update({
          where: { uid: targetId },
          data: { balance: { increment: amount } }
        });

        await prisma.systemConfig.update({
          where: { id: 'global' },
          data: { budget: { decrement: amount } }
        });

        await prisma.notification.create({
          data: {
            userId: targetId,
            title: '💰 ПРЕМІЯ ВІД УРЯДУ',
            message: `Вам нараховано ₴${amount.toLocaleString()}! Причина: ${reason}`,
            type: 'success'
          }
        });
      } else if (actionType === 'fine') {
        await prisma.fine.create({
          data: {
            userId: targetId,
            amount,
            reason: reason,
            deadline: new Date(Date.now() + 24 * 3600000).toISOString()
          }
        });
        
        await prisma.notification.create({
          data: {
            userId: targetId,
            title: '⚖️ ШТРАФ ВІД УРЯДУ',
            message: `Вам виписано штраф ₴${amount.toLocaleString()}! Причина: ${reason}`,
            type: 'error'
          }
        });
      }

      await prisma.globalEvent.create({
        data: {
          type: 'rada',
          message: `[УРЯД] Дія ${actionType} для ${targetId}. Сума: ₴${amount}. ${reason}`,
          player: req.dbUser.firstName
        }
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // RADA: Sync State (For common values like tax rate and budget)
  app.get('/api/game-state', async (req, res) => {
    try {
      const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
      if (config) {
        globalGameState.taxRate = config.taxRate;
        globalGameState.stateBudget = config.budget;
      }
      res.json({
        ...globalGameState,
        taxRate: globalGameState.taxRate,
        stateBudget: globalGameState.stateBudget
      });
    } catch (e: any) {
      res.json(globalGameState);
    }
  });

  // RADA: Fetch Players for Fraction Work
  app.get('/api/players/all', authenticateToken, async (req: any, res) => {
     try {
       const users = await prisma.player.findMany({
         select: {
           uid: true,
           firstName: true,
           lastName: true,
           status: true,
           socialRating: true,
           balance: true,
           businesses: true
         }
       });
       res.json(users);
     } catch (e: any) {
       res.status(500).json({ error: e.message });
     }
  });

  // Business: Collect Profit (The Logic Hub for Taxes and Crime)
  app.post('/api/business/collect', authenticateToken, async (req: any, res) => {
    const { businessId, amount, payTax } = req.body;
    try {
      const user = await prisma.player.findUnique({ where: { uid: req.user.uid } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      let businesses = (user.businesses as any[]) || [];
      const bizIdx = businesses.findIndex(b => b.businessId === businessId);
      if (bizIdx === -1) return res.status(404).json({ error: 'Business not found' });

      // Refresh in-memory tax rate from DB/Global
      const taxRate = globalGameState.taxRate;
      const taxAmount = payTax ? Math.floor(amount * taxRate) : 0;
      const netProfit = amount - taxAmount;

      // Update Business State
      businesses[bizIdx].lastProfitAt = new Date().toISOString();
      businesses[bizIdx].isStocked = false; // Stock consumed
      
      if (!payTax) {
        businesses[bizIdx].taxEvasionCount = (businesses[bizIdx].taxEvasionCount || 0) + 1;
      } else {
        businesses[bizIdx].taxEvasionCount = 0; 
      }

      // Update Global Budget (Online sync)
      if (payTax && taxAmount > 0) {
        globalGameState.stateBudget += taxAmount;
        await prisma.systemConfig.update({
          where: { id: 'global' },
          data: { budget: { increment: taxAmount } }
        });
      }

      const updatedRating = payTax ? user.socialRating + 5 : user.socialRating - 25;

      await prisma.player.update({
        where: { uid: req.user.uid },
        data: {
          balance: { increment: netProfit },
          socialRating: updatedRating,
          businesses: businesses
        }
      });

      // Mafia Alert if many evasions
      if (businesses[bizIdx].taxEvasionCount >= 5) {
         await prisma.globalEvent.create({
           data: {
             type: 'mafia',
             message: `[ТІНЬ] Бізнес "${businesses[bizIdx].name}" (Власник: ${user.firstName}) приховує прибуток. Сім'я зверне на це увагу.`,
             player: 'Shadow'
           }
         });
      }

      res.json({ success: true, netProfit, taxPaid: taxAmount, newRating: updatedRating });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Business: Buy Mafia Protection (The Roof)
  app.post('/api/business/protect', authenticateToken, async (req: any, res) => {
    const { businessId } = req.body;
    try {
      const user = await prisma.player.findUnique({ where: { uid: req.user.uid } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      let businesses = (user.businesses as any[]) || [];
      const bizIdx = businesses.findIndex(b => b.businessId === businessId);
      if (bizIdx === -1) return res.status(404).json({ error: 'Business not found' });

      const protectionCost = 50000; // Flat fee for protection
      if (user.balance < protectionCost) return res.status(400).json({ error: 'Недостатньо коштів' });

      businesses[bizIdx].hasMafiaProtection = true;
      businesses[bizIdx].protectionLevel = 1;

      // Update Player
      await prisma.player.update({
        where: { uid: req.user.uid },
        data: {
          balance: { decrement: protectionCost },
          businesses: businesses
        }
      });

      // Notify Mafia Family & Send Percentage
      const mafiaBoss = await prisma.player.findFirst({
        where: { OR: [{ status: 'Дон (Бос мафії)' }, { role: 'mafia' }] },
        orderBy: { socialRating: 'asc' }
      });

      if (mafiaBoss) {
        const share = Math.floor(protectionCost * 0.5); // 50% goes to family
        await prisma.player.update({
          where: { uid: mafiaBoss.uid },
          data: { balance: { increment: share } }
        });

        await prisma.notification.create({
          data: {
            userId: mafiaBoss.uid,
            title: '💼 НОВИЙ ПІДПІЛЬНИЙ КОНТРАКТ',
            message: `Бізнес "${businesses[bizIdx].name}" (Власник: ${user.firstName}) купив кришу. До сімейної каси надійшло ₴${share.toLocaleString()}.`,
            type: 'mafia'
          }
        });
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // RADA: Shadow Audit
  app.post('/api/rada/audit', authenticateToken, async (req: any, res) => {
    const { targetUid } = req.body;
    const isVFB = req.dbUser?.status === 'Працівник ВФБ' || req.dbUser?.status === 'Міністр фінансів' || req.dbUser?.role === 'admin';
    if (!isVFB) {
      return res.status(403).json({ error: 'Доступ лише для працівників ВФБ та Міністра Фінансів' });
    }
    try {
      const target = await prisma.player.findUnique({ where: { uid: targetUid } });
      if (!target) return res.status(404).json({ error: 'Ціль не знайдена' });
      
      const businesses = (target.businesses as any[]) || [];
      const auditData = businesses.map(b => ({
        businessId: b.businessId,
        name: b.name || b.businessId,
        evasions: b.taxEvasionCount || b.evasions || 0,
        isBlocked: b.isBlocked || false,
        lastProfitAt: b.lastProfitAt,
        lastOpexAt: b.lastOpexAt,
        lastStockAt: b.stockPurchasedAt,
        purchasedAt: b.purchasedAt
      }));

      res.json({ success: true, targetName: `${target.firstName} ${target.lastName}`, auditData });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // RADA: Fire Employee
  app.post('/api/rada/fire', authenticateToken, async (req: any, res) => {
    const { targetUid, reason } = req.body;
    if (!req.dbUser || (req.dbUser.status !== 'Президент' && req.dbUser.role !== 'admin')) {
      return res.status(403).json({ error: 'Тільки Президент може звільняти працівників' });
    }
    try {
      const target = await prisma.player.findUnique({ where: { uid: targetUid } });
      const businesses = (target?.businesses as any[]) || [];
      const newStatus = resolveStatus(businesses, 'Громадянин');

      await prisma.player.update({
        where: { uid: targetUid },
        data: { status: newStatus, role: 'user' }
      });
      await prisma.notification.create({
        data: {
          userId: targetUid,
          title: 'Вас звільнено!',
          message: `Президент звільнив вас з посади. Причина: ${reason}`,
          type: 'alert'
        }
      });
      res.json({ success: true });
    } catch (e: any) {
       res.status(500).json({ error: e.message });
    }
  });

  // BANK: Perform Banking Action
  app.post('/api/bank/action', authenticateToken, async (req: any, res) => {
    const { actionType, targetId, amount, reason } = req.body;
    const isBanker = ['Голова Банку', 'Директор кредитного відділу', 'Керівник фінмоніторингу', 'Головний касир', 'Колектор банку'].includes(req.dbUser?.status || '') || req.dbUser?.role === 'admin';
    
    if (!isBanker) return res.status(403).json({ error: 'Доступ лише для співробітників Банку' });

    try {
      if (actionType === 'direct_payout' && targetId) {
        await prisma.player.update({ where: { uid: targetId }, data: { balance: { increment: amount } } });
      } else if (actionType === 'issue_loan' && targetId) {
        await prisma.player.update({ where: { uid: targetId }, data: { balance: { increment: amount } } });
      } else if (actionType === 'debt_notice' && targetId) {
        await prisma.fine.create({ 
          data: { userId: targetId, amount, reason: `Заборгованість по кредиту: ${reason}`, deadline: new Date(Date.now() + 24 * 3600000).toISOString() } 
        });
      }

      await prisma.globalEvent.create({
        data: { type: 'bank', message: `[БАНК] Виконано дію: ${actionType} для ${targetId || 'системи'}. Сума: ₴${amount || 0}. ${reason}`, player: req.dbUser.firstName }
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // MAFIA: Perform Action
  app.post('/api/mafia/action', authenticateToken, async (req: any, res) => {
    const { actionType, targetId, reason } = req.body;
    const isMafia = ['Дон (Бос мафії)', 'Консильєрі (Радник)', 'Капо (Капітан)', 'Бойовик (Силовик)'].includes(req.dbUser?.status || '') || req.dbUser?.role === 'admin';

    if (!isMafia) return res.status(403).json({ error: 'Ви не належите до сім\'ї' });

    try {
      await prisma.globalEvent.create({
        data: { type: 'mafia', message: `[МАФІЯ] Наказ: ${actionType} проти ${targetId || 'невідомо'}. Обґрунтування: ${reason}`, player: 'Shadow' }
      });
      if (targetId) {
        await prisma.notification.create({
          data: { userId: targetId, title: 'Ви під прицілом!', message: 'Ви відчуваєте на собі погляди людей у чорному...', type: 'alert' }
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // MAFIA: Get Targets (Evasion List)
  app.get('/api/mafia/targets', authenticateToken, async (req, res) => {
    try {
      const users = await prisma.player.findMany({
        where: { businesses: { not: [] as any } }
      });
      const targets: any[] = [];
      users.forEach(u => {
        const bz = (u.businesses as any[]) || [];
        bz.forEach(b => {
          if ((b.taxEvasionCount || 0) >= 5) {
            targets.push({
              id: b.businessId || b.name,
              name: b.name || b.businessId,
              ownerName: `${u.firstName} ${u.lastName}`,
              ownerUid: u.uid,
              evasions: b.taxEvasionCount || 0
            });
          }
        });
      });
      res.json(targets.sort((a, b) => b.evasions - a.evasions));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // MAFIA: Fire Member
  app.post('/api/mafia/fire', authenticateToken, async (req: any, res) => {
    const { targetUid, reason } = req.body;
    if (!req.dbUser || (req.dbUser.status !== 'Дон (Бос мафії)' && req.dbUser.role !== 'admin')) {
      return res.status(403).json({ error: 'Тільки Дон може виганяти з сім\'ї' });
    }
    try {
      const target = await prisma.player.findUnique({ where: { uid: targetUid } });
      const businesses = (target?.businesses as any[]) || [];
      const newStatus = resolveStatus(businesses, 'Громадянин');

      await prisma.player.update({
        where: { uid: targetUid },
        data: { status: newStatus, role: 'user' }
      });
      await prisma.notification.create({
        data: {
          userId: targetUid,
          title: 'Вас вигнано!',
          message: `Вас було виключено з мафіозної сім'ї. Причина: ${reason}`,
          type: 'alert'
        }
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  app.post('/api/presence/:uid', authenticateToken, async (req: any, res) => {
    try {
      // The uid from path should match the authenticated user
      if (req.params.uid !== req.user.uid) {
        return res.status(403).json({ error: 'Identity mismatch' });
      }

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

  // Catch-all for API routes to never return HTML 404
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

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
