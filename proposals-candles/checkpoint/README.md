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
> **Ethereum Mainnet Indexing:** The default free RPC (`https://eth.llamarpc.com`) has a **1,000 block limit** per `eth_getLogs` request. This causes errors during initial sync:
> ```
> eth_getLogs range is too large, max is 1k blocks
> ```
> **Solution:** Use a production RPC (Infura, Alchemy, Quicknode) by setting `MAINNET_RPC_URL` in `.env` or docker-compose.
> 
> Gnosis Chain (chain 100) works fine with the default RPC.

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

# Filter by pool type
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
| `Proposal` | `id`, `chain`, `address`, `marketName` |
| `WhitelistedToken` | `id`, `chain`, `symbol`, `role`, `decimals` |
| `Pool` | `id`, `chain`, `dex`, `address`, `name`, `price`, `type`, `outcomeSide` |
| `Candle` | `id`, `pool`, `period`, `time`, `open`, `high`, `low`, `close` |
| `Swap` | `id`, `pool`, `timestamp`, `price`, `amount0`, `amount1` |

## Token Roles

| Role | Description |
|------|-------------|
| `COMPANY` | Base token (e.g., GNO) |
| `COLLATERAL` | Currency token (e.g., sDAI) |
| `YES_COMPANY` | Wrapped YES outcome of company token |
| `NO_COMPANY` | Wrapped NO outcome of company token |
| `YES_CURRENCY` | Wrapped YES outcome of currency token |
| `NO_CURRENCY` | Wrapped NO outcome of currency token |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `GNOSIS_RPC_URL` | `https://rpc.gnosis.gateway.fm` | Gnosis Chain RPC |
| `MAINNET_RPC_URL` | `https://eth.llamarpc.com` | Ethereum Mainnet RPC |
| `RESET` | `false` | Reset database on startup |
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

