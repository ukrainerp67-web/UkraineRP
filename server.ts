import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('game.db');

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT,
    firstName TEXT,
    lastName TEXT,
    sex TEXT,
    birthDate TEXT,
    passportPhoto TEXT,
    signature TEXT,
    balance INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'Громадянин',
    socialRating INTEGER DEFAULT 50,
    occupation TEXT,
    businesses TEXT DEFAULT '[]',
    bankCards TEXT DEFAULT '[]',
    properties TEXT DEFAULT '[]',
    inventory TEXT DEFAULT '[]',
    lastPayDay TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// Migration: Add columns if they don't exist
try {
    db.prepare("ALTER TABLE users ADD COLUMN sex TEXT").run();
} catch (e) {}
try {
    db.prepare("ALTER TABLE users ADD COLUMN birthDate TEXT").run();
} catch (e) {}
try {
    db.prepare("ALTER TABLE users ADD COLUMN passportPhoto TEXT").run();
} catch (e) {}
try {
    db.prepare("ALTER TABLE users ADD COLUMN signature TEXT").run();
} catch (e) {}
try {
    db.prepare("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Громадянин'").run();
} catch (e) {}
try {
    db.prepare("ALTER TABLE users ADD COLUMN isVerified INTEGER DEFAULT 0").run();
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS system_config (
    id TEXT PRIMARY KEY,
    budget INTEGER DEFAULT 1000000,
    taxRate REAL DEFAULT 0.20,
    trustRating INTEGER DEFAULT 60,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS global_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    message TEXT,
    player TEXT,
    timestamp TEXT
  );

  CREATE TABLE IF NOT EXISTS fines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    amount INTEGER,
    reason TEXT,
    issuedAt TEXT,
    deadline TEXT,
    status TEXT DEFAULT 'pending',
    paidAt TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    title TEXT,
    message TEXT,
    type TEXT,
    read INTEGER DEFAULT 0,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS presence (
    uid TEXT PRIMARY KEY,
    lastActive TEXT,
    status TEXT DEFAULT 'online'
  );

  INSERT OR IGNORE INTO system_config (id, budget, taxRate, trustRating, updatedAt) 
  VALUES ('global', 1000000, 0.20, 60, datetime('now'));
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());

  // --- API Routes ---

  // Auth & Profile
  app.get('/api/profile/:uid', (req, res) => {
    const uid = req.params.uid;
    console.log(`[PROFILE] Fetching for UID: ${uid}`);
    const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
    
    if (!user) {
      console.log(`[PROFILE] User ${uid} NOT FOUND in database`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[PROFILE] Found user ${user.firstName} ${user.lastName} (Role: ${user.role}, Status: ${user.status}, Verified: ${user.isVerified})`);
    res.json({
      ...user,
      bankCards: JSON.parse(user.bankCards || '[]'),
      businesses: JSON.parse(user.businesses || '[]'),
      properties: JSON.parse(user.properties || '[]'),
      inventory: JSON.parse(user.inventory || '[]'),
      isFrozen: !!user.isFrozen,
      isVerified: !!user.isVerified
    });
  });

  app.post('/api/profile', (req, res) => {
    const { uid, email, firstName, lastName, sex, birthDate, passportPhoto, signature, role, status, balance, socialRating, bankCards, businesses, isVerified } = req.body;
    console.log(`[PROFILE] Creating/Updating user: ${uid} (${email})`);
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO users (uid, email, firstName, lastName, sex, birthDate, passportPhoto, signature, role, status, balance, socialRating, bankCards, businesses, isVerified, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET
        email=excluded.email,
        firstName=excluded.firstName,
        lastName=excluded.lastName,
        sex=excluded.sex,
        birthDate=excluded.birthDate,
        passportPhoto=excluded.passportPhoto,
        signature=excluded.signature,
        role=excluded.role,
        status=excluded.status,
        balance=excluded.balance,
        socialRating=excluded.socialRating,
        bankCards=excluded.bankCards,
        businesses=excluded.businesses,
        isVerified=excluded.isVerified,
        updatedAt=excluded.updatedAt
    `);

    try {
      stmt.run(
        uid, email, firstName, lastName, sex, birthDate, passportPhoto, signature, role || 'user', status || 'Громадянин', balance || 5000, socialRating || 50,
        JSON.stringify(bankCards || []), JSON.stringify(businesses || []),
        isVerified ? 1 : 0,
        now, now
      );
      console.log(`[PROFILE] Successfully saved user: ${uid}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[PROFILE] Error saving user ${uid}:`, error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch('/api/profile/:uid', (req, res) => {
    const updates = req.body;
    const uid = req.params.uid;
    console.log(`[PROFILE] Patching user ${uid}:`, Object.keys(updates));
    const now = new Date().toISOString();

    const allowedFields = ['balance', 'role', 'status', 'socialRating', 'businesses', 'bankCards', 'properties', 'inventory', 'lastPayDay', 'firstName', 'lastName', 'sex', 'birthDate', 'passportPhoto', 'signature', 'isVerified', 'isFrozen', 'freezeUntil', 'freezeReason', 'muteUntil'];
    const keys = Object.keys(updates).filter(k => allowedFields.includes(k));
    
    if (keys.length === 0) return res.json({ success: true });

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => typeof updates[k] === 'object' ? JSON.stringify(updates[k]) : updates[k]);
    values.push(now, uid);

    db.prepare(`UPDATE users SET ${setClause}, updatedAt = ? WHERE uid = ?`).run(...values);
    res.json({ success: true });
  });

  // Global State
  app.get('/api/system/global', (req, res) => {
    const state = db.prepare("SELECT * FROM system_config WHERE id = 'global'").get();
    res.json(state);
  });

  app.patch('/api/system/global', (req, res) => {
    const { budget, taxRate, trustRating } = req.body;
    const now = new Date().toISOString();
    
    const fields = [];
    const values = [];
    if (budget !== undefined) { fields.push('budget = budget + ?'); values.push(budget); }
    if (taxRate !== undefined) { fields.push('taxRate = ?'); values.push(taxRate); }
    if (trustRating !== undefined) { fields.push('trustRating = ?'); values.push(trustRating); }
    
    if (fields.length === 0) return res.json({ success: true });
    
    values.push(now);
    db.prepare(`UPDATE system_config SET ${fields.join(', ')}, updatedAt = ? WHERE id = 'global'`).run(...values);
    res.json({ success: true });
  });

  // Events
  app.get('/api/events', (req, res) => {
    const events = db.prepare('SELECT * FROM global_events ORDER BY id DESC LIMIT 50').all();
    res.json(events);
  });

  app.post('/api/events', (req, res) => {
    const { type, message, player } = req.body;
    db.prepare('INSERT INTO global_events (type, message, player, timestamp) VALUES (?, ?, ?, ?)')
      .run(type, message, player, new Date().toISOString());
    res.json({ success: true });
  });

  // Notifications
  app.get('/api/users/:uid/notifications', (req, res) => {
    const notifications = db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY id DESC').all(req.params.uid);
    res.json(notifications);
  });

  app.post('/api/users/:uid/notifications', (req, res) => {
    const { title, message, type } = req.body;
    db.prepare('INSERT INTO notifications (userId, title, message, type, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(req.params.uid, title, message, type, new Date().toISOString());
    res.json({ success: true });
  });

  app.patch('/api/notifications/:id/read', (req, res) => {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Messages / Chat
  app.get('/api/messages', (req, res) => {
    const messages = db.prepare("SELECT * FROM global_events WHERE type = 'chat' ORDER BY id DESC LIMIT 100").all();
    res.json(messages.reverse());
  });

  app.post('/api/messages', (req, res) => {
    const { player, message } = req.body;
    db.prepare("INSERT INTO global_events (type, message, player, timestamp) VALUES ('chat', ?, ?, ?)")
      .run(message, player, new Date().toISOString());
    res.json({ success: true });
  });

  // Transfer Money (Atomic)
  app.post('/api/transfer', (req, res) => {
    const { fromId, toId, amount } = req.body;
    
    const transfer = db.transaction(() => {
      const fromUser = db.prepare('SELECT balance FROM users WHERE uid = ?').get(fromId);
      const toUser = db.prepare('SELECT balance FROM users WHERE uid = ?').get(toId);

      if (!fromUser || !toUser) throw new Error('User not found');
      if (fromUser.balance < amount) throw new Error('Insufficient funds');

      db.prepare('UPDATE users SET balance = balance - ? WHERE uid = ?').run(amount, fromId);
      db.prepare('UPDATE users SET balance = balance + ? WHERE uid = ?').run(amount, toId);
      
      return true;
    });

    try {
      transfer();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/users/:uid/fines', (req, res) => {
    const { amount, reason, deadline } = req.body;
    db.prepare('INSERT INTO fines (userId, amount, reason, issuedAt, deadline, status) VALUES (?, ?, ?, ?, ?, "pending")')
      .run(req.params.uid, amount, reason, new Date().toISOString(), deadline);
    res.json({ success: true });
  });

  app.patch('/api/fines/:id', (req, res) => {
    const { status } = req.body;
    const now = new Date().toISOString();
    db.prepare('UPDATE fines SET status = ?, paidAt = ? WHERE id = ?').run(status, status === 'paid' ? now : null, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/system/distribute', (req, res) => {
    const { amount, type } = req.body;
    
    const distribution = db.transaction(() => {
      const system = db.prepare("SELECT budget FROM system_config WHERE id = 'global'").get();
      const players = db.prepare('SELECT uid, bankCards FROM users').all();
      
      let count = 0;
      players.forEach(p => {
        const cards = JSON.parse(p.bankCards || '[]');
        // Match specific card type
        const cardType = type === 'support' ? 'e-support' : 'pension';
        const cardIdx = cards.findIndex((c: any) => c.type === cardType);
        
        if (cardIdx !== -1) {
          const totalDist = amount;
          if (system.budget >= totalDist) {
            cards[cardIdx].balance += totalDist;
            db.prepare('UPDATE users SET bankCards = ? WHERE uid = ?').run(JSON.stringify(cards), p.uid);
            db.prepare("UPDATE system_config SET budget = budget - ? WHERE id = 'global'").run(totalDist);
            system.budget -= totalDist;
            count++;
            
            // Notify
            db.prepare('INSERT INTO notifications (userId, title, message, type, createdAt) VALUES (?, ?, ?, ?, ?)')
              .run(p.uid, type === 'support' ? '🇺🇦 Є-Підтримка' : '🎖️ Пенсія', `Вам нараховано соціальну виплату: ₴${amount.toLocaleString()}`, 'money', new Date().toISOString());
          }
        }
      });
      return count;
    });

    try {
      const count = distribution();
      res.json({ success: true, count });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Online Players
  app.get('/api/online', (req, res) => {
    const online = db.prepare(`
      SELECT u.* FROM users u 
      JOIN presence p ON u.uid = p.uid 
      WHERE p.status = 'online'
      AND p.lastActive > datetime('now', '-30 seconds')
    `).all();
    
    res.json(online.map(u => ({
      ...u,
      businesses: JSON.parse(u.businesses || '[]'),
      bankCards: JSON.parse(u.bankCards || '[]')
    })));
  });

  app.delete('/api/profile/:uid', (req, res) => {
    const uid = req.params.uid;
    db.prepare('DELETE FROM users WHERE uid = ?').run(uid);
    db.prepare('DELETE FROM presence WHERE uid = ?').run(uid);
    db.prepare('DELETE FROM notifications WHERE userId = ?').run(uid);
    db.prepare('DELETE FROM fines WHERE userId = ?').run(uid);
    res.json({ success: true });
  });

  app.get('/api/users/:uid/fines', (req, res) => {
    const fines = db.prepare('SELECT * FROM fines WHERE userId = ? ORDER BY issuedAt DESC').all(req.params.uid);
    res.json(fines);
  });

  app.post('/api/presence/:uid', (req, res) => {
    db.prepare("INSERT INTO presence (uid, lastActive, status) VALUES (?, datetime('now'), 'online') ON CONFLICT(uid) DO UPDATE SET lastActive = datetime('now'), status = 'online'")
      .run(req.params.uid);
    res.json({ success: true });
  });

  // --- Background Jobs ---
  setInterval(() => {
    // Tax collection from businesses
    const users = db.prepare('SELECT uid, businesses FROM users').all();
    const system = db.prepare("SELECT taxRate FROM system_config WHERE id = 'global'").get();
    let totalTaxCollected = 0;

    users.forEach(user => {
      const businesses = JSON.parse(user.businesses || '[]');
      let userTax = 0;
      businesses.forEach((b: any) => {
        if (!b.isBlocked) {
          const profit = Math.floor(Math.random() * 500) + 100; // Mock profit per cycle
          const tax = Math.floor(profit * system.taxRate);
          userTax += tax;
        }
      });
      totalTaxCollected += userTax;
    });

    if (totalTaxCollected > 0) {
      db.prepare("UPDATE system_config SET budget = budget + ? WHERE id = 'global'").run(totalTaxCollected);
    }
  }, 60000); // Every minute

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
