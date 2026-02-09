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
