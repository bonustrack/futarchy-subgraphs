#!/usr/bin/env node
/**
 * Patches Checkpoint's helpers.js to handle PublicNode's -32603 error code
 * for "eth_getLogs range is too large, max is 1k blocks"
 */

const fs = require('fs');
const path = require('path');

const helpersPath = path.join(__dirname, '../node_modules/@snapshot-labs/checkpoint/dist/src/providers/evm/helpers.js');

if (!fs.existsSync(helpersPath)) {
    console.log('Checkpoint helpers.js not found, skipping patch');
    process.exit(0);
}

let content = fs.readFileSync(helpersPath, 'utf8');

// Check if already patched
if (content.includes('-32603')) {
    console.log('✅ Checkpoint already patched for PublicNode support');
    process.exit(0);
}

// Add PublicNode error handling before the final return null
const patchCode = `
    // PublicNode (code: -32603): eth_getLogs range is too large, max is 1k blocks
    if (err.code === -32603 && err.message && err.message.includes('range is too large')) {
        // We have no range in the error data, so we halve the range to work with 1k limit
        return {
            from: currentRange.from,
            to: currentRange.from + Math.ceil((currentRange.to - currentRange.from) / 2)
        };
    }
`;

// Find the final "return null;" and insert before it
const insertPoint = content.lastIndexOf('return null;');
if (insertPoint === -1) {
    console.error('❌ Could not find insertion point in helpers.js');
    process.exit(1);
}

content = content.slice(0, insertPoint) + patchCode + '\n    ' + content.slice(insertPoint);

fs.writeFileSync(helpersPath, content);
console.log('✅ Patched Checkpoint for PublicNode -32603 error support');
