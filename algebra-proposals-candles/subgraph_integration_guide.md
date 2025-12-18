# Algebra Proposal Subgraph Integration Guide

**Current Version:** `v0.0.24`
**Endpoint:** `https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.24`

This guide explains how to integrate the Futarchy Algebra Subgraph into a frontend application.

## 1. Key Improvements (v0.0.24)

*   **True Spot Price Only**: Use `pool.price` directly.
    *   *No more client-side math.*
    *   *No more checking `token0` vs `token1` roles.*
    *   *No more 1/price inversions.*
    *   The subgraph automatically calculates the human-readable price (e.g., $0.50 or $100.00).
*   **Easy YES/NO Filtering**: Use `pool.outcomeSide`.
    *   Values: `"YES"` or `"NO"`.
    *   Easily separate pools into generic "Buy Yes" or "Buy No" buckets.

---

## 2. Copy-Paste Code Examples

### A. Dashboard: List All Markets
Shows a list of active markets (proposals) with their types.

```javascript
const query = `{
    proposals(first: 20, orderBy: id, orderDirection: desc) {
        id
        marketName
        pools(where: { liquidity_gt: 0 }) {
            type        # "PREDICTION" or "CONDITIONAL"
            outcomeSide # "YES" or "NO"
        }
    }
}`;
```

### B. Market Details Links (Spot Price)
When a user opens a market, get the exact price for each outcome.

```javascript
/* FETCHING DETAILS FOR A MARKET */
const query = `{
    proposal(id: "${PROPOSAL_ID}") {
        marketName
        # Get YES Token Pool
        yesPool: pools(where: { outcomeSide: "YES" }) {
            id
            price      // <--- LIVE SPOT PRICE (e.g. 0.65)
            token1 { symbol }
        }
        # Get NO Token Pool
        noPool: pools(where: { outcomeSide: "NO" }) {
            id
            price      // <--- LIVE SPOT PRICE (e.g. 0.35)
            token1 { symbol }
        }
    }
}`;
```

### C. Candlestick Chart
Draw a chart for a specific pool. Pass new `period` values (60, 300, 900, 3600, 14400, 86400).

```javascript
/* FETCH CHART DATA (1 HOUR CANDLES) */
const query = `{
    candles(
        first: 500, 
        orderBy: time, 
        orderDirection: asc, 
        where: { 
            pool: "${POOL_ID}", 
            period: 3600 
        }
    ) {
        time
        open
        high
        low
        close
    }
}`;
// Use with Lightweight-Charts or Recharts
```

### D. Recent Trade History
Show the last 20 trades for a pool.

```javascript
/* FETCH RECENT TRADES */
const query = `{
    swaps(
        first: 20, 
        orderBy: timestamp, 
        orderDirection: desc, 
        where: { pool: "${POOL_ID}" }
    ) {
        timestamp
        price      // <--- EXECUTION PRICE
        amountIn   // Amount User Sold
        amountOut  // Amount User Bought
        tokenIn { symbol }
        tokenOut { symbol }
        transactionHash
        origin     // Maker Address
    }
}`;
```

---

## 3. Data Dictionary

### Entity: `Pool`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | ID | Pool Address (lowercase) |
| `price` | BigDecimal | **The Spot Price.** Always formatted correctly (human readable). |
| `outcomeSide` | String | `"YES"` or `"NO"`. Useful for grouping conditional pools. |
| `type` | String | `"PREDICTION"` (0-1 Pct) or `"CONDITIONAL"` (Scalar DAO). |
| `name` | String | Human readable pair name (e.g. "YES_GNO / sDAI"). |
| `liquidity` | BigInt | Raw liquidity amount. |

### Entity: `Candle`
| Field | Type | Description |
| :--- | :--- | :--- |
| `time` | Int | Unix timestamp of the candle open. |
| `period` | Int | Duration in seconds (60, 300, 3600...). |
| `open/high...` | BigDecimal | OHLC prices (aligned with `pool.price`). |
