/**
 * Global RPC Rate Limiter for Checkpoint's EVM Provider
 * 
 * Problem: Rate limit errors come from ALL RPC call types:
 *   - eth_getLogs (via getCheckpointsRange/preload)
 *   - eth_getBlockByNumber (via processBlock)  
 *   - eth_blockNumber (via getLatestBlockNumber)
 * 
 * A per-block delay doesn't help because preload() makes burst calls.
 * 
 * Solution: Wrap the raw fetch() call in _getLogs and the viem client
 * with a global rate limiter that enforces MIN_RPC_INTERVAL_MS between
 * ANY consecutive RPC requests.
 * 
 * RPC_RATE_LIMIT: max requests per second (default: 25)
 */

const fs = require('fs');
const path = require('path');

const providerPath = path.join(
    __dirname, '..', 'node_modules', '@snapshot-labs', 'checkpoint',
    'dist', 'src', 'providers', 'evm', 'provider.js'
);

let code = fs.readFileSync(providerPath, 'utf-8');
let patched = 0;

// Add global rate limiter BEFORE the class definition
const classStart = 'class EvmProvider extends base_1.BaseProvider {';

const rateLimiter = `// ===== GLOBAL RPC RATE LIMITER =====
const RPC_RATE_LIMIT = parseInt(process.env.RPC_RATE_LIMIT || '25');
const RPC_MIN_INTERVAL = Math.floor(1000 / RPC_RATE_LIMIT); // ms between calls
let lastRpcCallTime = 0;
async function rpcThrottle() {
    const now = Date.now();
    const elapsed = now - lastRpcCallTime;
    if (elapsed < RPC_MIN_INTERVAL) {
        await new Promise(r => setTimeout(r, RPC_MIN_INTERVAL - elapsed));
    }
    lastRpcCallTime = Date.now();
}
// ===== END RATE LIMITER =====

class EvmProvider extends base_1.BaseProvider {`;

if (code.includes(classStart) && !code.includes('rpcThrottle')) {
    code = code.replace(classStart, rateLimiter);
    console.log(`  ✅ Added global rate limiter (RPC_RATE_LIMIT env, default 25 req/s)`);
    patched++;
} else if (code.includes('rpcThrottle')) {
    console.log('  ⚠️  Rate limiter already exists');
} else {
    console.log('  ❌ Class start not found');
}

// Throttle _getLogs (the raw fetch call for eth_getLogs)
const oldFetch = `        const res = await fetch(this.instance.config.network_node_url, {`;
const newFetch = `        await rpcThrottle();
        const res = await fetch(this.instance.config.network_node_url, {`;

if (code.includes(oldFetch) && !code.includes('await rpcThrottle();\n        const res = await fetch')) {
    code = code.replace(oldFetch, newFetch);
    console.log('  ✅ Throttled _getLogs fetch()');
    patched++;
} else {
    console.log('  ⚠️  _getLogs fetch already throttled or not found');
}

// Throttle getBlock calls (processBlock + getBlockHash)  
// These go through this.client.getBlock which is a viem call
// We'll throttle at the getBlockHash level and processBlock level
const oldGetBlockInProcess = `                    block = await this.client.getBlock({`;
const newGetBlockInProcess = `                    await rpcThrottle();
                    block = await this.client.getBlock({`;

if (code.includes(oldGetBlockInProcess) && !code.includes('await rpcThrottle();\n                    block = await this.client.getBlock')) {
    code = code.replace(oldGetBlockInProcess, newGetBlockInProcess);
    console.log('  ✅ Throttled processBlock getBlock()');
    patched++;
} else {
    console.log('  ⚠️  processBlock getBlock already throttled or not found');
}

// Throttle getBlockHash
const oldGetBlockInHash = `        const block = await this.client.getBlock({
            blockNumber: BigInt(blockNumber)
        });
        if (block) this.blockCache.set(blockNumber, block);
        return block.hash;`;
const newGetBlockInHash = `        await rpcThrottle();
        const block = await this.client.getBlock({
            blockNumber: BigInt(blockNumber)
        });
        if (block) this.blockCache.set(blockNumber, block);
        return block.hash;`;

if (code.includes(oldGetBlockInHash) && !code.includes('await rpcThrottle();\n        const block = await this.client.getBlock')) {
    code = code.replace(oldGetBlockInHash, newGetBlockInHash);
    console.log('  ✅ Throttled getBlockHash getBlock()');
    patched++;
} else {
    console.log('  ⚠️  getBlockHash getBlock already throttled or not found');
}

// Throttle getLatestBlockNumber
const oldBlockNum = `        const blockNumber = await this.client.getBlockNumber();`;
const newBlockNum = `        await rpcThrottle();
        const blockNumber = await this.client.getBlockNumber();`;

if (code.includes(oldBlockNum) && !code.includes('await rpcThrottle();\n        const blockNumber = await this.client.getBlockNumber')) {
    code = code.replace(oldBlockNum, newBlockNum);
    console.log('  ✅ Throttled getLatestBlockNumber()');
    patched++;
} else {
    console.log('  ⚠️  getLatestBlockNumber already throttled or not found');
}

if (patched > 0) {
    fs.writeFileSync(providerPath, code);
    console.log(`\n✅ Applied ${patched} rate limiter patches`);
    console.log(`   All RPC calls now throttled to RPC_RATE_LIMIT env var (default: 25 req/s)`);
} else {
    console.log('\n⚠️  No new patches applied');
}
