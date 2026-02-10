# Pool Tracking Fix — Feb 2026

## The Problem

The Gnosis chain indexer was tracking **~21,000 pools** instead of the expected **~6 per proposal** (~730 total for ~122 proposals). This caused:

- **Indexing speed**: Dropped from hundreds of blk/s to **<1 blk/s**
- **RPC overload**: Each `eth_getLogs` call had to filter events across all 21K contracts
- **DB bloat**: Hundreds of duplicate pool rows per unique address

### Root Cause

The `createPoolEntity` function in `writers.ts` had no filtering — **every** Algebra pool whose tokens appeared in the whitelisted tokens list was tracked. This included:

1. **Non-Futarchy pools** — Generic DEX pools with base tokens like GNO+sDAI (type `UNKNOWN`)
2. **Cross-proposal pools** — Pools pairing outcome tokens from *different* proposals
3. **Duplicate pools** — Same token pair created across multiple blocks by the Algebra Factory
4. **Retry duplicates** — Block retries re-emitting the same `PoolCreated` event

## The Fix: 4-Layer Defense

### Layer 1: Type Filter (`writers.ts`)

Skip pools where `classifyPool()` returns `TYPE_UNKNOWN` — these are pools with token combinations that don't form valid Futarchy market types (EXPECTED_VALUE, CONDITIONAL, PREDICTION).

```typescript
const { type, isInverted, outcomeSide } = classifyPool(wt0.role, wt1.role);
if (type === TYPE_UNKNOWN) return; // e.g. COMPANY+COMPANY, COLLATERAL+COLLATERAL
```

### Layer 2: Cross-Proposal Check (`writers.ts`)

Verify both outcome tokens belong to the **same proposal**. COLLATERAL tokens (sDAI) have no proposal field, so we only enforce this when both tokens have a proposal.

```typescript
if (prop0 && prop1 && prop0 !== prop1) return; // Different proposals — skip
```

### Layer 3: In-Memory Slot Set (`writers.ts`)

A `Set<string>` keyed on `proposalId-type-outcomeSide` ensures only **one pool per slot** is tracked. There are exactly 6 valid slots per proposal:

| Type | YES | NO |
|------|-----|----|
| EXPECTED_VALUE | `prop-EV-YES` | `prop-EV-NO` |
| CONDITIONAL | `prop-COND-YES` | `prop-COND-NO` |
| PREDICTION | `prop-PRED-YES` | `prop-PRED-NO` |

```typescript
const slotKey = `${proposalId}-${type}-${outcomeSide}`;
if (trackedPoolSlots.has(slotKey)) return;
trackedPoolSlots.add(slotKey);
```

> **Note**: This Set resets on container restart, so it only prevents duplicates within a single session.

### Layer 4: DB Unique Index + Upsert (`patch-upsert.js` + `index.ts`)

**Unique partial indexes** on all entity tables prevent duplicate *active* rows at the database level:

```sql
CREATE UNIQUE INDEX idx_pools_unique_active 
ON pools (id, _indexer) 
WHERE upper_inf(block_range);
```

**Upsert patch** modifies Checkpoint's `_insert()` to use `ON CONFLICT DO UPDATE`:

```sql
INSERT INTO "pools" (...) VALUES (...)
ON CONFLICT (id, _indexer) WHERE upper_inf(block_range)
DO UPDATE SET ...
```

This is the last line of defense — even if all other layers fail, the DB rejects true duplicate active rows.

## Checkpoint's Block Range Versioning

Checkpoint uses **temporal versioning** via `int8range` columns:
- Active rows: `block_range = [start_block, ∞)` → `upper_inf(block_range) = true`
- Closed rows: `block_range = [start_block, end_block)` → historical versions

When `pool.save()` updates an existing entity, Checkpoint:
1. Closes the current row's `block_range` to `[start, current_block)`
2. Inserts a new row with `block_range = [current_block, ∞)`

This means the `pools` table will have **multiple rows per pool address** — this is normal. Only **one row per ID will be active** (`upper_inf = true`). All GraphQL queries filter to active rows automatically.

## Patch Files

| File | Purpose |
|------|---------|
| `scripts/patch-checkpoint.js` | Handles RPC `-32603` error (range too large) by halving |
| `scripts/patch-batch-size.js` | Configurable batching, delay, 413/429 retry with backoff |
| `scripts/patch-upsert.js` | Makes `_insert()` use `ON CONFLICT DO UPDATE` |

