import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import { Swap } from "../generated/AlgebraPool/AlgebraPool"
import { Pool, Candle } from "../generated/schema"

// Constant: 2^96 as a BigDecimal
const Q96 = BigDecimal.fromString("79228162514264337593543950336")

// Helper: Convert Q64.96 price to Human-Readable Price (Token1 per Token0)
function getPrice(priceQ96: BigInt, decimal0: BigInt, decimal1: BigInt): BigDecimal {
    let value = priceQ96.toBigDecimal()
    let priceRaw = value.div(Q96).times(value.div(Q96)) // (sqrtP / 2^96) ^ 2

    // Adjust for token decimals to get real price
    let scaler0 = BigInt.fromI32(10).pow(u8(decimal0.toI32())).toBigDecimal()
    let scaler1 = BigInt.fromI32(10).pow(u8(decimal1.toI32())).toBigDecimal()

    return priceRaw.times(scaler0).div(scaler1)
}

export function handleSwap(event: Swap): void {
    let poolId = event.address.toHexString()
    let pool = Pool.load(poolId)

    // Initialize pool if it doesn't exist (though usually we'd have a factory/initializer)
    if (pool == null) {
        pool = new Pool(poolId)
        // Hardcoding decimals for now based on typical Gnosis tokens, BUT ideally should fetch or be flexible.
        // Assuming 18 decimals for both as default, but this should be verified with the token addresses in real usage.
        // For this specific request, we'll initialize with defaults and let the values update.
        // NOTE: Using hardcoded 18 for now as we don't have the token calls.
        pool.decimal0 = BigInt.fromI32(18)
        pool.decimal1 = BigInt.fromI32(18)
        // We also need token0 and token1 addresses, which we can't easily get without call handlers or factory.
        // Setting placeholders or defaults.
        pool.token0 = event.params.sender // Placeholder, should be setup properly
        pool.token1 = event.params.recipient // Placeholder
        pool.lastPrice = BigDecimal.zero()
        pool.tick = BigInt.zero()
        pool.timestamp = BigInt.zero()
    }

    // 1. Calculate New Price from the event
    // Algebra emits 'price' (uint160) which is the NEW sqrtPrice after the swap
    let newPrice = getPrice(event.params.price, pool.decimal0, pool.decimal1)

    // 2. Identify the "Old Price" (Current state before this swap)
    // We use this to set the Candle OPEN price. 
    // If lastPrice is 0 (first swap ever), use the newPrice.
    let oldPrice = pool.lastPrice.equals(BigDecimal.zero()) ? newPrice : pool.lastPrice

    // 3. Update Pool State (Live Price)
    pool.lastPrice = newPrice
    pool.tick = BigInt.fromI32(event.params.tick)

    // === CRITICAL UPDATE: Update timestamp ===
    pool.timestamp = event.block.timestamp

    pool.save()

    // 4. Handle Candle Logic
    let timestamp = event.block.timestamp.toI32()
    let hourIndex = timestamp / 3600 // Integer division for 1-hour bucket
    let periodStartUnix = hourIndex * 3600
    let candleId = poolId.concat("-").concat(hourIndex.toString())

    let candle = Candle.load(candleId)

    if (candle == null) {
        // === NEW CANDLE ===
        candle = new Candle(candleId)
        candle.pool = poolId
        candle.periodStartUnix = periodStartUnix

        // IMPORTANT: Open price is the OLD price (state before this swap)
        // This ensures no gaps between candles on the chart.
        candle.open = oldPrice

        // High/Low/Close start at the current swap price
        candle.high = newPrice
        candle.low = newPrice
        candle.close = newPrice

        candle.volumeToken0 = BigDecimal.zero()
        candle.volumeToken1 = BigDecimal.zero()
        candle.txCount = BigInt.zero()
    } else {
        // === UPDATE EXISTING CANDLE ===

        // Update High
        if (newPrice.gt(candle.high)) {
            candle.high = newPrice
        }
        // Update Low
        if (newPrice.lt(candle.low)) {
            candle.low = newPrice
        }
        // Update Close (Always the latest price)
        candle.close = newPrice
    }

    // 5. Update Volume
    // Algebra returns int256 for amounts (negative = output). Use abs().
    let amount0Abs = event.params.amount0.abs().toBigDecimal()
    let amount1Abs = event.params.amount1.abs().toBigDecimal()

    // Optional: Divide by decimals here if you want human-readable volume
    candle.volumeToken0 = candle.volumeToken0.plus(amount0Abs)
    candle.volumeToken1 = candle.volumeToken1.plus(amount1Abs)
    candle.txCount = candle.txCount.plus(BigInt.fromI32(1))

    candle.save()
}
