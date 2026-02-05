# Migration Guide: Subgraph → Checkpoint

This guide covers migrating from The Graph subgraphs to Snapshot Checkpoint for proposal candle indexing.

## Key Differences

| Aspect | The Graph | Checkpoint |
|--------|-----------|------------|
| Language | AssemblyScript | TypeScript |
| Runtime | WASM sandbox | Native Node.js |
| Schema | GraphQL with @entity | GraphQL (no decorators) |
| Entities | Generated classes | Generated models |
| Event Args | `event.params.X` | `(event as any).args.X` |
| Contract Calls | `Contract.bind(addr)` | `viem.readContract()` |
| Dynamic Sources | `Template.create()` | `helpers.executeTemplate()` |
| Multichain | Separate deployments | Single instance |

---

## Schema Migration

### The Graph (schema.graphql)
```graphql
type Pool @entity {
  id: ID!
  token0: Token!
  price: BigDecimal!
}
```

### Checkpoint (schema.gql)
```graphql
type Pool {
  id: String!
  chain: Int!
  token0: String!
  price: String!
}
```

**Key changes:**
- Remove `@entity` decorator
- `ID!` → `String!`
- `BigDecimal!` → `String!` (stored as strings)
- Add `chain: Int!` for multichain support
- Relations become `String!` (store the ID)

---

## Handler Migration

### The Graph (mapping.ts)
```typescript
export function handleSwap(event: SwapEvent): void {
  let pool = Pool.load(event.address.toHexString())
  if (!pool) return
  
  pool.price = event.params.sqrtPriceX96.toBigDecimal()
  pool.save()
}
```

### Checkpoint (writers.ts)
```typescript
export const handleSwap: evm.Writer = async ({ event, source }) => {
  const indexer = getSourceName(source);
  const args = (event as any).args;
  const poolAddr = (event as any).address?.toLowerCase();
  const chainId = CHAIN_IDS[indexer] || 100;
  const poolId = `${chainId}-${poolAddr}`;
  
  const pool = await Pool.loadEntity(poolId, indexer);
  if (!pool) return;
  
  pool.price = args.sqrtPriceX96.toString();
  await pool.save();
};
```

**Key changes:**
- `export function` → `export const X: evm.Writer = async`
- `event.params.X` → `(event as any).args.X`
- `Pool.load(id)` → `Pool.loadEntity(id, indexer)`
- `pool.save()` → `await pool.save()` (async)
- Add chain prefix to IDs for multichain

---

## Contract Calls

### The Graph
```typescript
let contract = ERC20Contract.bind(address)
let symbol = contract.symbol()
```

### Checkpoint (using viem)
```typescript
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';

const client = createPublicClient({ chain: gnosis, transport: http() });

const symbol = await client.readContract({
  address: address as `0x${string}`,
  abi: ERC20Abi,
  functionName: 'symbol'
});
```

---

## Dynamic Data Sources (Templates)

### The Graph (subgraph.yaml)
```yaml
templates:
  - name: Pool
    source:
      abi: Pool
    mapping:
      eventHandlers:
        - event: Swap(...)
          handler: handleSwap
```

### Creating in Handler
```typescript
PoolTemplate.create(poolAddress)
```

### Checkpoint (config.ts)
```typescript
templates: {
  AlgebraPool: {
    abi: 'AlgebraPool',
    events: [
      { name: 'Swap', fn: 'handleSwap' }
    ]
  }
}
```

### Creating in Handler
```typescript
await helpers.executeTemplate('AlgebraPool', { 
  contract: poolAddr, 
  start: blockNumber 
});
```

---

## Testing with Chain 100 (Gnosis)

### 1. Start the indexer
```bash
docker compose down -v
docker compose build
RESET=true docker compose up -d
```

### 2. Verify proposals are indexed
```bash
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposals(where: { chain: 100 }, first: 5) { id address } }"}'
```

Expected:
```json
{
  "data": {
    "proposals": [
      { "id": "100-0xfc57fe22ff...", "address": "0xfc57fe22ff..." }
    ]
  }
}
```

### 3. Verify tokens are whitelisted
```bash
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ whitelistedtokens(where: { chain: 100 }) { id symbol role } }"}'
```

Expected:
```json
{
  "data": {
    "whitelistedtokens": [
      { "id": "100-0x9c58bacc...", "symbol": "GNO", "role": "COMPANY" },
      { "id": "100-0xaf204776...", "symbol": "sDAI", "role": "COLLATERAL" }
    ]
  }
}
```

### 4. Check health endpoint
```bash
curl http://localhost:3001/health
```

Expected:
```json
{"status":"ok","chains":["gnosis","mainnet"]}
```

---

## Chain-Prefixed IDs

All entity IDs include the chain ID for cross-chain uniqueness:

```
Format: {chainId}-{address}
Example: 100-0x9c58bacc331c9aa871afd802db6379a98e80cedb
```

This allows:
- Single database for all chains
- No ID collisions
- Filter by chain in queries
- Still search by raw address

---

## Debugging Tips

1. **Check logs:** `docker compose logs checkpoint -f`
2. **Reset database:** `docker compose down -v && RESET=true docker compose up -d`
3. **Test RPC:** Ensure `GNOSIS_RPC_URL` and `MAINNET_RPC_URL` are accessible
4. **Check health:** `curl http://localhost:3001/health`
