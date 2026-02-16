#!/usr/bin/env node
import { rmSync, existsSync } from 'node:fs';

const path = process.env.LMDB_PATH ?? './data';

if (existsSync(path)) {
  rmSync(path, { recursive: true, force: true });
  console.log(`Cleared DB at ${path}`);
} else {
  console.log(`No DB at ${path} (nothing to clear)`);
}
