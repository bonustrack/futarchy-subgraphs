# Futarchy Checkpoint Indexers — Setup Guide

Two Docker-based checkpoint indexers power the Futarchy data layer:

| Service | Port | Data | Chains |
|---------|------|------|--------|
| **Registry** | `3002` | Organizations, proposals, metadata | Gnosis (100) |
| **Proposals Candles** | `3001` | Pools, swaps, OHLCV candles | Gnosis (100), Ethereum (1) |

## Prerequisites

- Docker & Docker Compose
- (Optional) Infura/Alchemy key for faster Mainnet indexing

---

## 1. Registry Checkpoint (port 3002)

```bash
cd futarchy-complete/checkpoint

# First run — creates tables
RESET=true docker compose -p futarchy-complete up --build -d

# Normal run — resumes from last block
docker compose -p futarchy-complete up -d

# Check logs
docker logs futarchy-registry-checkpoint -f

# GraphQL
curl http://localhost:3002/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ organizations { name } }"}'
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RPC_URL` | `https://rpc.gnosischain.com` | Gnosis RPC |
| `RESET` | `false` | Reset DB on start |

---

## 2. Proposals Candles (port 3001)

```bash
cd proposals-candles/checkpoint

# First run — creates tables
RESET=true docker compose -p futarchy-candles up --build -d

# With custom Mainnet RPC (recommended)
RESET=true MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY \
  docker compose -p futarchy-candles up --build -d

# Normal run
docker compose -p futarchy-candles up -d

# Check logs
docker logs futarchy-candles-checkpoint-1 -f

# GraphQL
curl http://localhost:3001/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposals { marketName chain } }"}'
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GNOSIS_RPC_URL` | `https://rpc.gnosis.gateway.fm` | Gnosis RPC |
| `MAINNET_RPC_URL` | `https://eth.llamarpc.com` | Ethereum RPC |
| `RESET` | `false` | Reset DB on start |

> **⚠️ Mainnet RPC:** The default free RPC has a 1k block limit. Use Infura/Alchemy for faster sync.

### Candle Chart UI

Open **http://localhost:3001/index.html** after startup for the built-in candle explorer.

---

## Start Both at Once

```bash
# From repo root
cd futarchy-complete/checkpoint && RESET=true docker compose -p futarchy-complete up --build -d && cd ../..
cd proposals-candles/checkpoint && RESET=true MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY docker compose -p futarchy-candles up --build -d
```

## Stop Both

```bash
cd futarchy-complete/checkpoint && docker compose -p futarchy-complete down
cd proposals-candles/checkpoint && docker compose -p futarchy-candles down
# Add -v to also wipe data volumes
```

## Check Status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep futarchy
```

## Ports Summary

| Port | Service |
|------|---------|
| `3001` | Candles GraphQL + Chart UI |
| `3002` | Registry GraphQL |
| `5434` | Candles Postgres |
| `5435` | Registry Postgres |

---

## Schema Differences: Checkpoint vs Old Subgraphs

The unified checkpoint replaces two separate subgraphs with one multichain schema.

### Old Architecture (Separate Subgraphs)

| Subgraph | Chain | DEX | Endpoints |
|----------|-------|-----|-----------|
| `algebra-candles` | Gnosis (100) | Algebra | Graph Node |
| `uniswap-proposals-candles` | Ethereum (1) | Uniswap V3 | Graph Studio |

### New Architecture (Unified Checkpoint)

| Service | Chains | DEXs | Endpoint |
|---------|--------|------|----------|
| `proposals-candles` checkpoint | Gnosis + Ethereum | Algebra + Uniswap V3 | `localhost:3001/graphql` |

---

### Key Schema Changes

#### 1. Chain-Prefixed IDs

All entity IDs are now prefixed with the chain ID:

```diff
# Old (subgraph) — ID is just the address
- id: "0xf8346e622557763a62cc981187d084695ee296c3"

# New (checkpoint) — ID is chain-address
+ id: "100-0xf8346e622557763a62cc981187d084695ee296c3"
```

This applies to **all entities**: Proposal, Pool, Candle, Swap.

#### 2. `chain` Field on Every Entity

Every entity now has a `chain: Int!` field (`100` for Gnosis, `1` for Ethereum):

```graphql
# Checkpoint schema
type Pool {
  id: String!      # "100-0xabc..." or "1-0xabc..."
  chain: Int!      # 100 or 1
  address: String! # "0xabc..." (raw address without prefix)
  ...
}
```

#### 3. Type Changes (BigDecimal → String, Bytes → String)

| Field | Old Subgraph | Checkpoint |
|-------|-------------|------------|
| Prices (`open`, `close`, etc.) | `BigDecimal!` | `String!` |
| Volume | `BigDecimal!` | `String!` |
| Addresses (`sender`, `token0`) | `Bytes!` | `String!` |
| Timestamps | `BigInt!` | `Int!` |
| IDs | `ID!` | `String!` |
| `isInverted` | `Boolean!` | `Int!` (0/1) |

#### 4. No Entity Relations (Flat Schema)

Old subgraphs used `@entity` relations:
```graphql
# Old — nested entity references
type Pool {
  token0: WhitelistedToken!  # Nested object
  proposal: Proposal         # Nested object
  candles: [Candle!]! @derivedFrom(field: "pool")
}
```

Checkpoint uses flat string references:
```graphql
# New — flat string IDs
type Pool {
  token0: String!     # "0xabc..."
  proposal: String    # "100-0xabc..."
  # No @derivedFrom — query candles separately with where filter
}
```

#### 5. New Fields

| Field | Description |
|-------|-------------|
| `Pool.dex` | `"ALGEBRA"` or `"UNISWAP_V3"` |
| `Swap.tokenIn` / `tokenOut` | `"token0"` or `"token1"` (string, not entity ref) |

#### 6. Removed Fields

| Field | Old Subgraph | Checkpoint |
|-------|-------------|------------|
| `Candle.volumeUSD` | ✅ | ❌ removed |
| `Candle.txCount` | ✅ (algebra) | ❌ removed |
| `Trade.liquidity` | ✅ (algebra) | ❌ removed |
| `Trade.tick` | ✅ (algebra) | ❌ removed |

---

### Query Migration Examples

**List proposals (old → new):**
```diff
# Old (uniswap subgraph)
- { proposals { id  marketName } }

# New (checkpoint) — filter by chain
+ { proposals(where: { chain: 1 }) { id chain marketName address } }
```

**Get candles for a pool (old → new):**
```diff
# Old — nested via pool entity
- { candles(where: { pool: "0xabc..." }) { open close } }

# New — chain-prefixed pool ID
+ { candles(where: { pool: "100-0xabc...", period: 3600 }) { open close } }
```

**Get pools for a proposal (old → new):**
```diff
# Old — nested proposal reference
- { pools(where: { proposal: "0xabc..." }) { name type } }

# New — chain-prefixed proposal ID
+ { pools(where: { proposal: "100-0xabc..." }) { name type chain dex } }
```
