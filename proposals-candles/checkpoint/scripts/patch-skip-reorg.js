/**
 * Comprehensive speed optimization patch for container.js
 * Brings Checkpoint closer to Graph-Node performance by:
 *
 * 1. SKIP REORG during sync (>1000 blocks behind)
 *    - Saves 1 RPC call per block (getBlockHash)
 * 
 * 2. BATCH BLOCK PREFETCH
 *    - After preload finds blocks with events, prefetch their block data
 *      in parallel (timestamps, hashes) instead of one-by-one
 *    - Stores in provider's blockCache for processBlock to use
 *
 * 3. BATCH setLastIndexedBlock
 *    - Only write to DB every N blocks instead of every block
 *    - Saves 1 DB write per block
 *
 * Env vars:
 *   SKIP_REORG_THRESHOLD: blocks behind before skipping reorg (default: 1000)
 *   BATCH_SET_INDEXED: write lastIndexedBlock every N blocks (default: 10)
 */

const fs = require('fs');
const path = require('path');

const containerPath = path.join(
    __dirname, '..', 'node_modules', '@snapshot-labs', 'checkpoint',
    'dist', 'src', 'container.js'
);

const providerPath = path.join(
    __dirname, '..', 'node_modules', '@snapshot-labs', 'checkpoint',
    'dist', 'src', 'providers', 'evm', 'provider.js'
);

let code = fs.readFileSync(containerPath, 'utf-8');
let providerCode = fs.readFileSync(providerPath, 'utf-8');
let containerPatches = 0;
let providerPatches = 0;

// ============================================================
// PATCH 1: Add constants
// ============================================================
const anchor = 'const BLOCK_PRELOAD_OFFSET = 50;';
const newConsts = `const BLOCK_PRELOAD_OFFSET = 50;
const SKIP_REORG_THRESHOLD = parseInt(process.env.SKIP_REORG_THRESHOLD || '1000');
const BATCH_SET_INDEXED = parseInt(process.env.BATCH_SET_INDEXED || '10');`;

if (code.includes(anchor) && !code.includes('SKIP_REORG_THRESHOLD')) {
    code = code.replace(anchor, newConsts);
    console.log('  ✅ PATCH 1a: Added SKIP_REORG_THRESHOLD + BATCH_SET_INDEXED constants');
    containerPatches++;
} else if (code.includes('SKIP_REORG_THRESHOLD')) {
    console.log('  ⚠️  Constants already exist');
}

// ============================================================
// PATCH 2: Skip reorg detection when far behind chain head
// ============================================================
const oldParentHash = `                const parentHash = await this.getBlockHash(blockNumber - 1);
                const nextBlockNumber = await this.indexer
                    .getProvider()
                    .processBlock(blockNumber, parentHash);`;

const newParentHash = `                // Skip reorg detection when far behind (saves 1 RPC/block)
                let parentHash = null;
                const behindBy = (this.preloadEndBlock || 0) - blockNumber;
                if (behindBy <= SKIP_REORG_THRESHOLD) {
                    parentHash = await this.getBlockHash(blockNumber - 1);
                }
                const nextBlockNumber = await this.indexer
                    .getProvider()
                    .processBlock(blockNumber, parentHash);`;

if (code.includes(oldParentHash)) {
    code = code.replace(oldParentHash, newParentHash);
    console.log('  ✅ PATCH 2: Skip reorg when syncing (>SKIP_REORG_THRESHOLD behind)');
    containerPatches++;
} else {
    console.log('  ⚠️  Reorg skip pattern not found (may already be patched)');
}

// ============================================================
// PATCH 3: Batch prefetch block data after preload
// ============================================================
// After preload finds blocks with events, prefetch them in parallel
const preloadReturn = `                this.preloadedBlocks = [
                    ...new Set(checkpoints.map(cp => cp.blockNumber).sort((a, b) => a - b))
                ];
                return this.preloadedBlocks.shift();`;

