#!/usr/bin/env node
/**
 * Patch: Make Checkpoint Model save() use UPSERT instead of INSERT
 * 
 * Problem: Checkpoint's _insert() does a plain INSERT, so block retries
 * re-inserting the same entity create duplicate rows (id is not UNIQUE).
 * 
 * Fix: Use knex.raw() with proper parameter binding for ON CONFLICT.
 */

const fs = require('fs');
const path = require('path');

const modelPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@snapshot-labs',
    'checkpoint',
    'dist',
    'src',
    'orm',
    'model.js'
);

console.log('=== Patch: Upsert Model._insert() ===');

if (!fs.existsSync(modelPath)) {
    console.error('model.js not found at', modelPath);
    process.exit(1);
}

let code = fs.readFileSync(modelPath, 'utf8');

// Replace the _insert method with a version that uses ON CONFLICT DO UPDATE
// We use knex.raw() directly with proper parameterized bindings
const newInsertMethod = `async _insert() {
        const currentBlock = register_1.register.getCurrentBlock(this.indexerName);
        const entity = Object.fromEntries(this.values.entries());
        const knex = register_1.register.getKnex();
        
        // Build column names and values for INSERT
        const data = {
            ...entity,
            _indexer: this.indexerName,
        };
        
        const cols = Object.keys(data);
        const colsQuoted = cols.map(c => '"' + c + '"').join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        const vals = cols.map(c => data[c]);
        
        // Update columns (everything except id)
        const updateCols = cols
            .filter(c => c !== 'id')
            .map(c => '"' + c + '" = EXCLUDED."' + c + '"')
            .join(', ');
        
        const sql = 'INSERT INTO "' + this.tableName + '" (' + colsQuoted + ', "block_range") ' +
            'VALUES (' + placeholders + ', int8range(?, NULL)) ' +
            'ON CONFLICT (id, _indexer) WHERE upper_inf(block_range) ' +
            'DO UPDATE SET ' + updateCols + ', "block_range" = int8range(?, NULL)';
        
        return knex.raw(sql, [...vals, currentBlock, currentBlock]);
    }`;

// Find and replace _insert using regex (handles whitespace variations)
const insertRegex = /async _insert\(\)\s*\{[^}]*?return register_1\.register[\s\S]*?\.insert\(\{[\s\S]*?\}\);[\s\r\n]*\}/;

if (insertRegex.test(code)) {
    code = code.replace(insertRegex, newInsertMethod);
    console.log('✅ Replaced _insert() with upsert version (parameterized)');
} else {
    // Try simpler match
    const simpleRegex = /async _insert\(\)\s*\{[\s\S]*?\n    \}/;
    if (simpleRegex.test(code)) {
        code = code.replace(simpleRegex, newInsertMethod);
        console.log('✅ Replaced _insert() with upsert version (simple match)');
    } else {
        console.error('❌ Could not find _insert() to replace');
        process.exit(1);
    }
}

fs.writeFileSync(modelPath, code, 'utf8');
console.log('✅ model.js patched with parameterized upsert');
