import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Each suite gets its own database before any application modules are loaded.
// Tests must never open the developer's or production's database.
process.env.CHESSTONG_DATA_DIR = mkdtempSync(join(tmpdir(), 'chesstong-test-'));
