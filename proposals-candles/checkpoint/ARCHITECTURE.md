# Unified Multichain Checkpoint Indexer - Architecture Guide

## Overview

This indexer consolidates multiple DEXs and chains into a **single unified database** with chain-prefixed IDs, enabling cross-chain queries while maintaining data isolation.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Unified Checkpoint Indexer                   │
├─────────────────────────────────────────────────────────────────┤
│  Gnosis (Chain 100)          │  Mainnet (Chain 1)              │
│  ├── FutarchyFactory         │  ├── FutarchyFactory            │
│  └── AlgebraFactory          │  └── UniswapV3Factory           │
│       └── Algebra Pools      │       └── Uniswap V3 Pools      │
└────────────────────────────────────────────────────────────────-┘
                              ↓
                    ┌─────────────────┐
                    │  PostgreSQL DB  │
                    │  (Unified)      │
                    └─────────────────┘
```

---

## Chain-Prefixed ID Pattern

All entity IDs include the chain ID to ensure uniqueness across chains:

```typescript
// adapters/index.ts
export function createId(chainId: number, address: string): string {
    return `${chainId}-${address.toLowerCase()}`;
}

// Examples:
// Pool: "100-0x1234..." (Gnosis)
// Pool: "1-0x5678..."   (Mainnet)
```

Each entity stores the chain ID for easy filtering:

```graphql
type Pool {
  id: String!      # "100-0x1234..."
  chain: Int!      # 100 or 1
  dex: String!     # "ALGEBRA" or "UNISWAP_V3"
  ...
}
```

---

## DEX Adapter Pattern

The architecture isolates DEX-specific logic into **adapters** while sharing common patterns.

### Adding a New DEX (e.g., Balancer)

#### Step 1: Add DEX Type

```typescript
// adapters/index.ts
export type DexType = 'ALGEBRA' | 'UNISWAP_V3' | 'BALANCER'; // Add here
```

#### Step 2: Create ABI

```typescript
// abis/balancerPool.ts
export const BalancerPoolAbi = [
  {
    name: 'Swap',
    type: 'event',
    inputs: [
      { name: 'tokenIn', type: 'address', indexed: true },
      { name: 'tokenOut', type: 'address', indexed: true },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOut', type: 'uint256' }
    ]
  }
] as const;
```

#### Step 3: Add DEX-Specific Handler

```typescript
// writers.ts
export const handleBalancerPoolCreated: evm.Writer = async ({ event, blockNumber, source, helpers }) => {
  const indexer = getSourceName(source);
  const args = (event as any).args;
  const poolAddr = (args?.pool as string)?.toLowerCase();
  const tokens = args?.tokens; // Balancer has multiple tokens
  
  await createPoolEntity(indexer, poolAddr, tokens[0], tokens[1], 'BALANCER', null, blockNumber, helpers);
};
```

#### Step 4: Add Config Source

```typescript
// config.ts
export const arbitrumConfig = {
  network_node_url: process.env.ARBITRUM_RPC_URL,
  sources: [
    {
      contract: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Balancer Vault
      abi: 'BalancerVault',
      start: 50000000,
      events: [{ name: 'PoolCreated', fn: 'handleBalancerPoolCreated' }]
    }
  ],
  templates: {
    BalancerPool: {
      abi: 'BalancerPool',
      events: [
        { name: 'Swap', fn: 'handleSwap' } // Reuses shared handler!
      ]
    }
  }
};
```

#### Step 5: Register Indexer

```typescript
// index.ts
checkpoint.addIndexer('arbitrum', arbitrumConfig, new evm.EvmIndexer(writers));
```

---

## Shared vs DEX-Specific Handlers

| Handler Type | Example | When to Use |
|--------------|---------|-------------|
| **DEX-Specific** | `handleAlgebraPoolCreated`, `handleUniswapPoolCreated` | Pool creation differs per DEX |
| **Shared** | `handleSwap`, `handleMint`, `handleBurn` | Event signatures are identical |

### Why This Works

Both Algebra and Uniswap V3 pools emit the same `Swap` event signature:

```solidity
event Swap(
    address sender,
    address recipient,
    int256 amount0,
    int256 amount1,
    uint160 sqrtPriceX96,
    uint128 liquidity,
    int24 tick
);
```

So `handleSwap` in writers.ts handles both DEXs with no changes needed.

---

## Adding a New Chain

### Step 1: Add Chain ID

```typescript
// adapters/index.ts
export const CHAIN_IDS: Record<string, number> = {
    gnosis: 100,
    mainnet: 1,
    arbitrum: 42161,  // Add new chain
    polygon: 137
};
```

### Step 2: Add RPC Client

```typescript
// writers.ts
import { arbitrum } from 'viem/chains';

const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL)
});

const getClient = (indexer: string) => {
  switch (indexer) {
    case 'mainnet': return mainnetClient;
    case 'arbitrum': return arbitrumClient;
    default: return gnosisClient;
  }
};
```

### Step 3: Create Chain Config

```typescript
// config.ts
export const arbitrumConfig = { ... };
```

### Step 4: Register

```typescript
// index.ts
checkpoint.addIndexer('arbitrum', arbitrumConfig, new evm.EvmIndexer(writers));
```

---

## Query Examples

```graphql
# All Gnosis Algebra pools
query {
  pools(where: { chain: 100, dex: "ALGEBRA" }) {
    id, name, price
  }
}

# All Uniswap V3 pools (any chain)
query {
  pools(where: { dex: "UNISWAP_V3" }) {
    chain, id, name, price
  }
}

# Candles for a specific pool
query {
  candles(where: { pool: "100-0x1234...", period: 3600 }) {
    time, open, high, low, close
  }
}
```

---

## File Structure

```
checkpoint/
├── src/
│   ├── index.ts           # Entry point, registers all indexers
│   ├── config.ts          # Chain-specific configs
│   ├── writers.ts         # Event handlers (DEX-specific + shared)
│   ├── schema.gql         # Unified GraphQL schema
│   ├── adapters/
│   │   └── index.ts       # Utilities, price conversion, ID generation
│   └── abis/
│       ├── algebraPool.ts
│       ├── uniswapV3Pool.ts
│       ├── balancerPool.ts  # (future)
│       └── index.ts
├── Dockerfile
└── docker-compose.yml
```

---

## Key Design Decisions

1. **Chain in ID** - Ensures global uniqueness without cross-chain collisions
2. **DEX field** - Enables filtering by protocol in queries
3. **Shared handlers** - Reduces code duplication for common events
4. **Template pattern** - Dynamically tracks new pools as they're created
5. **Single database** - Simplifies deployment and cross-chain analytics
