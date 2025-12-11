# Algebra Candles Subgraph

This subgraph tracks OHLC (Open, High, Low, Close) candles and the latest price for an Algebra V3 pool on Gnosis Chain.

## Pool Details
- **Network**: Gnosis Chain
- **Address**: `0x462BB6bB0261B2159b0e3cc763a1499e29afc1F8`
- **Start Block**: 43468000

## Entities
1. **Pool**: Tracks live state (`lastPrice`, `tick`, `timestamp`).
2. **Candle**: Tracks hourly OHLC data.

## Setup & Deployment

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Types
```bash
npm run codegen
```

### 3. Build
```bash
npm run build
```

### 4. Deploy to Subgraph Studio
1. Go to [The Graph Studio](https://thegraph.com/studio/) and create a subgraph named `algebra-candles`.
2. Authenticate:
   ```bash
   graph auth --studio <YOUR_DEPLOY_KEY>
   ```
3. Deploy:
   ```bash
   npm run deploy
   ```

## Query Examples

### Get Live Price & Last Update
```graphql
{
  pool(id: "0x462bb6bb0261b2159b0e3cc763a1499e29afc1F8") {
    lastPrice
    tick
    timestamp
  }
}
```

### Get Historical Candles
```graphql
{
  candles(
    where: { pool: "0x462bb6bb0261b2159b0e3cc763a1499e29afc1F8" }
    orderBy: periodStartUnix
    orderDirection: desc
    first: 24
  ) {
    periodStartUnix
    open
    high
    low
    close
    volumeToken0
  }
}
```
