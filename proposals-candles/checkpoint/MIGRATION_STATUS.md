# Migration Status: Graph Node → Snapshot Checkpoint

**Date**: February 10, 2026
**Status**: ✅ **Core Indexing Stable & Fast**

We have successfully migrated the `proposals-candles` subgraph schema to Snapshot Checkpoint and stabilized the multi-chain indexer.

## 🏆 Key Achievements

1.  **Performance Parity Restored**
    -   **Gnosis**: **1,057 blk/s** (Target: >100 blk/s). Verified in dense swap regions.
    -   **Mainnet**: **25 blk/s** (Target: Stable). Limited by Infura free tier, but no longer crashing.

2.  **Critical Fixes Applied (The "Nuclear" Patch)**
    -   **Crash Loops**: Fixed `_insert`/`_update` exclusion constraint violations on block retry.
    -   **Rate Limiting**: Added exponential backoff for `_getLogs` (429/5xx retry).
    -   **Per-Chain Config**: Gnosis uses 5k block ranges (fast), Mainnet uses 10k (rate-limited).

3.  **Infrastructure**
    -   **Unified Patch**: Single [`patch-graphnode-style.js`](./scripts/patch-graphnode-style.js) file addresses 17 distinct issues at build time.
    -   **Docker**: Fully containerized with automatic patching and optimized production settings.

## 🧩 Schema & Data

-   ✅ **Candle Data**: `Candle` entity schema matched 1:1 with Graph Node.
-   ✅ **Proposal Data**: `Proposal` entity schema matched 1:1.
-   ⚠️ **Metadata**: `ProposalMetadata` syncing is next. Currently focusing on core candle/proposal data.

## 🔧 Operational Guide

### 1. Build & Start
```bash
docker compose build --no-cache
docker compose up -d
```

### 2. Configuration (Per-Chain Override)
You can override the global block range per chain using environment variables in `.env` or `docker-compose.yml`:
```bash
# Default (Gnosis)
BLOCK_PRELOAD_START_RANGE=5000

# Override for Mainnet (Infura Rate Limited)
MAINNET_BLOCK_RANGE=10000
```

### 3. Patches
The file `scripts/patch-graphnode-style.js` is automatically run during `docker build`. It modifies the `@snapshot-labs/checkpoint` package in `node_modules` to fix:
- `provider.js`: Batch requests, retries, block caching.
- `container.js`: Adaptive ranges, batched DB writes.
- `model.js`: Exclusion constraint fixes.
