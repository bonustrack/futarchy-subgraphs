# Checkpoint Framework Overview

How Snapshot Checkpoint works and how it could unify `algebra-proposals-candles` + `uniswap-proposals-candles` into a single multichain indexer.

---

## What is Checkpoint?

[Snapshot Checkpoint](https://github.com/snapshot-labs/checkpoint) is a library for indexing blockchain data and exposing it via GraphQL. It's similar to The Graph but runs as a native Node.js application.

| Feature | The Graph | Checkpoint |
|---------|-----------|------------|
| **Runtime** | WASM (AssemblyScript) | Node.js (TypeScript) |
| **Sync speed** | ~1-5k blocks/sec | ~25k blocks/sec |
| **Debugging** | Hard (WASM) | Easy (native) |
| **Deployment** | IPFS + Graph Node | Docker container |
| **Chains** | Per-subgraph | ✅ **Multichain in one instance** |

---

## Multichain Support ✅

Checkpoint supports **any EVM chain** via `evm.EvmIndexer`:

```typescript
import Checkpoint, { evm } from '@snapshot-labs/checkpoint';

const checkpoint = new Checkpoint(schema, { dbConnection: DATABASE_URL });

// Add Gnosis Chain indexer (for Algebra pools)
checkpoint.addIndexer('gnosis', gnosisConfig, new evm.EvmIndexer(writers));

// Add Ethereum Mainnet indexer (for Uniswap V3 pools)
checkpoint.addIndexer('mainnet', mainnetConfig, new evm.EvmIndexer(writers));

checkpoint.start();
```

### Config per Chain

```typescript
const gnosisConfig = {
  network_node_url: 'https://rpc.gnosischain.com',
  sources: [
    { contract: '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345', start: 40620030, events: [...] }
  ],
  templates: { AlgebraPool: { abi: AlgebraPoolAbi, events: [...] } }
};

const mainnetConfig = {
  network_node_url: 'https://eth.llamarpc.com',
  sources: [
    { contract: '0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678', start: 23807860, events: [...] }
  ],
  templates: { UniswapV3Pool: { abi: UniswapV3PoolAbi, events: [...] } }
};
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Checkpoint Instance                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │ Gnosis Indexer   │        │ Mainnet Indexer  │          │
│  │ (Algebra pools)  │        │ (Uniswap V3)     │          │
│  └────────┬─────────┘        └────────┬─────────┘          │
│           │                           │                     │
│           ▼                           ▼                     │
│  ┌─────────────────────────────────────────────────┐       │
│  │              Shared Writers                      │       │
│  │  handleNewProposal, handlePoolCreated, etc.     │       │
│  └─────────────────────────────────────────────────┘       │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Single PostgreSQL Database              │       │
│  │  (Entities tagged with chain source)            │       │
│  └─────────────────────────────────────────────────┘       │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────┐       │
│  │           GraphQL API (port 3000)               │       │
│  │         Query both chains in one API            │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Writers (Event Handlers)

```typescript
import { evm } from '@snapshot-labs/checkpoint';
import { Pool, Candle, Swap } from '../.checkpoint/models';

// Same handler works for both chains
export const handleSwap: evm.Writer = async ({ event, source, blockNumber }) => {
  const poolId = event.address.toLowerCase();
  const pool = await Pool.loadEntity(poolId);
  if (!pool) return;

  // Create swap entity tagged with chain source
  const swap = new Swap(`${event.transactionHash}-${event.logIndex}`, source);
  swap.pool = poolId;
  swap.amount0 = event.args.amount0.toString();
  swap.amount1 = event.args.amount1.toString();
  await swap.save();

  // Update candles
  await updateCandle(poolId, blockNumber, source);
};
```

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Source** | Chain identifier (`'gnosis'`, `'mainnet'`) passed to entities |
| **Templates** | Dynamic contract indexing (like Graph templates) |
| **Writers** | Event handlers (`evm.Writer` for EVM chains) |
| **Models** | Auto-generated from `schema.gql` via `npx checkpoint generate` |
| **Text scalar** | Use for long fields to avoid varchar(256) overflow |

---

## Unification Opportunity

Currently `algebra-proposals-candles` and `uniswap-proposals-candles` are separate subgraphs. With Checkpoint, they could be **unified**:

| Current | With Checkpoint |
|---------|-----------------|
| 2 separate subgraphs | 1 indexer instance |
| 2 deployments | 1 Docker container |
| Different GraphQL endpoints | Single unified API |
| Separate sync processes | Parallel chain indexing |

### Migration Path

1. Create `src/config.ts` with both chain configs
2. Create `src/writers.ts` with shared handlers
3. Use `source` parameter to distinguish chains in queries
4. Single `docker-compose.yml` for both chains
