# Troubleshooting & Subgraph Comparison

## Troubleshooting Summary

We encountered several issues while building and deploying the `algebra-proposals-candles` subgraph. Here is a breakdown of the problems and their solutions:

### 1. PowerShell Command Syntax
- **Problem**: The `graph codegen && graph build` command failed because `&&` is not a valid operator in PowerShell.
- **Solution**: We ran `codegen` and `build` commands sequentially or used `npx` (which is generally more reliable for local dependencies).

### 2. Missing & Incorrect ABIs
- **Problem**: The initial build failed because `ERC20.json` and `AlgebraPool.json` were missing from the `abis` directory. Later, we found that simple event parameter mismatches in `AlgebraPool.json` (e.g., using `sqrtPrice` instead of `price` in the mapping) caused logic errors.
- **Solution**: We copied the correct ABIs from `futarchy-complete` and verified the event parameter names against the ABI files.

### 3. Compiler Crashes (The Main Blocker)
- **Problem**: The `graph build` command crashed repeatedly with a generic error. This is often caused by the AssemblyScript compiler choking on complex bindings or missing methods in the generated `ts` files.
- **Root Cause**: The `FutarchyProposal.json` ABI we were using was missing specific getter functions (like `outcomeToken0`, `outcomeToken1`, etc.) or they were not being generated correctly by the graph CLI, causing the compiler to fail when we tried to `bind` and call them.
- **Solution**:
    1. We inspected the generated `FutarchyProposal.ts` and found that `wrappedOutcome(index)` was available, while the direct named getters were problematic.
    2. We refactored `mapping.ts` to use `proposal.try_wrappedOutcome(BigInt.fromI32(i))` to fetch outcome tokens instead of trying to access non-existent or broken `outcomeTokenX` getters.
    3. We simplified the logic to be more robust, preventing the compiler from crashing.

## Subgraph Comparison

| Feature | `algebra-candles` (Original) | `algebra-proposals-candles` (New) |
| :--- | :--- | :--- |
| **Scope** | **Global**. Indexes *every* pool created by the Algebra Factory. | **Filtered**. Only indexes pools that contain "Whitelisted Tokens" (Outcome or Collateral tokens from valid Futarchy Proposals). |
| **Token Tracking** | Generic. Does not distinguish between token types. | **Role-Based**. Tags tokens as `BASE` (Outcome) or `QUOTE` (Collateral) upon Proposal creation. |
| **Price Logic** | Raw. Records price as `Token1/Token0` (or `Price` from event). | **Normalized**. Automatically inverts the price (`1/Price`) if the pool is detected as "Inverted" (i.e. if `Token0` is Quote and `Token1` is Base), ensuring all candles are `BASE/QUOTE`. |
| **Data Source** | `AlgebraFactory` only. | `FutarchyFactory` (for Metadata/Filtering) + `AlgebraFactory` (for Pool Events). |
| **Use Case** | General purpose analytics for all pools. | Specialized backend for the Futarchy Frontend candle charts. |

## Next Steps
- Verify the deployed subgraph on the Subgraph Studio.
- Update the frontend (`index.html`) to point to the new Subgraph URL.
