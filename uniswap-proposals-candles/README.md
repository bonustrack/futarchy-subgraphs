# Algebra Proposals Subgraph 📊

A The Graph subgraph for indexing Futarchy Algebra pools, proposals, candles, and swaps.

**Live Endpoint (v0.0.24):**
`https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.24`

## Features
*   **Proposals**: Groups pools by their governance proposal or market question.
*   **Spot Price**: Real-time `pool.price` calculated server-side (handling decimals & inversion).
*   **Outcome Classification**: `outcomeSide` ("YES"/"NO") for easy UI filtering.
*   **Candles**: OHLCV data for multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d).
*   **Swaps**: Full trade history with human-readable amounts.

## Documentation
For detailed frontend integration instructions, copy-paste queries, and data models, see:
👉 **[subgraph_integration_guide.md](./subgraph_integration_guide.md)**

## Quick Start (Query)

```graphql
{
  proposals(first: 5) {
    id
    marketName
    pools {
      type
      outcomeSide # "YES" or "NO"
      price       # Live Spot Price
    }
  }
}
```

## Development
1.  **Install dependencies:** `npm install`
2.  **Generate types:** `npm run codegen`
3.  **Deploy:** `npx graph deploy --studio algebra-proposal-candles --version-label v0.0.24`
