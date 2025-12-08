# Normalization Logic: How we get "Perfect" Data

You asked:
> "trade return if im buying or selling company token right the rprice of the trade it is ajdusted lright vlaue not ivnerted"

This is **exactly** what the Mapping layer handles. Here is the logic we use to ensure the data is perfect before it ever reaches the API.

## 1. The "Base vs Quote" Problem
On-chain, Uniswap/Algebra pools just have `token0` and `token1` (sorted by address).
- Pool A: `token0` = USDC, `token1` = YES_TOKEN
- Pool B: `token0` = YES_TOKEN, `token1` = USDC

If we just indexed this raw, `price` would be flipped half the time.

## 2. The Solution: Semantic Mapping
When we link a pool to a Proposal (as described in `RETROACTIVE_DATA.md`), we assign it a **Role**.

**Example: Conditional Yes Pool**
- We *know* this pool is supposed to trade `YES_COMPANY` (Base) against `YES_CURRENCY` (Quote).
- The mapping checks the raw pool tokens:
  - If `pool.token0 == YES_COMPANY`: **Standard Order**.
  - If `pool.token0 == YES_CURRENCY`: **Inverted Order**.

## 3. Normalizing "Price"
The Subgraph applies this logic **during indexing**:

```typescript
// Pseudocode in mapping.ts
function getNormalizedPrice(pool, rawPrice): BigDecimal {
  if (pool.isInverted) {
    return 1 / rawPrice; // Automatically invert so it's ALWAYS Quote per Base
  }
  return rawPrice;
}
```

**Result**: The `currentPrice` and all `candle.close` values in the GraphQL API are **always**:
*   "How much [Currency] for 1 [CompanyToken]?"

## 4. Normalizing "Buy vs Sell"
We interpret the direction of the swap based on the fixed role.

**Scenario**: User sells 100 `YES_COMPANY` for USDC.
- **Raw Event**: `amount0 = -100` (exact output), `amount1 = +50` (input).
- **Logic**:
  1.  We see negative `YES_COMPANY` flow from the pool's perspective (Pool lost tokens, User gained? No, wait).
  2.  Actually, in V3:
      - `amount < 0` means the Pool sent tokens OUT (User BOUGHT).
      - `amount > 0` means the Pool received tokens IN (User SOLD).
  3.  **Correction**:
      - If `YES_COMPANY` amount is **positive** -> Pool received Company Tokens -> **User SOLD**.
      - If `YES_COMPANY` amount is **negative** -> Pool sent Company Tokens -> **User BOUGHT**.

**Result**: The `UnifiedTrade` entity has a simple field:
- `type: "BUY"` (User bought the Company Token)
- `type: "SELL"` (User sold the Company Token)

No more mental gymnastics on the frontend.
