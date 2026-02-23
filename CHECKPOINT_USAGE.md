# Checkpoint Indexers Usage Guide

This guide explains how to run the **Snapshot Checkpoint** indexers for Futarchy. These are high-performance alternatives to The Graph subgraphs.

## Available Indexers

| Indexer | Port | Postgres | Container Name | Description |
|---------|------|----------|----------------|-------------|
| **proposals-candles** | 3001 | 5434 | `checkpoint-checkpoint-1` | Pool candles, swaps, proposals (Gnosis + Mainnet) |
| **futarchy-registry** | 3002 | 5435 | `futarchy-registry-checkpoint` | Organizations, proposals, metadata (Gnosis only) |

> **Note:** Both indexers can run simultaneously on different ports without conflicts.

---

## Quick Start

### Run Both Indexers Simultaneously

```bash
# Start Proposals-Candles (port 3001)
cd proposals-candles/checkpoint
docker compose up -d

# Start Futarchy Registry (port 3002)
cd ../futarchy-complete/checkpoint
docker compose up -d
```

### Check All Running Containers

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```

Expected output:
```
NAMES                          PORTS                        STATUS
checkpoint-checkpoint-1        0.0.0.0:3001->3000/tcp       Up
futarchy-registry-checkpoint   0.0.0.0:3002->3000/tcp       Up
```

---

## Individual Indexer Setup

### 1. Proposals Candles Indexer (Port 3001)

```bash
cd proposals-candles/checkpoint

# Start with default RPCs
docker compose up -d

# Or with custom RPCs (recommended for Mainnet)
MAINNET_RPC_URL=https://your-mainnet-rpc.com \
GNOSIS_RPC_URL=https://your-gnosis-rpc.com \
docker compose up -d

# Reset database and resync from scratch
RESET=true docker compose up -d
```

**GraphQL Endpoint:** http://localhost:3001/graphql

**Schema:** `pools`, `swaps`, `candles`, `proposals`, `whitelistedtokens`

### 2. Futarchy Registry Indexer (Port 3002)

```bash
cd futarchy-complete/checkpoint

# Start
docker compose up -d

# Reset and resync
RESET=true docker compose up -d
```

**GraphQL Endpoint:** http://localhost:3002/graphql

**Schema:** `organizations`, `proposalentities`, `metadataentries`, `aggregators`

---

## Environment Variables

| Variable | Default | Used By |
|----------|---------|---------|
| `MAINNET_RPC_URL` | `https://eth.llamarpc.com` | proposals-candles |
| `GNOSIS_RPC_URL` | `https://rpc.gnosischain.com` | proposals-candles |
| `RPC_URL` | `https://rpc.gnosischain.com` | futarchy-registry |
| `RESET` | `false` | Both (set `true` to wipe DB) |

> **Note:** Free RPCs have rate limits. For production, use paid RPCs like Infura or Alchemy.

---

## Common Commands

```bash
# View logs for each indexer
docker logs -f checkpoint-checkpoint-1        # proposals-candles
docker logs -f futarchy-registry-checkpoint   # registry

# Check sync status (proposals-candles AMM)
curl -s https://api.futarchy.fi/candles/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposals { id } }"}' | jq '.data.proposals | length'

# Check sync status (registry)
curl -s https://api.futarchy.fi/registry/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ organizations { id } }"}' | jq '.data.organizations | length'

# Stop individual indexer
cd proposals-candles/checkpoint && docker compose down
cd futarchy-complete/checkpoint && docker compose down

# Stop and remove data
docker compose down -v
```

---

## Example Queries (using `api.futarchy.fi`)

### 1. Futarchy Registry (`/registry/graphql`)

```graphql
# 1.1 Get proposal tracking code and address
query {
  proposalentities(where: { id: "0xa78a2d5844c653dac60da8a3f9ec958d09a4ee6a" }) {
    id
    proposalAddress
    owner
    organization {
      id
      owner
      aggregator {
        id
      }
    }
  }
}

# 1.2 Deep Nested Filtering (Secure Metadata Resolution)
# Guarantee a snapshot_id is legitimate by restricting the query path 
# all the way up to the canonical Gnosis DAO aggregator:
# Metadata -> Proposal -> Organization -> Aggregator
query {
  metadataentries(where: { 
    key: "snapshot_id",
    proposal_: { 
      organization_: { 
        aggregator_: { id: "0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1" } 
      } 
    } 
  }) {
    id
    value
    proposal {
      id
    }
  }
}
```

### 2. Proposals Candles / AMM (`/candles/graphql`)

> **Note:** AMM IDs are prefixed with the Chain ID (e.g., `100-` for Gnosis). Use the `proposalAddress` retrieved from the Registry in Step 1.1, and prepend `100-`.

```graphql
# 2.1 Get Trading Pools
query {
  pools(where: { 
    proposal: "100-0x45e1064348fd8a407d6d1f59fc64b05f633b28fc",
    type: "CONDITIONAL" # Or EXPECTED_VALUE, PREDICTION
  }) {
    id
    type
    outcomeSide  # YES or NO
    price
    token0
    token1
  }
}

# 2.2 Get Candlestick Price History (Using Pool ID)
query {
  candles(
    first: 10, 
    where: { pool: "100-0xf8346e622557763a62cc981187d084695ee296c3" }, 
    orderBy: time, 
    orderDirection: desc
  ) {
    id
    time
    open
    close
  }
}

# 2.3 Get Trade History (Latest Swaps)
query {
  swaps(
    first: 5, 
    where: { 
      pool_in: [
        "100-0xf8346e622557763a62cc981187d084695ee296c3", # YES Pool
        "100-0x76f78ec457c1b14bcf972f16eae44c7aa21d578f"  # NO Pool
      ] 
    }, 
    orderBy: timestamp, 
    orderDirection: desc
  ) {
    pool
    timestamp
    price
    amountIn
    amountOut
    symbolIn
    symbolOut
    transactionHash
  }
}
```

---

## Sync Times (Approximate)

| Chain | Start Block | Sync Time |
|-------|-------------|-----------|
| Gnosis | 38,000,000 | ~5-10 min |
| Mainnet | 21,000,000 | ~5-10 min |

---

## Troubleshooting

### Port Conflicts
If you see port conflicts, ensure both indexers use their designated ports:
- proposals-candles: **3001** (GraphQL), **5434** (Postgres)
- futarchy-registry: **3002** (GraphQL), **5435** (Postgres)

### RPC Rate Limits
If you see errors about block range limits, the indexer includes a patch for PublicNode's `-32603` error. For other RPCs, consider using paid endpoints.

### Database Issues
```bash
# Full reset for specific indexer
cd proposals-candles/checkpoint
docker compose down -v
RESET=true docker compose up -d
```

### Check Container Health
```bash
docker ps -a
docker logs checkpoint-checkpoint-1 --tail 50
docker logs futarchy-registry-checkpoint --tail 50
```
