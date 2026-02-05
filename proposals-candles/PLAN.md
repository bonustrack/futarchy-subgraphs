# Unified Checkpoint Candles Indexer - Implementation Plan

Create a single Checkpoint indexer for **multichain proposal pool candles** (Algebra/Gnosis + Uniswap V3/Mainnet).

---

## Goal

Consolidate `algebra-proposals-candles` and `uniswap-proposals-candles` into one Checkpoint indexer that:
- Indexes both Gnosis (Algebra) and Mainnet (Uniswap V3) pools
- Uses a unified schema for both chains
- Exposes a single GraphQL API
- Uses TypeScript ABIs (like `futarchy-complete/checkpoint`)

---

## Proposed Changes

### [NEW] Directory Structure

```
proposals-candles/checkpoint/
├── docker-compose.yml
├── Dockerfile
├── init.sql
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                     # Express server + Checkpoint init
    ├── config.ts                    # Multi-chain config
    ├── schema.gql                   # Unified schema
    ├── writers.ts                   # Event handlers
    └── abis/
        ├── index.ts                 # Re-exports all ABIs
        ├── futarchyFactory.ts
        ├── futarchyProposal.ts
        ├── algebraFactory.ts
        ├── algebraPool.ts
        ├── uniswapV3Factory.ts
        ├── uniswapV3Pool.ts
        └── erc20.ts
```

---

### [NEW] `src/schema.gql`

```graphql
scalar Text

type WhitelistedToken {
  id: String!         # {chainId}-{address}
  chain: Int!         # 100 for Gnosis, 1 for Mainnet
  address: String!
  symbol: String
  decimals: Int
  role: String!
  proposal: String
}

type Proposal {
  id: String!         # {chainId}-{address}
  chain: Int!
  address: String!
  marketName: Text
  companyToken: String!
  currencyToken: String!
  outcomeTokens: Text
}

type Pool {
  id: String!         # {chainId}-{address}
  chain: Int!
  address: String!
  dex: String!        # "ALGEBRA" or "UNISWAP_V3"
  token0: String!
  token1: String!
  fee: String
  liquidity: String!
  sqrtPrice: String!
  price: String!
  tick: Int
  isInverted: Int!
  name: String!
  type: String!
  outcomeSide: String
  volumeToken0: String!
  volumeToken1: String!
  proposal: String
}

type Candle {
  id: String!
  chain: Int!
  pool: String!
  time: Int!
  period: Int!
  periodStartUnix: Int!
  block: Int!
  open: String!
  high: String!
  low: String!
  close: String!
  volumeToken0: String!
  volumeToken1: String!
}

type Swap {
  id: String!
  chain: Int!
  transactionHash: String!
  timestamp: Int!
  pool: String!
  sender: String!
  recipient: String!
  origin: String!
  amount0: String!
  amount1: String!
  amountIn: String!
  amountOut: String!
  tokenIn: String!
  tokenOut: String!
  price: String!
}
```

---

### [NEW] `src/config.ts`

Dual-chain configuration:

