/**
 * Throwaway PostgreSQL databases for integration tests.
 *
 * Needs `psql` on PATH and TEST_DATABASE_URL pointing at any Postgres server
 * where the user may CREATE DATABASE (local Postgres, or `supabase start`:
 * postgresql://postgres:postgres@127.0.0.1:54322/postgres).
 * A fresh database is created per run, migrated, and dropped afterwards.
 * Nothing touches your real project data.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const ROOT = join(__dirname, '..', '..');

export function baseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Example: postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    );
  }
  if (/supabase\.(co|com)/.test(url)) {
    throw new Error('Refusing to run tests against a hosted Supabase project. Use a local database.');
  }
  return url;
}

function withDb(url: string, db: string): string {
  const u = new URL(url);
  u.pathname = '/' + db;
  return u.toString();
}

export function psql(url: string, sql: string, opts: { file?: string; quiet?: boolean } = {}): string {
  const args = ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', url];
  if (opts.file) args.push('-f', opts.file);
  else args.push('-c', sql);
  const res = spawnSync('psql', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const err = new Error((res.stderr || res.stdout || 'psql failed').trim());
    (err as Error & { stderr?: string }).stderr = res.stderr;
    throw err;
  }
  return res.stdout;
}

export function migrationFiles(): string[] {
  const dir = join(ROOT, 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(dir, f));
}

export interface TestDb {
  url: string;
  name: string;
  drop(): void;
}

export function createTestDb(opts: { seed?: boolean } = {}): TestDb {
  const admin = baseUrl();
  const name = 'gtc_test_' + randomBytes(5).toString('hex');
  psql(admin, `create database ${name}`);
  const url = withDb(admin, name);
  try {
    psql(url, `alter database ${name} set app.allow_time_travel = 'on'`);
    psql(url, '', { file: join(ROOT, 'tests', 'support', 'supabase-shim.sql') });
    for (const f of migrationFiles()) psql(url, '', { file: f });
    psql(url, '', { file: join(ROOT, 'tests', 'db', '_helpers.sql') });
    if (opts.seed) psql(url, '', { file: join(ROOT, 'supabase', 'seed.sql') });
  } catch (e) {
    psql(admin, `drop database if exists ${name} with (force)`);
    throw e;
  }
  return {
    url,
    name,
    drop() {
      psql(admin, `drop database if exists ${name} with (force)`);
    },
  };
}
