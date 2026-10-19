/**
 * Runs the SQL test suite (tests/db/*.sql) against a throwaway database.
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createTestDb } from '../tests/support/testdb';

const dir = join(__dirname, '..', 'tests', 'db');
const files = readdirSync(dir)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort();

const db = createTestDb();
let passed = 0;
let failed = 0;
try {
  for (const f of files) {
    const res = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', db.url, '-f', join(dir, f)], {
      encoding: 'utf8',
    });
    const oks = (res.stderr.match(/NOTICE:\s+ok - .*/g) ?? []).map((l) => l.replace(/.*NOTICE:\s+/, ''));
    passed += oks.length;
    if (res.status === 0) {
      console.log(`✔ ${f} (${oks.length} assertions)`);
    } else {
      failed++;
      console.log(`✘ ${f} (${oks.length} passed before failure)`);
      const err = res.stderr.split('\n').filter((l) => /ERROR|FAIL|CONTEXT/.test(l));
      console.log('  ' + err.join('\n  '));
    }
  }
} finally {
  db.drop();
}
console.log(`\n${passed} assertions passed, ${failed} file(s) failed`);
process.exit(failed ? 1 : 0);
