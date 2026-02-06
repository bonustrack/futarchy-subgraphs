# Multichain Proposals-Candles: Migration from Graph Node

This document explains the key differences between the Graph Node subgraphs and the Checkpoint multichain indexer.

## Architecture Comparison

| Aspect | Graph Node Subgraphs | Checkpoint Multichain |
|--------|---------------------|----------------------|
| **Chains** | Separate deployments per chain | Single unified endpoint |
| **Entity IDs** | Just address (`0xabc...`) | Chain-prefixed (`1-0xabc...`) |
| **Endpoints** | Multiple URLs | Single `/graphql` endpoint |
| **Query by chain** | Different subgraph URL | `where: { chain: 1 }` filter |

## Key Differences

### 1. Entity IDs Include Chain Prefix

Graph Node:
```graphql
{ pool(id: "0xd43019d85b0e4ce19f1b06e68831fce311f96349") { ... } }
```

Checkpoint:
```graphql
# By ID (with prefix)
{ pool(id: "1-0xd43019d85b0e4ce19f1b06e68831fce311f96349") { ... } }

# By address (filter - no prefix needed)
{ pools(where: { address: "0xd43019d85b0e4ce19f1b06e68831fce311f96349" }) { ... } }
```

### 2. Chain Field Available

Every entity has:
- `id`: Chain-prefixed unique ID (e.g., `1-0xabc...` or `100-0xabc...`)
- `chain`: Numeric chain ID (1 = Mainnet, 100 = Gnosis)
- `address`: Plain address without prefix

### 3. Query Patterns

```graphql
# Get all Mainnet pools
{ pools(where: { chain: 1 }) { id name price } }

# Get all Gnosis pools
{ pools(where: { chain: 100 }) { id name price } }

# Get pool by address (works across chains)
{ pools(where: { address: "0xd43019..." }) { chain name price } }

# Get candles for specific pool AND chain
{ candles(where: { chain: 1, pool: "1-0xd43019..." }) { time close } }

# Get swaps by chain
{ swaps(where: { chain: 100 }, first: 10) { pool price timestamp } }
```

## Chain IDs

| Chain | ID | Subgraph Folder |
|-------|-----|-----------------|
| Ethereum Mainnet | `1` | `uniswap-proposals-candles/` |
| Gnosis | `100` | `algebra-proposals-candles/` |

## Migration Checklist

1. **Update endpoint URL** - Single Checkpoint endpoint instead of multiple subgraph URLs
2. **Add chain filter** - Use `where: { chain: X }` to scope queries
3. **Update ID references** - If using pool IDs directly, add chain prefix OR use address filter
4. **Handle both chains** - Can now query both chains in sequence from same endpoint

## Example: Before & After

**Before (Graph Node - Gnosis only):**
```javascript
const response = await fetch('https://api.thegraph.com/subgraphs/.../algebra-proposals-candles', {
  method: 'POST',
  body: JSON.stringify({
    query: `{ pools { id name price } }`
  })
});
```

**After (Checkpoint - Multichain):**
```javascript
const response = await fetch('http://localhost:3001/graphql', {
  method: 'POST',
  body: JSON.stringify({
    query: `{ 
      pools(where: { chain: 100 }) { id name price }  # Gnosis
    }`
  })
});

// Or query both chains
const response = await fetch('http://localhost:3001/graphql', {
  method: 'POST',
  body: JSON.stringify({
    query: `{ 
      pools { id chain name price }  # All chains
    }`
  })
});
```

## Available Entities

| Entity | Description |
|--------|-------------|
| `pools` | Trading pools (Uniswap V3 / Algebra) |
| `candles` | OHLCV price data by period |
| `swaps` | Individual trade events |
| `proposals` | Futarchy proposals |
| `whitelistedTokens` | Tracked tokens by role |