All patches run during Docker build (see `Dockerfile`).

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CHECKPOINT_BATCH_SIZE` | 10 | Max sources per `eth_getLogs` call |
| `CHECKPOINT_BATCH_DELAY_MS` | 200 | Delay between batches (ms) |
| `RESET` | false | Set `true` to wipe DB and re-index |

## Results

| Metric | Before | After |
|--------|--------|-------|
| Tracked pools | ~21,000 | ~730 (6 × 122 proposals) |
| Active pools per proposal | ~438 | **Exactly 6** |
| Indexing speed | <1 blk/s | **600-900 blk/s** |
| Template sources | ~21,000 | ~730 |
| ETA to chain head | Days | **~1-2 hours** |

---

## Performance Optimizations (Feb 2026)

Beyond the pool tracking fix, the following optimizations were applied:

### 1. Removed Mint/Burn Events

`config.ts` templates originally tracked 4 events per pool: `Initialize`, `Swap`, `Mint`, `Burn`. However, **no handlers existed** for Mint/Burn — they were dead event listeners generating unnecessary RPC traffic. Each `eth_getLogs` call was fetching and discarding these events across all tracked pools.

**Fix:** Removed `Mint` and `Burn` from both `AlgebraPool` and `UniswapV3Pool` templates.
**Impact:** ~2x less RPC data fetched per block range.

### 2. Configurable Candle Periods

Each swap originally generated **6 candle upserts** (1m, 5m, 15m, 1h, 4h, 1d). For historical sync, only 1h candles are needed.

**Fix:** `CANDLE_PERIODS` env var (comma-separated seconds). Default: `3600` (1h only).

```bash
# 1h only (fast sync)
CANDLE_PERIODS=3600

# All timeframes (production)
CANDLE_PERIODS=60,300,900,3600,14400,86400
```

**Impact:** DB writes per swap reduced from 7 → 2 (1 candle + 1 swap insert = **3.5x fewer writes**).

### 3. Batch Size & Delay Tuning

With fewer event types (2 vs 4) and fewer pools (179 vs 21K), the RPC can handle larger batches with less delay.

| Setting | Before | After |
|---------|--------|-------|
| `CHECKPOINT_BATCH_SIZE` | 10 | 50 |
| `CHECKPOINT_BATCH_DELAY_MS` | 200 | 50 |

With 179 pools at batch size 10, there were 18 batches × 200ms = **3.6s of pure waiting** per block range. At batch size 50, it's 4 batches × 50ms = **0.2s**.

**Impact:** ~4x faster in sparse blocks.

### Cumulative Impact

| Fix | Multiplier | Bottleneck Addressed |
|-----|-----------|---------------------|
| Pool filter (21K → 179) | ~100x | RPC event filtering |
| Remove Mint/Burn | ~2x | RPC data volume |
| CANDLE_PERIODS=3600 | ~3.5x | DB write volume |
| Batch 50 / Delay 50ms | ~4x | Artificial waiting |

**Speed by block density:**

| Block Type | Original | After All Fixes |
|-----------|----------|-----------------|
| Sparse (no swaps) | <1 blk/s | **500-900 blk/s** |
| Dense (many swaps) | <1 blk/s | **16-60 blk/s** |

---

## Advanced Optimizations — Round 2

### 4. In-Memory Pool Cache (`writers.ts`)

Every `handleSwap` and `handleInitialize` call was doing **2 DB reads** to resolve which chain a pool belongs to (`Pool.loadEntity('1-addr')` then `Pool.loadEntity('100-addr')`). With hundreds of swaps per second in dense regions, this was a major bottleneck.

**Fix:** Added `resolvePool()` with a `Map<string, PoolCacheEntry>` cache. First lookup hits DB, all subsequent lookups for the same pool are instant from memory.

```typescript
const poolCache = new Map<string, PoolCacheEntry | null>();

async function resolvePool(poolAddr: string): Promise<PoolCacheEntry | null> {
    const cached = poolCache.get(poolAddr);
    if (cached !== undefined) return cached; // null = known missing
    // ... DB fallback, then cache result
}
```

**Impact:** Eliminated 1-2 DB reads per swap (~180 pools cached after first pass).

### 5. Removed Swap Duplicate Check (`writers.ts`)

Each swap was calling `Swap.loadEntity(swapId)` before saving to check for duplicates from block retries. This is **redundant** because the `patch-upsert.js` already handles `ON CONFLICT DO UPDATE` at the DB level.

```diff
-    const existingSwap = await Swap.loadEntity(swapId, indexer);
-    if (existingSwap) return;
+    // Duplicate protection handled by DB upsert patch (ON CONFLICT DO UPDATE)
```

**Impact:** Eliminated 1 DB read per swap. This was the single biggest remaining bottleneck — `Swap.loadEntity` triggers a full table scan through Checkpoint's temporal versioning. Removing it took Gnosis from **~110 blk/s → 1,400 blk/s**.

### 6. Infura API Key Rotation

Mainnet was throttled at 12 blk/s with the original Infura key. Switching to a fresh API key (`dcd7d2c2...`) with higher rate limits restored Mainnet to **85-200 blk/s**.

### Updated Results

| Metric | Round 1 | Round 2 |
|--------|---------|---------|
| DB ops per swap | 6-7 | **3** (swap write + pool update + candle upsert) |
| Gnosis (sparse) | 500-900 blk/s | **1,400+ blk/s** |
| Gnosis (dense) | 16-60 blk/s | **60-700 blk/s** |
| Mainnet | 40-85 blk/s | **85-200 blk/s** |
| ETA to chain head | ~3-4 hours | **~1 hour** |

### Updated Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CHECKPOINT_BATCH_SIZE` | 50 | Max sources per `eth_getLogs` call |
| `CHECKPOINT_BATCH_DELAY_MS` | 50 | Delay between batches (ms) |
| `CANDLE_PERIODS` | 3600 | Comma-separated candle periods in seconds |
| `RESET` | false | Set `true` to wipe DB and re-index |
