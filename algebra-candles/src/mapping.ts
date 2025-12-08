import { BigDecimal, BigInt, log, DataSourceContext } from "@graphprotocol/graph-ts"
import { Swap } from "../generated/templates/AlgebraPool/AlgebraPool"
import { Pool as PoolEvent } from "../generated/AlgebraFactory/AlgebraFactory"
import { AlgebraPool } from "../generated/templates"
import { Pool, Candle, Trade } from "../generated/schema"

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

export function handlePoolCreated(event: PoolEvent): void {
    // Start indexing the new pool
    AlgebraPool.create(event.params.pool)

    let poolId = event.params.pool.toHexString()
    let pool = new Pool(poolId)

    // Initialize with event data
    pool.token0 = event.params.token0
    pool.token1 = event.params.token1

    // Default decimals (ideally fetch via ERC20 contracts)
    pool.decimal0 = BigInt.fromI32(18)
    pool.decimal1 = BigInt.fromI32(18)

    pool.lastPrice = BigDecimal.zero()
    pool.tick = BigInt.zero()
    pool.timestamp = event.block.timestamp

    pool.save()
}

export function handleSwap(event: Swap): void {
    let poolId = event.address.toHexString()
    let pool = Pool.load(poolId)

    // Safety check: Pool must exist (created by Factory handler)
    if (pool == null) {
        // Fallback in case of race/template issue, though unlikely with proper startBlock
        return
    }

    // 1. Calculate New Price from the event
    let newPrice = getPrice(event.params.price, pool.decimal0, pool.decimal1)

    // 2. Identify the "Old Price" (Current state before this swap)
    let oldPrice = pool.lastPrice.equals(BigDecimal.zero()) ? newPrice : pool.lastPrice

    // 3. Update Pool State (Live Price)
    pool.lastPrice = newPrice
    pool.tick = BigInt.fromI32(event.params.tick)
    pool.timestamp = event.block.timestamp
    pool.save()

    // 4. Handle Candle Logic
    let timestamp = event.block.timestamp.toI32()
    let hourIndex = timestamp / 3600
    let periodStartUnix = hourIndex * 3600
    let candleId = poolId.concat("-").concat(hourIndex.toString())

    let candle = Candle.load(candleId)

    if (candle == null) {
        // === NEW CANDLE ===
        candle = new Candle(candleId)
        candle.pool = poolId
        candle.periodStartUnix = periodStartUnix
        candle.open = oldPrice
        candle.high = newPrice
        candle.low = newPrice
        candle.close = newPrice
        candle.volumeToken0 = BigDecimal.zero()
        candle.volumeToken1 = BigDecimal.zero()
        candle.txCount = BigInt.zero()
    } else {
        // === UPDATE EXISTING CANDLE ===
        if (newPrice.gt(candle.high)) {
            candle.high = newPrice
        }
        if (newPrice.lt(candle.low)) {
            candle.low = newPrice
        }
        candle.close = newPrice
    }

    // 5. Update Volume
    let amount0Abs = event.params.amount0.abs().toBigDecimal()
    let amount1Abs = event.params.amount1.abs().toBigDecimal()

    candle.volumeToken0 = candle.volumeToken0.plus(amount0Abs)
    candle.volumeToken1 = candle.volumeToken1.plus(amount1Abs)
    candle.txCount = candle.txCount.plus(BigInt.fromI32(1))

    candle.save()

    // 6. Create Trade Entity
    let tradeId = event.transaction.hash.concatI32(event.logIndex.toI32())
    let trade = new Trade(tradeId)
    trade.pool = poolId
    trade.blockNumber = event.block.number
    trade.timestamp = event.block.timestamp
    trade.txHash = event.transaction.hash
    trade.sender = event.params.sender
    trade.recipient = event.params.recipient

    // Scale amounts
    let scaler0 = BigInt.fromI32(10).pow(u8(pool.decimal0.toI32())).toBigDecimal()
    let scaler1 = BigInt.fromI32(10).pow(u8(pool.decimal1.toI32())).toBigDecimal()

    trade.amount0 = event.params.amount0.toBigDecimal().div(scaler0)
    trade.amount1 = event.params.amount1.toBigDecimal().div(scaler1)

    trade.price = newPrice
    trade.liquidity = event.params.liquidity
    trade.tick = BigInt.fromI32(event.params.tick)

    trade.save()
}
