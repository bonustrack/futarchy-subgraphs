# Uniswap V3 Migration Documentation

This directory `uniswap-proposals-candles` is a clone of `algebra-proposals-candles` adapted for **Uniswap V3 on Ethereum Mainnet**.

## 1. Network & Configuration Changes
*   **Target Network**: changed from `gnosis` to `mainnet`.
*   **Factory Address**: changed to Uniswap V3 Factory `0x1F98431c8aD98523631AE4a59f267346ea31F984`.
*   **Futarchy Factory**: changed to Mainnet deployment `0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678`.
*   **Start Block**: updated to `24068680`.

## 2. ABI & Event Changes
*   **Pool Creation**:
    *   **Old**: `Pool(address token0, address token1, address pool)` (Algebra)
    *   **New**: `PoolCreated(address token0, address token1, uint24 fee, int24 tickSpacing, address pool)` (Uniswap V3)
*   **Swap Event**:
    *   **Old**: `Swap(..., uint160 price, ...)` (Algebra exposes price directly)
    *   **New**: `Swap(..., uint160 sqrtPriceX96, ...)` (Uniswap V3 exposes raw math value)

## 3. Logic Refactoring (`src/mapping.ts`)
*   **Event Handling**: Updated `handlePoolCreated` to extract the pool address from the new `PoolCreated` event signature.
*   **Price Calculation**: Added a helper `convertSqrtPriceX96` to convert `sqrtPriceX96` into a readable `price` for the `Swap` entity, ensuring the Candle data remains consistent with the Algebra implementation.
*   **Pool Initialization**: Added `pool.fee` extraction from the creation event.

## 4. How to Run
1.  Install dependencies: `npm install`
2.  Generate types: `npm run codegen`
3.  Build subgraph: `npm run build`
