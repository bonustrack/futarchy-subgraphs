# Candle Limiting Strategies by Proposal

The Graph doesn't support deleting entities - once created, they persist forever. Here are several approaches to limit candle storage per proposal.

---

## Option 1: Conditional Creation (Subgraph-Side)

Only create candles if the proposal is within a certain age.

```typescript
function updateCandles(pool: NormalizedPool, timestamp: BigInt, price: BigDecimal, ...): void {
    // Load the proposal this pool belongs to
    let proposal = getProposalForPool(pool.id)
    if (!proposal) return

    let proposalAge = timestamp.minus(proposal.createdAtTimestamp).toI32()
    let maxAge = 30 * 24 * 3600  // 30 days in seconds

    // Skip candle creation for old proposals
    if (proposalAge > maxAge) return

    for (let i = 0; i < CANDLE_PERIODS.length; i++) {
        updateCandleForPeriod(...)
    }
}
```

| Pros | Cons |
|------|------|
| No wasted storage for old proposals | Need to link pools back to proposals |
| Simple cutoff logic | Loses all data after cutoff |

---

## Option 2: Tiered Periods by Age

Store high-resolution candles only for recent data, lower resolution for older data.

```typescript
function updateCandles(pool: NormalizedPool, timestamp: BigInt, ...): void {
    let proposal = getProposalForPool(pool.id)
    let age = timestamp.minus(proposal.createdAtTimestamp).toI32()

    // Always store 1-hour candles
    updateCandleForPeriod(..., 3600)

    // 10-minute candles only for first 7 days
    if (age < 7 * 24 * 3600) {
        updateCandleForPeriod(..., 600)
    }

    // 1-minute candles only for first 24 hours
    if (age < 24 * 3600) {
        updateCandleForPeriod(..., 60)
    }
}
```

### Storage by Proposal Age

| Proposal Age | Candle Periods Stored |
|--------------|----------------------|
| 0-24 hours   | 1m, 10m, 1h          |
| 1-7 days     | 10m, 1h              |
| 7+ days      | 1h only              |

| Pros | Cons |
|------|------|
| Balances resolution vs storage automatically | Can't delete old 1-min candles already created |
| High resolution when it matters most | Slightly more complex logic |

---

## Option 3: Rolling Window via ID Scheme

Overwrite old candles by using a rolling/circular ID scheme.

```typescript
// Instead of unique timestamp-based ID:
let id = pool.id + "-" + period.toString() + "-" + periodStart.toString()

// Use a rolling slot (e.g., last 100 candles per period):
let slot = (periodStart / period) % 100  // 0-99 rolling slots
let id = pool.id + "-" + period.toString() + "-" + slot.toString()
```

### Storage Calculation

```
Fixed storage per pool:
- 100 slots × 3 periods = 300 candles max per pool
- 6 pools per proposal = 1,800 candles max per proposal
```

| Pros | Cons |
|------|------|
| Fixed, predictable storage per pool | Loses historical data |
| Automatically "prunes" old data | Can't query by exact timestamp |
| Simple implementation | Rolling window might not align with needs |

---

## Option 4: Query-Time Filtering (No Subgraph Change)

Store everything in the subgraph, filter when querying from frontend/API.

```graphql
{
  unifiedCandles(
    where: {
      pool: "0x...",
      period: 60,
      time_gte: 1699900000  # Only fetch recent candles
    }
    first: 1000
  ) {
    time
    open
    high
    low
    close
    volume
  }
}
```

| Pros | Cons |
|------|------|
| No mapping changes needed | Still pays full storage cost |
| Simple to implement | Subgraph grows unbounded |
| Full historical data available if needed | Slower queries over time |

---

## Option 5: External Aggregation Service

Subgraph stores only trades (small, immutable). External service builds candles on-demand.

### Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│   Subgraph      │      │  Aggregation     │      │  Frontend   │
│   (Trades only) │ ───> │  Service         │ ───> │  App        │
│                 │      │  (Node.js/Python)│      │             │
└─────────────────┘      └──────────────────┘      └─────────────┘
                                  │
                                  v
                         ┌──────────────────┐
                         │  Cache/Database  │
                         │  (Redis/Postgres)│
                         │  with TTL/Pruning│
                         └──────────────────┘
```

### Implementation

```javascript
// External service pseudocode
async function getCandles(poolId, period, from, to) {
    // Check cache first
    let cached = await redis.get(`candles:${poolId}:${period}:${from}:${to}`)
    if (cached) return cached

    // Query trades from subgraph
    let trades = await querySubgraph(`{
        unifiedTrades(
            where: { pool: "${poolId}", timestamp_gte: ${from}, timestamp_lte: ${to} }
            orderBy: timestamp
        ) { timestamp, price, amountBase }
    }`)

    // Aggregate into candles
    let candles = aggregateTrades(trades, period)

    // Cache with TTL
    await redis.setex(`candles:${poolId}:${period}:${from}:${to}`, 3600, candles)

    return candles
}
```

| Pros | Cons |
|------|------|
| Full control over retention/pruning | More infrastructure to maintain |
| Can aggregate any period on-demand | Additional latency |
| Subgraph stays small and fast | Requires separate deployment |

---

## Recommendation

For futarchy proposals (which have defined lifespans), **Option 2 (Tiered Periods by Age)** provides the best balance:

1. High resolution (1m) during active trading (first 24h)
2. Medium resolution (10m) during the voting period (first 7 days)
3. Low resolution (1h) for historical reference

### Estimated Storage Comparison

Assuming 50 pools, 30-day proposal lifespan:

| Strategy | Candles per Proposal | Total Storage |
|----------|---------------------|---------------|
| All periods, full history | ~133,000 | ~35 MB |
| Tiered by age | ~12,000 | ~3 MB |
| Rolling window (100 slots) | 1,800 | ~475 KB |

---

## Implementation Checklist

- [ ] Add pool-to-proposal reverse lookup
- [ ] Implement `getProposalForPool()` helper
- [ ] Add age calculation in `updateCandles()`
- [ ] Test with existing proposals
- [ ] Redeploy and verify candle creation stops for old proposals