```typescript
import { CheckpointConfig } from '@snapshot-labs/checkpoint';
import { 
  FutarchyFactoryAbi, AlgebraFactoryAbi, AlgebraPoolAbi,
  UniswapV3FactoryAbi, UniswapV3PoolAbi, ERC20Abi 
} from './abis';

// Gnosis Chain (Algebra)
export const gnosisConfig: CheckpointConfig = {
  network_node_url: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosis.gateway.fm',
  sources: [
    {
      contract: '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345',
      abi: 'FutarchyFactory',
      start: 40620030,
      events: [{ name: 'NewProposal(address,string,bytes32,bytes32)', fn: 'handleNewProposal' }]
    },
    {
      contract: '0xa0864cca6e114013ab0e27cbd5b6f4c8947da766',
      abi: 'AlgebraFactory',
      start: 40620030,
      events: [{ name: 'Pool(address,address,address)', fn: 'handleAlgebraPoolCreated' }]
    }
  ],
  templates: {
    AlgebraPool: {
      abi: 'AlgebraPool',
      events: [
        { name: 'Initialize(uint160,int24)', fn: 'handleInitialize' },
        { name: 'Swap(address,address,int256,int256,uint160,uint128,int24)', fn: 'handleSwap' },
        { name: 'Mint(address,address,int24,int24,uint128,uint256,uint256)', fn: 'handleMint' },
        { name: 'Burn(address,int24,int24,uint128,uint256,uint256)', fn: 'handleBurn' }
      ]
    }
  },
  abis: { FutarchyFactory: FutarchyFactoryAbi, AlgebraFactory: AlgebraFactoryAbi, AlgebraPool: AlgebraPoolAbi, ERC20: ERC20Abi }
};

// Ethereum Mainnet (Uniswap V3)
export const mainnetConfig: CheckpointConfig = {
  network_node_url: process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com',
  sources: [
    {
      contract: '0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678',
      abi: 'FutarchyFactory',
      start: 23807860,
      events: [{ name: 'NewProposal(address,string,bytes32,bytes32)', fn: 'handleNewProposal' }]
    },
    {
      contract: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      abi: 'UniswapV3Factory',
      start: 23807860,
      events: [{ name: 'PoolCreated(address,address,uint24,int24,address)', fn: 'handleUniswapPoolCreated' }]
    }
  ],
  templates: {
    UniswapV3Pool: {
      abi: 'UniswapV3Pool',
      events: [
        { name: 'Initialize(uint160,int24)', fn: 'handleInitialize' },
        { name: 'Swap(address,address,int256,int256,uint160,uint128,int24)', fn: 'handleSwap' },
        { name: 'Mint(address,address,int24,int24,uint128,uint256,uint256)', fn: 'handleMint' },
        { name: 'Burn(address,int24,int24,uint128,uint256,uint256)', fn: 'handleBurn' }
      ]
    }
  },
  abis: { FutarchyFactory: FutarchyFactoryAbi, UniswapV3Factory: UniswapV3FactoryAbi, UniswapV3Pool: UniswapV3PoolAbi, ERC20: ERC20Abi }
};
```

---

### [NEW] `src/index.ts`

```typescript
import Checkpoint, { evm } from '@snapshot-labs/checkpoint';
import express from 'express';
import * as writers from './writers';
import { gnosisConfig, mainnetConfig } from './config';
import schema from './schema.gql';

const app = express();
const checkpoint = new Checkpoint(schema, { dbConnection: process.env.DATABASE_URL });

checkpoint.addIndexer('gnosis', gnosisConfig, new evm.EvmIndexer(writers));
checkpoint.addIndexer('mainnet', mainnetConfig, new evm.EvmIndexer(writers));

app.use('/graphql', checkpoint.graphql);
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.listen(3000);

process.env.RESET === 'true' ? checkpoint.reset().then(() => checkpoint.start()) : checkpoint.start();
```

---

### [NEW] `src/abis/` (TypeScript ABIs)

Convert existing JSON ABIs to TypeScript with `as const`:

```typescript
// src/abis/algebraPool.ts
export const AlgebraPoolAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'uint160', name: 'price', type: 'uint160' },
      { indexed: false, internalType: 'int24', name: 'tick', type: 'int24' }
    ],
    name: 'Initialize',
    type: 'event'
  },
  // ... other events
] as const;
```

---

## Implementation Steps

- [ ] Create `proposals-candles/checkpoint/` directory
- [ ] Convert JSON ABIs to TypeScript files in `src/abis/`
- [ ] Create `src/schema.gql` with chain-prefixed IDs
- [ ] Create `src/config.ts` with dual-chain configs
- [ ] Create `src/index.ts` with multi-indexer setup
- [ ] Port `mapping.ts` logic to `src/writers.ts`
- [ ] Create `docker-compose.yml`, `Dockerfile`, `init.sql`
- [ ] Test with `RESET=true docker compose up -d`

---

## Verification Plan

### Manual Verification

1. **Start the indexer**:
   ```bash
   cd proposals-candles/checkpoint
   RESET=true docker compose up -d
   docker compose logs -f checkpoint
   ```

2. **Query Gnosis pools**:
   ```bash
   curl -s http://localhost:3000/graphql -X POST \
     -H "Content-Type: application/json" \
     -d '{"query":"{ pools(where: { chain: 100 }) { id dex type } }"}'
   ```

3. **Query Mainnet pools**:
   ```bash
   curl -s http://localhost:3000/graphql -X POST \
     -H "Content-Type: application/json" \
     -d '{"query":"{ pools(where: { chain: 1 }) { id dex type } }"}'
   ```

4. **Compare against existing subgraph data** for parity check
