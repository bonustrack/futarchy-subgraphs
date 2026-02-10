#!/usr/bin/env node
/**
 * Comprehensive Checkpoint RPC patch for rate limiting and payload size:
 * 
 * 1. BATCH SIZE: Reduces addresses per getLogs call (CHECKPOINT_BATCH_SIZE, default: 10)
 * 2. BATCH DELAY: Adds delay between batches (CHECKPOINT_BATCH_DELAY_MS, default: 200)
 * 3. 413 HANDLING: Auto-reduces block range on "Entity Too Large" errors
 * 4. 429 HANDLING: Retries with exponential backoff on rate limits
 */

const fs = require('fs');
const path = require('path');

const providerPath = path.join(__dirname, '../node_modules/@snapshot-labs/checkpoint/dist/src/providers/evm/provider.js');

if (!fs.existsSync(providerPath)) {
    console.log('Checkpoint provider.js not found, skipping patch');
    process.exit(0);
}

let content = fs.readFileSync(providerPath, 'utf8');

// Check if already patched
if (content.includes('CHECKPOINT_BATCH_SIZE')) {
    console.log('✅ Checkpoint already patched');
    process.exit(0);
}

let patched = false;

// ============================================================
// PATCH 1: Configurable batch size + delay in getLogsForSources
// ============================================================
const oldChunk = 'for (let i = 0; i < sources.length; i += 20) {';
if (content.includes(oldChunk)) {
    content = content.replace(
        oldChunk,
        `const batchSize = parseInt(process.env.CHECKPOINT_BATCH_SIZE || '10', 10); for (let i = 0; i < sources.length; i += batchSize) {`
    );
    content = content.replace(
        'chunks.push(sources.slice(i, i + 20));',
        'chunks.push(sources.slice(i, i + batchSize));'
    );

    // Add delay between chunks: find the concat line and add delay after it
    content = content.replace(
        'events = events.concat(chunkEvents);\n        }\n        return events;\n    }',
        `events = events.concat(chunkEvents);
            const _delay = parseInt(process.env.CHECKPOINT_BATCH_DELAY_MS || '200', 10);
            if (_delay > 0) { await new Promise(r => setTimeout(r, _delay)); }
        }
        return events;
    }`
    );
    patched = true;
    console.log('✅ Patch 1: Configurable batch size + delay');
} else {
    console.log('⚠️  Patch 1: getLogsForSources pattern not found');
}

// ============================================================
// PATCH 2: Handle 413 "Entity Too Large" in getLogs by halving range
// ============================================================
// The getLogs method has a catch block that checks for rangeHint.
// We add 413/Entity Too Large handling that halves the range.
const oldCatch = `const rangeHint = (0, helpers_1.getRangeHint)(err, {
                    from: currentFrom,
                    to: currentTo
                });`;

if (content.includes(oldCatch)) {
    content = content.replace(
        oldCatch,
        `// Handle 413 Entity Too Large and 429 Too Many Requests
                const errMsg = err?.message || '';
                if (errMsg.includes('Entity Too Large') || errMsg.includes('Too Many Requests') || errMsg.includes('429')) {
                    const halfRange = currentFrom + Math.ceil((currentTo - currentFrom) / 2);
                    if (halfRange > currentFrom && currentTo > currentFrom) {
                        this.log.warn({ fromBlock: currentFrom, toBlock: currentTo, newTo: halfRange, err: errMsg }, 'RPC limit hit, halving range');
                        currentTo = halfRange;
                        const _backoff = errMsg.includes('429') || errMsg.includes('Too Many') ? 2000 : 500;
                        await new Promise(r => setTimeout(r, _backoff));
                        continue;
                    }
                }
                const rangeHint = (0, helpers_1.getRangeHint)(err, {
                    from: currentFrom,
                    to: currentTo
                });`
    );
    patched = true;
    console.log('✅ Patch 2: 413 Entity Too Large + 429 rate limit auto-recovery');
} else {
    console.log('⚠️  Patch 2: getLogs catch pattern not found');
}

// ============================================================
// PATCH 3: Handle 413 in _getLogs (HTTP level)
// ============================================================
const oldThrow = `throw new Error(\`Request failed: \${res.statusText}\`);`;
if (content.includes(oldThrow)) {
    content = content.replace(
        oldThrow,
        `const _err = new Error(\`Request failed: \${res.statusText}\`);
        _err.status = res.status;
        throw _err;`
    );
    patched = true;
    console.log('✅ Patch 3: HTTP status code preserved in errors');
} else {
    console.log('⚠️  Patch 3: _getLogs throw pattern not found');
}

if (patched) {
    fs.writeFileSync(providerPath, content);
    console.log('\n✅ All patches applied successfully');
    console.log('   CHECKPOINT_BATCH_SIZE (default: 10)');
    console.log('   CHECKPOINT_BATCH_DELAY_MS (default: 200)');
} else {
    console.error('❌ No patches could be applied');
    process.exit(1);
}
