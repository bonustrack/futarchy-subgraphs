/**
 * Patch Checkpoint's container.js to increase block range constants.
 * 
 * Default values cause tiny ranges in dense areas:
 *   BLOCK_PRELOAD_START_RANGE = 1000  → starts with 1000-block ranges
 *   BLOCK_PRELOAD_TARGET = 10         → shrinks range when >10 events found
 *   BLOCK_PRELOAD_STEP = 100          → adjusts by 100 blocks
 *   BLOCK_RELOAD_MIN_RANGE = 10       → minimum 10-block range
 * 
 * Patched values reduce RPC calls by processing larger ranges:
 *   BLOCK_PRELOAD_START_RANGE = 5000  → start with 5000-block ranges
 *   BLOCK_PRELOAD_TARGET = 100        → allow 100 events before shrinking
 *   BLOCK_PRELOAD_STEP = 500          → adjust faster
 *   BLOCK_RELOAD_MIN_RANGE = 100      → minimum 100-block range
 */

const fs = require('fs');
const path = require('path');

const containerPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@snapshot-labs',
    'checkpoint',
    'dist',
    'src',
    'container.js'
);

let code = fs.readFileSync(containerPath, 'utf-8');

const replacements = [
    ['const BLOCK_PRELOAD_START_RANGE = 1000;', 'const BLOCK_PRELOAD_START_RANGE = 5000;'],
    ['const BLOCK_RELOAD_MIN_RANGE = 10;', 'const BLOCK_RELOAD_MIN_RANGE = 100;'],
    ['const BLOCK_PRELOAD_STEP = 100;', 'const BLOCK_PRELOAD_STEP = 500;'],
    ['const BLOCK_PRELOAD_TARGET = 10;', 'const BLOCK_PRELOAD_TARGET = 100;'],
];

let patched = 0;
for (const [from, to] of replacements) {
    if (code.includes(from)) {
        code = code.replace(from, to);
        console.log(`  ✅ ${from.split('=')[0].trim()}: ${from.split('=')[1].trim()} → ${to.split('=')[1].trim()}`);
        patched++;
    } else {
        console.log(`  ⚠️  Not found: ${from}`);
    }
}

if (patched > 0) {
    fs.writeFileSync(containerPath, code);
    console.log(`\n✅ Patched ${patched} block range constants in container.js`);
} else {
    console.log('\n❌ No patches applied');
    process.exit(1);
}
