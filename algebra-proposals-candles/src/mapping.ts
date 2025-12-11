import { BigInt, Address, BigDecimal, log } from "@graphprotocol/graph-ts"
import { NewProposal } from "../generated/FutarchyFactory/FutarchyFactory"
import { Pool as PoolCreated } from "../generated/AlgebraFactory/AlgebraFactory"
import { Swap } from "../generated/templates/AlgebraPool/AlgebraPool"
import { AlgebraPool } from "../generated/templates"
import { FutarchyProposal } from "../generated/FutarchyFactory/FutarchyProposal"
import { ERC20 } from "../generated/FutarchyFactory/ERC20"
import { WhitelistedToken, Pool, Candle } from "../generated/schema"

// Constants
export const ROLE_BASE = "BASE"   // Outcome Tokens (Higher priority for Base)
export const ROLE_QUOTE = "QUOTE" // Collateral Tokens (Lower priority, should be Quote)

export function handleNewProposal(event: NewProposal): void {
    let proposalAddress = event.params.proposal
    let proposal = FutarchyProposal.bind(proposalAddress)

    // 1. Register Collaterals as QUOTE
    let collateral1 = proposal.try_collateralToken1()
    if (!collateral1.reverted) saveToken(collateral1.value, ROLE_QUOTE)

    let collateral2 = proposal.try_collateralToken2()
    if (!collateral2.reverted) saveToken(collateral2.value, ROLE_QUOTE)

    // 2. Register Outcome Tokens as BASE (using wrappedOutcome)
    for (let i = 0; i < 4; i++) {
        let res = proposal.try_wrappedOutcome(BigInt.fromI32(i))
        if (!res.reverted) {
            // wrappedOutcome returns (address, bytes)
            let tokenAddress = res.value.getWrapped1155()
            saveToken(tokenAddress, ROLE_BASE)
        }
    }
}

function saveToken(address: Address, role: string): void {
    let id = address.toHexString()
    let token = WhitelistedToken.load(id)
    if (!token) {
        token = new WhitelistedToken(id)
        token.role = role

        // Attempt to fetch symbol, but don't break if fail
        // Using ERC20 binding from generic ABI if present or generic ERC20 interaction
        let contract = ERC20.bind(address)
        let sym = contract.try_symbol()
        if (!sym.reverted) {
            token.symbol = sym.value
        } else {
            token.symbol = "UNK"
        }

        token.save()
        log.info("Whitelisted Token: {} ({}) with Role: {}", [id, token.symbol!, role])
    } else if (token.role != role && role == ROLE_BASE) {
        // Upgrade role if needed
        token.role = ROLE_BASE
        token.save()
    }
}

export function handlePoolCreated(event: PoolCreated): void {
    let token0Addr = event.params.token0.toHexString()
    let token1Addr = event.params.token1.toHexString()

    let token0 = WhitelistedToken.load(token0Addr)
    let token1 = WhitelistedToken.load(token1Addr)

    // FILTER: At least one token must be whitelisted
    if (!token0 && !token1) return

    let poolId = event.params.pool.toHexString()
    let pool = new Pool(poolId)

    pool.token0 = event.params.token0
    pool.token1 = event.params.token1
    // Explicit casting probably safer but direct assignment worked in algebra-candles
    pool.fee = BigInt.fromI32(0)
    pool.liquidity = BigInt.fromI32(0)
    pool.sqrtPrice = BigInt.fromI32(0)
    pool.tick = BigInt.fromI32(0)
    pool.isInverted = false

    // NORMALIZATION CHECK
    if (token0 && token1) {
        if (token0.role == ROLE_QUOTE && token1.role == ROLE_BASE) {
            pool.isInverted = true
            log.info("Inverted Pool Detected: {} ({} / {})", [poolId, token1.symbol!, token0.symbol!])
        }
    } else if (token0 && !token1) {
        if (token0.role == ROLE_QUOTE) pool.isInverted = true // Assuming other is Base
    }

    pool.save()

    // Start Indexing
    AlgebraPool.create(event.params.pool)
    log.info("Indexing Proposal Pool: {}", [poolId])
}

export function handleSwap(event: Swap): void {
    let poolId = event.address.toHexString()
    let pool = Pool.load(poolId)
    if (!pool) return

    let timestamp = event.block.timestamp
    let price = convertSqrtPriceX96(event.params.price)

    if (pool.isInverted) {
        if (price.gt(BigDecimal.zero())) {
            price = BigDecimal.fromString("1").div(price)
        }
    }

    let timeId = timestamp.toI32() / 3600 * 3600
    let candleId = poolId.concat("-").concat(BigInt.fromI32(timeId).toString())

    let candle = Candle.load(candleId)
    if (!candle) {
        candle = new Candle(candleId)
        candle.time = BigInt.fromI32(timeId)
        candle.periodStartUnix = BigInt.fromI32(timeId)
        candle.pool = poolId
        candle.block = event.block.number
        candle.open = price
        candle.high = price
        candle.low = price
        candle.close = price
        candle.volumeToken0 = BigDecimal.fromString("0")
        candle.volumeToken1 = BigDecimal.fromString("0")
        candle.volumeUSD = BigDecimal.fromString("0")
    } else {
        if (price.gt(candle.high)) candle.high = price
        if (price.lt(candle.low)) candle.low = price
        candle.close = price
    }

    candle.save()
}

function convertSqrtPriceX96(sqrtPriceX96: BigInt): BigDecimal {
    let q96 = BigInt.fromI32(2).pow(96)
    let sqrtPrice = sqrtPriceX96.toBigDecimal().div(q96.toBigDecimal())
    return sqrtPrice.times(sqrtPrice)
}
