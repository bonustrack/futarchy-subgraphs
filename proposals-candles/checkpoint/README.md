# Proposal Candles Checkpoint Indexer

Multichain indexer for Futarchy proposal pool candles using [Snapshot Checkpoint](https://docs.snapshot.org/tools/checkpoint).

## Quick Start

```bash
# Start with fresh database
docker compose down -v
docker compose build
RESET=true docker compose up -d

# Check health
curl http://localhost:3001/health
```

> [!WARNING]
> **RPC Block Range Limits:** Free RPCs have `eth_getLogs` block range limits that can cause errors.
> The indexer uses `chunk_size` in `src/config.ts` to stay within these limits:
> - **Gnosis** → `chunk_size: 10000` (QuickNode paid supports 10k; free RPCs vary, 500–2000)
> - **Mainnet** → `chunk_size: 50000` (Infura paid supports 100k+; free Llama supports ~1k)
>
> **For production**, set paid RPC endpoints via environment variables:
> ```bash
> GNOSIS_RPC_URL=https://your-quicknode-endpoint.com \
> MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY \
> docker compose up -d
> ```

## Candle Explorer UI

A built-in web UI for browsing proposals, pools, and candlestick charts.

```bash
# Serve with live-server (or any static file server)
npx -y live-server --port=8080 --host=0.0.0.0 .
```

Open `http://localhost:8080` → enter a proposal address → select a pool → view candlestick charts.

The explorer connects to the GraphQL API at `http://localhost:3001/graphql` and supports:
- Chain selection (Ethereum / Gnosis)
- Period selection (1m, 5m, 15m, 1h, 4h, 1d)
- Pool cards with live prices, outcome side indicators (🟢 YES / 🔴 NO), and `INV` badges for inverted pools

## GraphQL API

**Endpoint:** `http://localhost:3001/graphql`

---

### Proposals

```bash
# Get all proposals
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposals(first: 10) { id chain address marketName } }"}'

# Search by address (without chain prefix)
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposals(where: { address: \"0xfc57fe22ff6e6465ef36fc89c7f2e1ffe5ed32e0\" }) { id chain address } }"}'

# Get single proposal by ID
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposal(id: \"100-0xfc57fe22ff6e6465ef36fc89c7f2e1ffe5ed32e0\") { id chain address marketName } }"}'

# Filter by chain
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposals(where: { chain: 100 }) { id address } }"}'
```

---

### Whitelisted Tokens

```bash
# Get all tokens
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ whitelistedtokens(first: 10) { id chain symbol role decimals } }"}'

# Filter by role
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ whitelistedtokens(where: { role: \"COMPANY\" }) { id symbol chain } }"}'

# Filter by chain
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ whitelistedtokens(where: { chain: 100 }) { id symbol role } }"}'
```

---

### Pools

```bash
# Get all pools
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ pools(first: 10) { id chain dex address name price type } }"}'

# Filter by DEX type
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ pools(where: { dex: \"ALGEBRA\" }) { id name price } }"}'

# Filter by pool type (EXPECTED_VALUE, CONDITIONAL, PREDICTION)
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ pools(where: { type: \"EXPECTED_VALUE\" }) { id name outcomeSide } }"}'
```

---

### Candles (OHLCV)

```bash
# Get candles for a pool (1-hour period = 3600)
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ candles(where: { pool: \"100-0x...\", period: 3600 }, orderBy: time, orderDirection: desc, first: 24) { time open high low close volumeToken0 } }"}'

# Available periods: 60 (1m), 300 (5m), 900 (15m), 3600 (1h), 14400 (4h), 86400 (1d)
```

---

### Swaps

```bash
# Get recent swaps for a pool
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ swaps(where: { pool: \"100-0x...\" }, orderBy: timestamp, orderDirection: desc, first: 50) { id timestamp price amount0 amount1 } }"}'
```

---

## Schema Fields

| Entity | Key Fields |
|--------|------------|
| `Proposal` | `id`, `chain`, `address`, `marketName`, `outcomeTokens` |
| `WhitelistedToken` | `id`, `chain`, `symbol`, `role`, `decimals` |
| `Pool` | `id`, `chain`, `dex`, `address`, `name`, `price`, `type`, `outcomeSide`, **`isInverted`** |
| `Candle` | `id`, `pool`, `period`, `time`, `open`, `high`, `low`, `close`, `volumeToken0` |
| `Swap` | `id`, `pool`, `timestamp`, `price`, `amount0`, `amount1`, `sender`, `transactionHash` |

## Token Roles

| Role | Description |
|------|-------------|
| `COMPANY` | Base token (e.g., GNO) |
| `COLLATERAL` | Currency token (e.g., sDAI) |
| `YES_COMPANY` | Wrapped YES outcome of company token |
| `NO_COMPANY` | Wrapped NO outcome of company token |
| `YES_CURRENCY` | Wrapped YES outcome of currency token |
| `NO_CURRENCY` | Wrapped NO outcome of currency token |

## Price Inversion (`isInverted`)

In Uniswap V3 / Algebra pools, `token0` and `token1` ordering is determined by contract address sort order, not by the logical "base/quote" relationship. When the currency token (e.g., sDAI) sorts as `token0` and the company token (e.g., GNO) sorts as `token1`, the raw `sqrtPriceX96` gives the *inverse* of the expected price.

The indexer detects this by checking token roles:
- If `token0` is a `CURRENCY`-type role (`YES_CURRENCY`, `NO_CURRENCY`, `COLLATERAL`) → pool is **inverted**
- If `token0` is a `COMPANY`-type role → pool is **not inverted** (standard order)

When `isInverted = 1`, the price is automatically inverted (`1/price`) in:
- `handleInitialize` — initial pool price
- `handleSwap` — every swap price, candle OHLC data

### Pool Types

| Type | Description | Example |
|------|-------------|--------|
| `CONDITIONAL` | Company token vs currency token within an outcome | `YES_GNO / YES_sDAI` |
| `EXPECTED_VALUE` | Outcome token vs base currency | `YES_GNO / sDAI` |
| `PREDICTION` | Outcome currency vs base currency | `YES_sDAI / sDAI` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | *(set in compose)* | PostgreSQL connection string |
| `GNOSIS_RPC_URL` | `https://rpc.gnosischain.com` | Gnosis Chain RPC (paid recommended) |
| `MAINNET_RPC_URL` | `https://eth.llamarpc.com` | Ethereum Mainnet RPC (paid recommended) |
| `RESET` | `false` | Reset database on startup |
| `CHECKPOINT_BATCH_SIZE` | `200` | Internal batch size |
| `CANDLE_PERIODS` | `3600` | Candle period in seconds |
| `SKIP_SWAP_STORAGE` | `false` | Skip storing individual swaps (saves DB space) |
| `CANDLE_FLUSH_INTERVAL` | `50` | Flush candles to DB every N swaps |
| `PORT` | `3000` | HTTP server port |

---

## Restart & Recovery

Checkpoint stores sync progress in the database. **If the indexer crashes or you change RPC, it resumes automatically from the last block.**

### Common Scenarios

| Scenario | Command | Effect |
|----------|---------|--------|
| RPC error, change provider | `docker compose up -d` | ✅ Resumes from last block |
| Container crashed | `docker compose up -d` | ✅ Resumes from last block |
| Change RPC without reset | `MAINNET_RPC_URL=https://new-rpc docker compose up -d` | ✅ Resumes |
| Want fresh start | `docker compose down -v && RESET=true docker compose up -d` | ⚠️ Wipes all data |

### Examples

```bash
# Restart after crash (resumes automatically)
docker compose up -d

# Change Mainnet RPC and restart (resumes)
docker compose down
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY docker compose up -d

# Change Gnosis RPC and restart (resumes)
docker compose down
GNOSIS_RPC_URL=https://rpc.gnosischain.com docker compose up -d

# Full reset - DELETES ALL DATA
docker compose down -v        # -v removes the database volume
RESET=true docker compose up -d
```

> [!TIP]
> **Never use `-v` or `RESET=true` unless you want to start over from scratch.** Without these flags, the indexer picks up exactly where it left off.

