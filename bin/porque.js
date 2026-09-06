#!/usr/bin/env node
import { run } from '../src/cli.js';

run(process.argv.slice(2)).then(
  (code) => process.exit(code ?? 0),
  (err) => {
    process.stderr.write(`porque: ${err?.message ?? err}\n`);
    if (process.env.PORQUE_DEBUG) console.error(err);
    process.exit(1);
  }
);
