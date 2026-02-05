// Multichain Checkpoint Candles Indexer
// Entry point that registers both Gnosis and Mainnet indexers

import Checkpoint, { evm, LogLevel } from '@snapshot-labs/checkpoint';
import express, { Request, Response } from 'express';
import * as writers from './writers';
import { gnosisConfig, mainnetConfig } from './config';
import * as fs from 'fs';
import * as path from 'path';

// Load schema - works from both src/ (dev) and dist/ (prod)
// When running from dist/, __dirname is /app/dist, so we go up to find src/schema.gql
const schemaPath = path.resolve(__dirname, '..', 'src', 'schema.gql');
const schema = fs.readFileSync(schemaPath, 'utf8');

const app = express();
app.use(express.json());

// Initialize Checkpoint with unified schema
const checkpoint = new Checkpoint(schema, {
    dbConnection: process.env.DATABASE_URL,
    logLevel: LogLevel.Info,
    prettifyLogs: process.env.NODE_ENV !== 'production'
});

// ============================================================================
// Register Multi-Chain Indexers
// ============================================================================

// Gnosis Chain (Algebra DEX)
console.log('Registering Gnosis indexer (Algebra DEX)...');
checkpoint.addIndexer('gnosis', gnosisConfig, new evm.EvmIndexer(writers));

// Ethereum Mainnet (Uniswap V3 DEX)
console.log('Registering Mainnet indexer (Uniswap V3 DEX)...');
checkpoint.addIndexer('mainnet', mainnetConfig, new evm.EvmIndexer(writers));

// Future chains can be added here:
// checkpoint.addIndexer('arbitrum', arbitrumConfig, new evm.EvmIndexer(writers));

// ============================================================================
// API Endpoints
// ============================================================================

// GraphQL endpoint
app.use('/graphql', checkpoint.graphql);

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        chains: ['gnosis', 'mainnet'],
        timestamp: new Date().toISOString()
    });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.PORT || 3000;

async function start() {
    // Reset database if RESET=true
    if (process.env.RESET === 'true') {
        console.log('Resetting database...');
        await checkpoint.reset();
    }

    // Start HTTP server FIRST (so API is available during sync)
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║   Multichain Candles Indexer Running                       ║
╠════════════════════════════════════════════════════════════╣
║   GraphQL:  http://localhost:${PORT}/graphql                  ║
║   Health:   http://localhost:${PORT}/health                   ║
╠════════════════════════════════════════════════════════════╣
║   Chains:   Gnosis (100) | Mainnet (1)                     ║
║   DEXs:     Algebra      | Uniswap V3                      ║
╚════════════════════════════════════════════════════════════╝
    `);
    });

    // Start indexers (non-blocking - runs in background)
    console.log('Starting checkpoint indexers...');
    checkpoint.start().catch(err => {
        console.error('Checkpoint indexer error:', err);
    });
}

start().catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
});
