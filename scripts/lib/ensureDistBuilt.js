#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Shared by scripts/*.js that import compiled TypeScript output
// (src/lib/** -> dist/lib/**, superseded the retired root lib/** as of
// the M1 in-process TypeScript port). dist/ is gitignored and not
// rebuilt by any test/lint script, so fail fast with an actionable
// message instead of a raw module-not-found error on a fresh clone (this
// does not detect a *stale* dist/ built before a later src/ edit - only
// that it exists at all).
const ensureDistBuilt = relativeDistPath => {
    const distFilePath = path.resolve(__dirname, '..', '..', relativeDistPath);

    if (!fs.existsSync(distFilePath)) {
        console.error(`Missing ${distFilePath} - run \`npm run build\` first.`);
        process.exit(1);
    }
};

module.exports = { ensureDistBuilt };
