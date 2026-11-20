import { execSync } from 'node:child_process';

function run(cmd) {
  console.log(`[GRanch Cloud Prepare] Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

// Always generate Prisma client for the target platform
run('npx prisma generate');

const dbUrl = (process.env.DATABASE_URL || '').trim();
const isPostgres =
  dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

if (!isPostgres) {
  console.log(
    '[GRanch Cloud Prepare] No PostgreSQL DATABASE_URL detected during build; skipping db push & seed.'
  );
  process.exit(0);
}

// Push relational schema automatically on cloud deploy
run('npx prisma db push --skip-generate');

// Seed sample ranch data ONLY if the database is currently empty (unless disabled)
if (process.env.SEED_ON_EMPTY !== 'false') {
  run('npx tsx prisma/seed.ts --if-empty');
}
