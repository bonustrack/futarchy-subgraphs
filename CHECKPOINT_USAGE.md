# Checkpoint Indexers Usage Guide

This guide explains how to run the **Snapshot Checkpoint** indexers for Futarchy. These are high-performance alternatives to The Graph subgraphs.

## Available Indexers

| Indexer | Port | Chains | Description |
|---------|------|--------|-------------|
| **proposals-candles** | 3001 | Gnosis + Mainnet | Pool candles, swaps, proposals |
| **futarchy-complete** | 3000 | Gnosis only | Full governance: organizations, proposals, metadata |


---

## Quick Start

### 1. Proposals Candles Indexer

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

### 2. Futarchy Complete Indexer

```bash
cd futarchy-complete/checkpoint

# Start
docker compose up -d

# Reset and resync
RESET=true docker compose up -d
```

**GraphQL Endpoint:** http://localhost:3000/graphql

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAINNET_RPC_URL` | `https://eth.llamarpc.com` | Ethereum RPC endpoint |
| `GNOSIS_RPC_URL` | `https://rpc.gnosischain.com` | Gnosis Chain RPC endpoint |
| `RESET` | `false` | Set to `true` to wipe DB and resync |

> **Note:** Free RPCs have rate limits. For production, use paid RPCs like Infura or Alchemy.

---

## Common Commands

```bash
# View logs
docker compose logs -f checkpoint

# Check sync status
curl -s -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposals { id } }"}' | jq '.data.proposals | length'

# Stop
docker compose down

# Stop and remove data
docker compose down -v
```

---

## Example Queries

### Proposals Candles

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

### Futarchy Complete

```graphql
# Get organizations
{
  organizations {
    id
    name
    description
  }
}

# Get proposals with metadata
{
  proposalmetadatas {
    id
    displayNameQuestion
    displayNameEvent
  }
}
```

---

## Sync Times (Approximate)

| Chain | Start Block | Sync Time |
|-------|-------------|-----------|
| Gnosis | 35,000,000 | ~30-40 min |
| Mainnet | 23,400,000 | ~10-15 min |

---

## Troubleshooting

### RPC Rate Limits
If you see errors about block range limits, the indexer includes a patch for PublicNode's `-32603` error. For other RPCs, consider using paid endpoints.

### Database Issues
```bash
# Full reset
docker compose down -v
RESET=true docker compose up -d
```

### Check Container Health
```bash
docker compose ps
docker compose logs checkpoint --tail 50
```
