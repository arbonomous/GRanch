import { execSync } from 'node:child_process';

function run(cmd, extraEnv = {}) {
  console.log(`[GRanch Cloud Prepare] Running: ${cmd}`);
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
}

// Always generate Prisma client for the target platform
run('npx prisma generate');

// Prefer unpooled/direct URL for schema push (Neon / Vercel Postgres / Supabase)
const pushUrl = (
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  ''
).trim();

const isPostgres =
  pushUrl.startsWith('postgres://') || pushUrl.startsWith('postgresql://');

if (!isPostgres) {
  console.log(
    '[GRanch Cloud Prepare] No PostgreSQL DATABASE_URL detected during build; skipping db push & seed.'
  );
  process.exit(0);
}

// Push relational schema automatically on cloud deploy
run('npx prisma db push --skip-generate', { DATABASE_URL: pushUrl });

// Seed sample ranch data ONLY if the database is currently empty (unless disabled)
if (process.env.SEED_ON_EMPTY !== 'false') {
  run('npx tsx prisma/seed.ts --if-empty', { DATABASE_URL: pushUrl });
}
