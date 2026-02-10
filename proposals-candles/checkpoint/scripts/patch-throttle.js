/**
 * Add a configurable throttle to block processing.
 * 
 * BLOCK_PROCESS_DELAY_MS: milliseconds to wait between processing each block.
 * This controls the RPC request rate since each block = ~1 getBlock RPC call.
 * 
 * Sweet spot math:
 *   PublicNode allows ~50 req/s
 *   Each block: 1 getBlock + occasional getLogs = ~1.2 calls
 *   Target: 40 blk/s = 25ms delay
 *   Safe:   30 blk/s = 33ms delay
 */

const fs = require('fs');
const path = require('path');

const containerPath = path.join(
    __dirname, '..', 'node_modules', '@snapshot-labs', 'checkpoint',
    'dist', 'src', 'container.js'
);

let code = fs.readFileSync(containerPath, 'utf-8');
let patched = 0;

// Add the delay constant at the top, after the other constants
const oldConst = "const DEFAULT_FETCH_INTERVAL = 2000;";
const newConst = `const DEFAULT_FETCH_INTERVAL = 2000;
const BLOCK_PROCESS_DELAY = parseInt(process.env.BLOCK_PROCESS_DELAY_MS || '0');`;

if (code.includes(oldConst) && !code.includes('BLOCK_PROCESS_DELAY')) {
    code = code.replace(oldConst, newConst);
    console.log('  ✅ Added BLOCK_PROCESS_DELAY constant');
    patched++;
} else if (code.includes('BLOCK_PROCESS_DELAY')) {
    console.log('  ⚠️  BLOCK_PROCESS_DELAY already exists');
} else {
    console.log('  ❌ DEFAULT_FETCH_INTERVAL not found');
}

// Add delay after successful block processing in the process() loop
// Target: right after `blockNumber = nextBlockNumber;` in the try block
const oldSuccess = `                const sources = this.getCurrentSources(nextBlockNumber);
                if (initialSources.length !== sources.length) {
                    this.preloadedBlocks = [];
                }
                blockNumber = nextBlockNumber;`;

const newSuccess = `                const sources = this.getCurrentSources(nextBlockNumber);
                if (initialSources.length !== sources.length) {
                    this.preloadedBlocks = [];
                }
                blockNumber = nextBlockNumber;
                if (BLOCK_PROCESS_DELAY > 0) {
                    await (0, helpers_1.sleep)(BLOCK_PROCESS_DELAY);
                }`;

if (code.includes(oldSuccess) && !code.includes('BLOCK_PROCESS_DELAY > 0')) {
    code = code.replace(oldSuccess, newSuccess);
    console.log('  ✅ Added throttle after block processing');
    patched++;
} else if (code.includes('BLOCK_PROCESS_DELAY > 0')) {
    console.log('  ⚠️  Throttle already added');
} else {
    console.log('  ❌ Block processing success pattern not found');
}

if (patched > 0) {
    fs.writeFileSync(containerPath, code);
    console.log(`\n✅ Applied ${patched} throttle patches to container.js`);
    console.log('   Set BLOCK_PROCESS_DELAY_MS env var to control delay (ms between blocks)');
} else {
    console.log('\n⚠️  No new patches applied (may already be patched)');
}
