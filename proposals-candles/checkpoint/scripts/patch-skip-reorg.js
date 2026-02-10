/**
 * Skip reorg detection during initial sync.
 * 
 * When far behind chain head (>1000 blocks), reorg detection is pointless —
 * those blocks are already finalized. Skipping getBlockHash() per block
 * eliminates 1 RPC call per block = ~2x speed improvement.
 * 
 * Smart logic:
 *   - If gap > SKIP_REORG_THRESHOLD (default 1000): skip parentHash check
 *   - If gap <= SKIP_REORG_THRESHOLD: normal reorg detection (near head)
 *   - Works per-indexer since each has its own Container instance
 * 
 * Env vars:
 *   SKIP_REORG_THRESHOLD: blocks behind before skipping (default: 1000)
 */

const fs = require('fs');
const path = require('path');

const containerPath = path.join(
    __dirname, '..', 'node_modules', '@snapshot-labs', 'checkpoint',
    'dist', 'src', 'container.js'
);

let code = fs.readFileSync(containerPath, 'utf-8');
let patched = 0;

// Add SKIP_REORG_THRESHOLD constant
const anchor = 'const BLOCK_PRELOAD_OFFSET = 50;';
const newConst = `const BLOCK_PRELOAD_OFFSET = 50;
const SKIP_REORG_THRESHOLD = parseInt(process.env.SKIP_REORG_THRESHOLD || '1000');`;

if (code.includes(anchor) && !code.includes('SKIP_REORG_THRESHOLD')) {
    code = code.replace(anchor, newConst);
    console.log('  ✅ Added SKIP_REORG_THRESHOLD constant');
    patched++;
} else if (code.includes('SKIP_REORG_THRESHOLD')) {
    console.log('  ⚠️  SKIP_REORG_THRESHOLD already exists');
}

// Replace the parentHash + processBlock section
// Original:
//   const parentHash = await this.getBlockHash(blockNumber - 1);
//   const nextBlockNumber = await this.indexer
//       .getProvider()
//       .processBlock(blockNumber, parentHash);
//
// New: skip parentHash when far behind
const oldProcess = `                const parentHash = await this.getBlockHash(blockNumber - 1);
                const nextBlockNumber = await this.indexer
                    .getProvider()
                    .processBlock(blockNumber, parentHash);`;

const newProcess = `                // Skip reorg detection when far behind chain head (saves 1 RPC/block)
                let parentHash = null;
                const behindBy = (this.preloadEndBlock || 0) - blockNumber;
                if (behindBy <= SKIP_REORG_THRESHOLD) {
                    parentHash = await this.getBlockHash(blockNumber - 1);
                }
                const nextBlockNumber = await this.indexer
                    .getProvider()
                    .processBlock(blockNumber, parentHash);`;

if (code.includes(oldProcess)) {
    code = code.replace(oldProcess, newProcess);
    console.log('  ✅ Patched process loop to skip reorg check when syncing');
    patched++;
} else {
    console.log('  ❌ Process loop pattern not found');
}

// Also need to handle the ReorgDetectedError — when parentHash is null,
// the provider should skip the reorg check entirely.
// Let's patch processBlock to accept null parentHash gracefully.
const providerPath = path.join(
    __dirname, '..', 'node_modules', '@snapshot-labs', 'checkpoint',
    'dist', 'src', 'providers', 'evm', 'provider.js'
);
let providerCode = fs.readFileSync(providerPath, 'utf-8');
let providerPatched = 0;

// Find the parentHash check in processBlock
// Look for: if (block.parentHash !== parentBlockHash)
const oldReorgCheck = `if (block.parentHash !== parentBlockHash)`;
const newReorgCheck = `if (parentBlockHash && block.parentHash !== parentBlockHash)`;

if (providerCode.includes(oldReorgCheck) && !providerCode.includes('parentBlockHash && block.parentHash')) {
    providerCode = providerCode.replace(oldReorgCheck, newReorgCheck);
    fs.writeFileSync(providerPath, providerCode);
    console.log('  ✅ Patched processBlock to accept null parentHash (skip reorg)');
    providerPatched++;
} else if (providerCode.includes('parentBlockHash && block.parentHash')) {
    console.log('  ⚠️  processBlock already handles null parentHash');
} else {
    console.log('  ❌ parentHash check not found in provider.js');
}

if (patched > 0) {
    fs.writeFileSync(containerPath, code);
    console.log(`\n✅ Applied ${patched} container patches + ${providerPatched} provider patches`);
    console.log('   Reorg detection skipped when > SKIP_REORG_THRESHOLD blocks behind');
    console.log('   Re-enables automatically near chain head');
} else {
    console.log('\n⚠️  No container patches applied');
}
