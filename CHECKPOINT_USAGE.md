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

# Check sync status (proposals-candles)
curl -s http://localhost:3001/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposals { id } }"}' | jq '.data.proposals | length'

# Check sync status (registry)
curl -s http://localhost:3002/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ organizations { id } }"}' | jq '.data.organizations | length'

# Stop individual indexer
cd proposals-candles/checkpoint && docker compose down
cd futarchy-complete/checkpoint && docker compose down

# Stop and remove data
docker compose down -v
```

---

## Example Queries

### Proposals Candles (Port 3001)

```graphql
# Get all proposals by chain
{
  proposals {
    id
    chain
    address
    marketName
  }
}

# Get pools linked to proposals
{
  pools(where: { proposal_not: null }) {
    id
    name
    type
    outcomeSide
    proposal
  }
}

# Get 1-hour candles
{
  candles(where: { period: 3600 }, first: 10) {
    id
    pool
    open
    high
    low
    close
  }
}
```

### Futarchy Registry (Port 3002)

```graphql
# Get organizations
{
  organizations {
    id
    name
    owner
  }
}

# Get proposals with metadata
{
  proposalentities {
    id
    proposalAddress
    title
    displayNameEvent
    organization
  }
}

# Get metadata entries
{
  metadataentries(where: { key: "coingecko_ticker" }) {
    key
    value
    proposal
    organization
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
