import { spawnSync } from 'child_process';

const dbUrl = process.env.DATABASE_URL || process.env['URL-адреса_БАЗИ_ДАНИХ'] || process.env['ПУБЛІЧНА_URL-АДРЕСА_БАЗИ_ДАНИХ'];
if (dbUrl && (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'placeholder')) {
  process.env.DATABASE_URL = dbUrl;
  console.log('[STARTUP] Setting DATABASE_URL from Railway alias');
}

if (process.env.DATABASE_URL) {
  try {
    console.log('[STARTUP] Syncing database schema with Prisma...');
    // We use npx to run prisma from local node_modules
    const push = spawnSync('npx', ['prisma', 'db', 'push', '--accept-data-loss'], { 
      stdio: 'inherit', 
      env: { ...process.env, DEBUG: 'prisma:client,prisma:engine' },
      shell: true 
    });
    if (push.status !== 0) {
      console.warn('[STARTUP] Prisma db push finished with non-zero status:', push.status);
      if (push.error) console.error('[STARTUP] Prisma push error:', push.error);
    } else {
      console.log('[STARTUP] Prisma schema sync successful.');
    }
  } catch (e) {
    console.error('[STARTUP] Failed to run prisma db push:', e);
  }
} else {
  console.warn('[STARTUP] No DATABASE_URL found. Skipping schema sync.');
}

console.log('[STARTUP] Starting the main server...');
spawnSync('npx', ['tsx', 'server.ts'], { 
  stdio: 'inherit', 
  env: process.env,
  shell: true 
});
