# Sync Achievement — Feb 11, 2026

Both chains fully synced to tip in a single session. The unified multichain Checkpoint indexer is **production-ready**.

## Final Status

| Chain | Indexer Block | Chain Tip | Status |
|-------|--------------|-----------|--------|
| **Gnosis (100)** | 44,630,451 | 44,630,450 | ✅ At tip |
| **Mainnet (1)** | 24,435,614 | 24,435,614 | ✅ At tip |

**GraphQL Endpoint:** `http://localhost:3001/graphql`

---

## Sync Timeline (Gnosis — 4M blocks from start)

| Time | Block | Blocks Gained | Avg Speed |
|------|-------|---------------|-----------|
| 14:44 (start) | 42,245,592 | — | — |
| +30 min | 43,195,661 | +950K | **~530 blk/s** |
| +60 min | 43,598,185 | +1.35M total | **~375 blk/s** |
| +115 min | 44,630,451 | +2.38M (**100%**) | **~345 blk/s avg** |

> **Note:** Average speed drops over time because more recent blocks are denser (more active proposals → more swaps per block).

---

## Speed by Block Density

| Block Type | Speed | Explanation |
|-----------|-------|-------------|
| **Sparse** (no swap events) | **1,000–1,400 blk/s** | Pure RPC fetching, no DB writes |
| **Moderate** (few swaps) | **200–700 blk/s** | Some candle updates |
| **Dense** (many swaps) | **16–60 blk/s** | Multiple pools trading simultaneously |

---

## Performance Optimizations Active

| Optimization | Impact | Env Var |
|-------------|--------|---------|
| Pool whitelist filter (21K → ~730) | ~100x fewer RPC sources | — |
| Removed Mint/Burn listeners | ~2x less RPC traffic | — |
| Single candle period (1h) | ~3.5x fewer DB writes | `CANDLE_PERIODS=3600` |
| Large batch size | ~4x less artificial delay | `CHECKPOINT_BATCH_SIZE=200` |
| In-memory pool cache | Eliminated DB reads per swap | — |
| Removed swap duplicate check | **12x** (110 → 1,400 blk/s) | — |
| Skip swap storage during sync | Fewer DB writes | `SKIP_SWAP_STORAGE=true` |

---

## Data at Tip

| Entity | Gnosis | Mainnet | Total |
|--------|--------|---------|-------|
| Proposals | 124 | 12 | **136** |
| Pools | 291 | 39 | **330** |
| Candles | 1h OHLCV | 1h OHLCV | — |

### Verified: GIP-145

```graphql
{ proposals(where: { address: "0x45e1064348fd8a407d6d1f59fc64b05f633b28fc" }) {
    id chain address marketName
}}
```

```json
{
  "id": "100-0x45e1064348fd8a407d6d1f59fc64b05f633b28fc",
  "chain": 100,
  "marketName": "Will GIP-145 (Advisory Futarchy Pilot with $100k temp liquidity) be approved..."
}
```

---

## Docker Setup Used

```yaml
# docker-compose.yml (key env vars)
CHECKPOINT_BATCH_SIZE: 200
CANDLE_PERIODS: 3600
MAINNET_BLOCK_RANGE: 50000
SKIP_SWAP_STORAGE: true
CANDLE_FLUSH_INTERVAL: 50
```

```bash
# Start (resumes from last block)
cd proposals-candles/checkpoint
docker compose -p futarchy-candles up -d

# Monitor
docker logs futarchy-candles-checkpoint-1 -f
```

---

## Architecture

```
Gnosis RPC ──► Gnosis Indexer ──┐
                                ├──► PostgreSQL ──► GraphQL :3001
Mainnet RPC ──► Mainnet Indexer─┘
```

Both chains share the same writers, schema, and database. Entity IDs are chain-prefixed (`100-0x...` / `1-0x...`) to ensure uniqueness.
