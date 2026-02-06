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

## Query Examples

### Pools

```graphql
# By chain
{ pools(where: { chain: 1 }) { id name price } }

# By address (no prefix needed)
{ pools(where: { address: "0x44fea76b9f876d85c117e96f6a0323517210ca25" }) { 
  id chain name price liquidity 
}}

# By ID (with chain prefix)
{ pool(id: "1-0x44fea76b9f876d85c117e96f6a0323517210ca25") { 
  id chain address name price 
}}
```

### Swaps

```graphql
# All swaps by chain
{ swaps(where: { chain: 1 }, first: 10) { 
  transactionHash pool price amount0 amount1 timestamp 
}}

# Swaps for specific pool
{ swaps(where: { pool: "1-0x44fea76b9f876d85c117e96f6a0323517210ca25" }) { 
  transactionHash price timestamp 
}}

# Swaps by pool address (partial match)
{ swaps(where: { pool_contains: "0x44fea76b" }) { 
  chain pool price 
}}
```

### Whitelisted Tokens

```graphql
# All tokens by chain
{ whitelistedTokens(where: { chain: 1 }) { 
  id address symbol name decimals role 
}}

# By address (no prefix)
{ whitelistedTokens(where: { address: "0x4e107a0000db66f0e9fd2039288bf811dd1f9c74" }) {
  id chain symbol role
}}

# By role
{ whitelistedTokens(where: { role: "COMPANY" }) { 
  chain symbol address 
}}
```

### Proposals

```graphql
# All proposals by chain
{ proposals(where: { chain: 1 }) { 
  id address name status closeTimestamp 
}}

# By proposal address
{ proposals(where: { address: "0x..." }) { 
  id chain name yesPool noPool 
}}
```

### Candles

```graphql
# 1-hour candles for a pool
{ candles(where: { pool: "1-0x44fea76b...", period: 3600 }, orderBy: time) { 
  time open high low close volumeToken0 
}}

# All candles by chain
{ candles(where: { chain: 100, period: 3600 }, first: 100) { 
  pool time close 
}}
```

## Available Filter Fields

| Entity | Filter Fields |
|--------|---------------|
| `pools` | `id`, `chain`, `address`, `name`, `type`, `dex`, `proposal` |
| `swaps` | `id`, `chain`, `pool`, `transactionHash`, `timestamp` |
| `candles` | `id`, `chain`, `pool`, `period`, `time`, `periodStartUnix` |
| `proposals` | `id`, `chain`, `address`, `name`, `status` |
| `whitelistedTokens` | `id`, `chain`, `address`, `symbol`, `role` |

## Key Points

1. **ID format**: `{chain}-{address}` (e.g., `1-0xabc...` or `100-0xabc...`)
2. **Address queries**: Use `address` field to query without chain prefix
3. **Chain IDs**: 1 = Ethereum Mainnet, 100 = Gnosis
4. **Partial match**: Use `_contains` suffix for partial address matching
