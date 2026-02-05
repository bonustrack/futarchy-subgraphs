# Proposals Candles Subgraphs Comparison

Comparison of `algebra-proposals-candles` (Gnosis) vs `uniswap-proposals-candles` (Ethereum Mainnet).

## TL;DR

> [!IMPORTANT]
> **The two subgraphs are functionally identical** — they expose the same GraphQL schema, handle the same business logic (Futarchy proposal pools, OHLCV candles, swap tracking), and share ~95% of the same mapping code. The only differences are DEX-specific configurations (Algebra vs Uniswap V3).

---

## Schema Comparison

| Aspect | algebra-proposals-candles | uniswap-proposals-candles |
|--------|---------------------------|---------------------------|
| **schema.graphql** | 90 lines, 1884 bytes | 90 lines, 1884 bytes |
| **Entities** | `WhitelistedToken`, `Proposal`, `Pool`, `Candle`, `Swap` | ✅ **Identical** |
| **Fields** | All fields identical | ✅ **Identical** |

### Shared Entity Structure
```graphql
WhitelistedToken { id, symbol, decimals, role, proposal }
Proposal { id, marketName, companyToken, currencyToken, pools, outcomeTokens }
Pool { id, token0, token1, fee, liquidity, sqrtPrice, price, tick, isInverted, name, type, outcomeSide, volume*, candles, proposal }
Candle { id, time, period, periodStartUnix, pool, block, open, high, low, close, volume* }
Swap { id, transactionHash, timestamp, pool, sender, recipient, origin, amount0, amount1, amountIn, amountOut, tokenIn, tokenOut, price }
```

---

## Subgraph Configuration (`subgraph.yaml`)

| Aspect | algebra-proposals-candles | uniswap-proposals-candles |
|--------|---------------------------|---------------------------|
| **Network** | `gnosis` | `mainnet` |
| **FutarchyFactory** | `0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345` | `0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678` |
| **Start Block** | `40620030` | `23807860` |
| **DEX Factory** | AlgebraFactory `0xa0864cca6e114013ab0e27cbd5b6f4c8947da766` | UniswapV3Factory `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| **Pool Created Event** | `Pool(indexed address,indexed address,address)` | `PoolCreated(indexed address,indexed address,indexed uint24,int24,address)` |
| **Pool Template** | `AlgebraPool` | `UniswapV3Pool` |

### Key Event Differences

| Event | Algebra | Uniswap V3 |
|-------|---------|------------|
| **Pool Created** | `Pool(token0, token1, pool)` — no fee tier | `PoolCreated(token0, token1, fee, tickSpacing, pool)` — includes fee |
| **Initialize** | `Initialize(price, tick)` | `Initialize(sqrtPriceX96, tick)` — parameter named differently |
| **Swap** | Same signature | Same signature |
| **Mint** | `liquidityAmount` param | `amount` param |
| **Burn** | `liquidityAmount` param | `amount` param |

---

## Mapping Code (`src/mapping.ts`)

| Aspect | algebra-proposals-candles | uniswap-proposals-candles |
|--------|---------------------------|---------------------------|
| **File Size** | 468 lines, 16857 bytes | 469 lines, 17251 bytes |
| **Logic Overlap** | ~95% identical | ~95% identical |

### Code Differences Summary

#### 1. Import Statements
```diff
- import { Pool as PoolCreated } from "../generated/AlgebraFactory/AlgebraFactory"
+ import { PoolCreated } from "../generated/UniswapV3Factory/UniswapV3Factory"

- import { ... } from "../generated/templates/AlgebraPool/AlgebraPool"
+ import { ... } from "../generated/templates/UniswapV3Pool/UniswapV3Pool"

- import { AlgebraPool } from "../generated/templates"
+ import { UniswapV3Pool } from "../generated/templates"
```

#### 2. Fee Handling in `handlePoolCreated`
```diff
// Algebra: No fee in event, hardcoded to 0
- pool.fee = BigInt.fromI32(0)

// Uniswap V3: Fee from event params
+ pool.fee = BigInt.fromI32(event.params.fee)
```

#### 3. SqrtPrice Parameter Naming in `handleInitialize`
```diff
// Algebra: Uses 'price' parameter name
- let priceRaw = convertSqrtPriceX96(event.params.price)
- pool.sqrtPrice = event.params.price

// Uniswap V3: Uses 'sqrtPriceX96' parameter name  
+ let priceRaw = convertSqrtPriceX96(event.params.sqrtPriceX96)
+ pool.sqrtPrice = event.params.sqrtPriceX96
```

#### 4. Mint/Burn Event Params
```diff
// Algebra: Uses liquidityAmount
- pool.liquidity = pool.liquidity.plus(event.params.liquidityAmount)
- pool.liquidity = pool.liquidity.minus(event.params.liquidityAmount)

// Uniswap V3: Uses amount
+ pool.liquidity = pool.liquidity.plus(event.params.amount)
+ pool.liquidity = pool.liquidity.minus(event.params.amount)
```

#### 5. Template Creation
```diff
- AlgebraPool.create(event.params.pool)
+ UniswapV3Pool.create(event.params.pool)
```

---

## ABIs Comparison

| Algebra Subgraph | Uniswap V3 Subgraph |
|------------------|---------------------|
| `AlgebraFactory.json` | `UniswapV3Factory.json` |
| `AlgebraPool.json` | `UniswapV3Pool.json` |
| `ERC20.json` | `ERC20.json` ✅ shared |
| `FutarchyFactory.json` | `FutarchyFactory.json` ✅ shared |
| `FutarchyProposal.json` | `FutarchyProposal.json` ✅ shared |
| — | `NonfungiblePositionManager.json` (extra) |

---

## Candle Periods (Both Identical)

```typescript
const CANDLE_PERIODS: i32[] = [60, 300, 900, 3600, 14400, 86400]
// 1min, 5min, 15min, 1hr, 4hr, 1day
```

---

## Pool Classification Logic (Identical)

Both use the same role-based classification:

| Role Constants | Pool Type Assignment |
|---------------|---------------------|
| `YES_COMPANY`, `NO_COMPANY` + `COLLATERAL` | `EXPECTED_VALUE` |
| `YES_CURRENCY`, `NO_CURRENCY` + `COLLATERAL` | `PREDICTION` |
| Company Outcome vs Currency Outcome | `CONDITIONAL` |

---

## Conclusion

These two subgraphs are **chain-specific adaptations of the same design**:

| Feature | Status |
|---------|--------|
| GraphQL API | ✅ 100% compatible |
| Query interface | ✅ Identical |
| Business logic | ✅ Identical |
| Data model | ✅ Identical |
| Only difference | DEX protocol + network config |

**Recommendation**: These could potentially be unified into a single codebase with network-specific configuration files.