const preloadReturnNew = `                this.preloadedBlocks = [
                    ...new Set(checkpoints.map(cp => cp.blockNumber).sort((a, b) => a - b))
                ];
                // Batch prefetch block data for preloaded blocks (Graph-Node style)
                try {
                    const provider = this.indexer.getProvider();
                    if (provider.blockCache) {
                        const toFetch = this.preloadedBlocks.filter(b => !provider.blockCache.has(b));
                        if (toFetch.length > 0) {
                            const PREFETCH_BATCH = 5;
                            for (let i = 0; i < Math.min(toFetch.length, PREFETCH_BATCH * 3); i += PREFETCH_BATCH) {
                                const batch = toFetch.slice(i, i + PREFETCH_BATCH);
                                const blocks = await Promise.all(
                                    batch.map(b => provider.client.getBlock({ blockNumber: BigInt(b) }).catch(() => null))
                                );
                                blocks.forEach((blk, idx) => {
                                    if (blk) provider.blockCache.set(batch[idx], blk);
                                });
                            }
                            this.log.info({ prefetched: Math.min(toFetch.length, PREFETCH_BATCH * 3) }, 'batch prefetched block data');
                        }
                    }
                } catch (e) {
                    this.log.warn({ err: e }, 'batch prefetch failed, will fetch individually');
                }
                return this.preloadedBlocks.shift();`;

if (code.includes(preloadReturn)) {
    code = code.replace(preloadReturn, preloadReturnNew);
    console.log('  ✅ PATCH 3: Batch prefetch block data after preload (5 parallel)');
    containerPatches++;
} else {
    console.log('  ❌ PATCH 3: Preload return pattern not found');
}

// ============================================================
// PATCH 4: Batch setLastIndexedBlock (skip most DB writes)
// ============================================================
const oldSetIndexed = `        await this.instance.setLastIndexedBlock(blockNumber);
        return blockNumber + 1;`;

const newSetIndexed = `        // Batch: only write lastIndexedBlock every N blocks (saves DB writes)
        if (blockNumber % BATCH_SET_INDEXED === 0) {
            await this.instance.setLastIndexedBlock(blockNumber);
        }
        return blockNumber + 1;`;

if (providerCode.includes(oldSetIndexed)) {
    providerCode = providerCode.replace(oldSetIndexed, newSetIndexed);
    console.log('  ✅ PATCH 4: Batch setLastIndexedBlock (every BATCH_SET_INDEXED blocks)');
    providerPatches++;
} else {
    console.log('  ❌ PATCH 4: setLastIndexedBlock pattern not found');
}

// ============================================================
// PATCH 5: Skip parentHash null guard in processBlock
// ============================================================
const oldReorgCheck = `if (block.parentHash !== parentHash)`;
const newReorgCheck = `if (parentHash && block.parentHash !== parentHash)`;

if (providerCode.includes(oldReorgCheck) && !providerCode.includes('parentHash && block.parentHash')) {
    providerCode = providerCode.replace(oldReorgCheck, newReorgCheck);
    console.log('  ✅ PATCH 5: Guard processBlock reorg check for null parentHash');
    providerPatches++;
} else if (providerCode.includes('parentHash && block.parentHash')) {
    console.log('  ⚠️  PATCH 5: Already guarded');
} else {
    console.log('  ❌ PATCH 5: Reorg check pattern not found');
}

// Write files
if (containerPatches > 0) {
    fs.writeFileSync(containerPath, code);
}
if (providerPatches > 0) {
    fs.writeFileSync(providerPath, providerCode);
}

console.log(`\n✅ Applied ${containerPatches} container patches + ${providerPatches} provider patches`);
console.log(`   Total optimizations: ${containerPatches + providerPatches}`);
console.log(`   - Reorg skip: saves 1 RPC/block when syncing`);
console.log(`   - Batch prefetch: 5 blocks in parallel instead of 1-by-1`);
console.log(`   - Batch DB writes: setLastIndexedBlock every ${process.env.BATCH_SET_INDEXED || 10} blocks`);
