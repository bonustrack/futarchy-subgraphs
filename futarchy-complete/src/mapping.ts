import { Address, Bytes, BigInt, BigDecimal, log, DataSourceContext } from "@graphprotocol/graph-ts"
import { NewProposal } from "../generated/FutarchyFactory/FutarchyFactory"
import { Pool as PoolEvent, AlgebraFactory } from "../generated/AlgebraFactory/AlgebraFactory"
import { FutarchyProposal } from "../generated/FutarchyFactory/FutarchyProposal"
import { AggregatorMetadataCreated } from "../generated/Creator/Creator"
import { OrganizationAdded, AggregatorInfoUpdated } from "../generated/templates/AggregatorTemplate/Aggregator"
import { ProposalAdded, CompanyInfoUpdated } from "../generated/templates/OrganizationTemplate/Organization"
import { MetadataUpdated, Proposal as MetadataContract } from "../generated/templates/ProposalTemplate/Proposal"
import { Swap } from "../generated/templates/AlgebraPool/AlgebraPool"
import { ERC20 } from "../generated/FutarchyFactory/ERC20"

import {
    UnifiedOneStopShop,
    NormalizedPool,
    UnifiedCandle,
    UnifiedTrade,
    TokenInfo,
    PoolLookup,
    Aggregator,
    Organization
} from "../generated/schema"

import {
    AlgebraPool,
    AggregatorTemplate,
    OrganizationTemplate,
    ProposalTemplate
} from "../generated/templates"

import { Aggregator as AggregatorContract } from "../generated/templates/AggregatorTemplate/Aggregator"
import { Organization as OrganizationContract } from "../generated/templates/OrganizationTemplate/Organization"

const ALGEBRA_FACTORY_ADDRESS = Address.fromString("0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766")
const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000")
const Q96 = BigDecimal.fromString("79228162514264337593543950336")

// ============================================
// 1. FUTARCHY PROPOSAL CREATION (Trading Core)
// ============================================
// ============================================
// 1. FUTARCHY PROPOSAL CREATION (Trading Core)
// ============================================
export function handleNewProposal(event: NewProposal): void {
    let proposalId = event.params.proposal
    let entity = getOrCreateUnifiedEntity(proposalId)

    // Trading data is now available
    entity.marketName = event.params.marketName
    entity.title = event.params.marketName // FIX: Set title immediately
    entity.createdAtTimestamp = event.block.timestamp

    // Fetch Tokens
    let contract = FutarchyProposal.bind(proposalId)
    let col1Call = contract.try_collateralToken1()
    let col2Call = contract.try_collateralToken2()

    let companyTokenAddr = !col1Call.reverted ? col1Call.value : ZERO_ADDRESS
    let currencyTokenAddr = !col2Call.reverted ? col2Call.value : ZERO_ADDRESS

    entity.companyToken = createTokenInfo(companyTokenAddr)
    entity.currencyToken = createTokenInfo(currencyTokenAddr)

    // Lookup Pools
    let w0 = getWrapped(contract, 0)
    let w1 = getWrapped(contract, 1)
    let w2 = getWrapped(contract, 2)
    let w3 = getWrapped(contract, 3)

    // Save Outcomes
    entity.outcomeYesCompany = w0.toHexString()
    entity.outcomeNoCompany = w1.toHexString()
    entity.outcomeYesCurrency = w2.toHexString()
    entity.outcomeNoCurrency = w3.toHexString()

    let factory = AlgebraFactory.bind(ALGEBRA_FACTORY_ADDRESS)

    entity.poolConditionalYes = findAndLinkPool(factory, w0, w2, true, proposalId)
    entity.poolConditionalNo = findAndLinkPool(factory, w1, w3, true, proposalId)
    entity.poolExpectedYes = findAndLinkPool(factory, w0, currencyTokenAddr, true, proposalId)
    entity.poolExpectedNo = findAndLinkPool(factory, w1, currencyTokenAddr, true, proposalId)
    entity.poolPredictionYes = findAndLinkPool(factory, w2, currencyTokenAddr, true, proposalId)
    entity.poolPredictionNo = findAndLinkPool(factory, w3, currencyTokenAddr, true, proposalId)

    entity.save()
}

// ============================================
// 2. METADATA & HIERARCHY
// ============================================

// ============================================
// 2. METADATA & HIERARCHY
// ============================================

export function handleAggregatorCreated(event: AggregatorMetadataCreated): void {
    AggregatorTemplate.create(event.params.metadata)

    let entity = new Aggregator(event.params.metadata.toHexString())
    entity.name = event.params.name
    entity.creator = event.transaction.from
    entity.createdAt = event.block.timestamp

    // Fetch description manually since it's not in event
    let contract = AggregatorContract.bind(event.params.metadata)
    let dCall = contract.try_description()
    entity.description = !dCall.reverted ? dCall.value : ""

    entity.save()
}

export function handleOrganizationAdded(event: OrganizationAdded): void {
    OrganizationTemplate.create(event.params.organizationMetadata)

    let orgId = event.params.organizationMetadata.toHexString()
    let entity = new Organization(orgId)
    entity.aggregator = event.address.toHexString()
    entity.createdAt = event.block.timestamp

    let contract = OrganizationContract.bind(event.params.organizationMetadata)
    let nCall = contract.try_companyName()
    entity.name = !nCall.reverted ? nCall.value : "Unknown"

    let dCall = contract.try_description()
    entity.description = !dCall.reverted ? dCall.value : ""

    let oCall = contract.try_owner()
    entity.owner = !oCall.reverted ? oCall.value : event.transaction.from

    entity.save()

    // BACKFILL: Fetch existing proposals from Organization state (for "Time Travel" / Old Proposals)
    let countCall = contract.try_getProposalsCount()
    if (!countCall.reverted && countCall.value.gt(BigInt.zero())) {
        let count = countCall.value
        // We use offset 0, limit = count. Be careful with size, but for now safe.
        let propsCall = contract.try_getProposals(BigInt.zero(), count)
        if (!propsCall.reverted) {
            let proposals = propsCall.value
            for (let i = 0; i < proposals.length; i++) {
                linkProposalToOrganization(proposals[i], orgId)
            }
        }
    }
}

export function handleProposalAdded(event: ProposalAdded): void {
    linkProposalToOrganization(event.params.proposalMetadata, event.address.toHexString())
}

export function handleProposalMetadataUpdated(event: MetadataUpdated): void {
    let contract = MetadataContract.bind(event.address)
    let call = contract.try_proposalAddress()
    if (call.reverted) return

    let entity = getOrCreateUnifiedEntity(call.value)
    entity.displayNameQuestion = event.params.displayNameQuestion
    entity.displayNameEvent = event.params.displayNameEvent
    entity.description = event.params.description

    // Update title logic: User prefers marketName if available, else Question, else Event
    if (entity.marketName && entity.marketName != "Initializing...") {
        entity.title = entity.marketName
    } else if (entity.displayNameQuestion && entity.displayNameQuestion != "Loading...") {
        entity.title = entity.displayNameQuestion
    } else {
        entity.title = entity.displayNameEvent
    }

    entity.save()
}

// ============================================
// 3. REUSABLE LINKING LOGIC (For Event & Historical Backfill)
// ============================================

function linkProposalToOrganization(metadataAddr: Address, orgId: string): void {
    // 1. Create Template to listen for updates
    ProposalTemplate.create(metadataAddr)

    let metaId = metadataAddr.toHexString()

    // 2. Bind to Metadata Contract to get the Trading Proposal Address
    let contract = MetadataContract.bind(metadataAddr)
    let addrCall = contract.try_proposalAddress()

    if (addrCall.reverted) {
        log.warning("LinkProposal: Could not fetch proposalAddress from {}", [metaId])
        return
    }

    let tradingProposalId = addrCall.value

    // 3. Create/Update the Unified Entity (Shell or Existing)
    let entity = getOrCreateUnifiedEntity(tradingProposalId)
    entity.organization = orgId
    entity.metadataContract = metadataAddr

    // 4. Fill Metadata
    let qCall = contract.try_displayNameQuestion()
    entity.displayNameQuestion = !qCall.reverted ? qCall.value : "Loading..."
    if (!qCall.reverted && entity.title == "Loading...") entity.title = qCall.value

    let eCall = contract.try_displayNameEvent()
    entity.displayNameEvent = !eCall.reverted ? eCall.value : "Loading..."
    if (!eCall.reverted && eCall.value.length > 0 && (entity.title == "Loading..." || entity.title == entity.displayNameQuestion)) {
        entity.title = eCall.value
    }

    let dCall = contract.try_description()
    entity.description = !dCall.reverted ? dCall.value : "Loading..."

    // 5. HEAL: Retry fetching Tokens & Pools
    let tknCheck = TokenInfo.load(entity.companyToken)
    let needsHeal = !tknCheck || tknCheck.symbol == "UNK" || entity.companyToken == ZERO_ADDRESS.toHexString() || entity.poolConditionalYes == null

    if (needsHeal) {
        log.info("Healing Proposal: {}", [tradingProposalId.toHexString()])
        let tradeContract = FutarchyProposal.bind(tradingProposalId)

        let col1Call = tradeContract.try_collateralToken1()
        let col2Call = tradeContract.try_collateralToken2()

        if (!col1Call.reverted && !col2Call.reverted) {
            let c1 = col1Call.value
            let c2 = col2Call.value

            entity.companyToken = createTokenInfo(c1)
            entity.currencyToken = createTokenInfo(c2)

            // Retry Pools
            let w0 = getWrapped(tradeContract, 0)
            let w1 = getWrapped(tradeContract, 1)
            let w2 = getWrapped(tradeContract, 2)
            let w3 = getWrapped(tradeContract, 3)

            // Save Outcomes
            entity.outcomeYesCompany = w0.toHexString()
            entity.outcomeNoCompany = w1.toHexString()
            entity.outcomeYesCurrency = w2.toHexString()
            entity.outcomeNoCurrency = w3.toHexString()

            // Log details for debugging
            log.info("Tokens: c1={}, c2={}, w0={}", [c1.toHexString(), c2.toHexString(), w0.toHexString()])

            let factory = AlgebraFactory.bind(ALGEBRA_FACTORY_ADDRESS)

            if (!entity.poolConditionalYes) entity.poolConditionalYes = findAndLinkPool(factory, w0, w2, true, tradingProposalId)
            if (!entity.poolConditionalNo) entity.poolConditionalNo = findAndLinkPool(factory, w1, w3, true, tradingProposalId)
            if (!entity.poolExpectedYes) entity.poolExpectedYes = findAndLinkPool(factory, w0, c2, true, tradingProposalId)
            if (!entity.poolExpectedNo) entity.poolExpectedNo = findAndLinkPool(factory, w1, c2, true, tradingProposalId)
            if (!entity.poolPredictionYes) entity.poolPredictionYes = findAndLinkPool(factory, w2, c2, true, tradingProposalId)
            if (!entity.poolPredictionNo) entity.poolPredictionNo = findAndLinkPool(factory, w3, c2, true, tradingProposalId)
        } else {
            log.warning("Healing Failed: Could not fetch collateral tokens", [])
        }
    }

    entity.save()
}


// ============================================
// 3. POOL & TRADING LOGIC
// ============================================
export function handlePoolCreated(event: PoolEvent): void {
    let poolId = event.params.pool.toHexString()
    AlgebraPool.create(event.params.pool)
    let pool = new NormalizedPool(poolId)
    pool.baseToken = createTokenInfo(event.params.token0)
    pool.quoteToken = createTokenInfo(event.params.token1)
    pool.isBaseToken0 = true
    pool.currentPrice = BigDecimal.zero()
    pool.volume24h = BigDecimal.zero()
    pool.save()
}

export function handleSwap(event: Swap): void {
    let poolId = event.address.toHexString()
    let pool = NormalizedPool.load(poolId)
    if (!pool) return

    let token0Params = TokenInfo.load(pool.baseToken)
    let token1Params = TokenInfo.load(pool.quoteToken)
    let d0 = token0Params ? BigInt.fromString(token0Params.decimals.toString()) : BigInt.fromI32(18)
    let d1 = token1Params ? BigInt.fromString(token1Params.decimals.toString()) : BigInt.fromI32(18)

    let rawPrice = getPrice(event.params.price, d0, d1)
    let normalizedPrice = pool.isBaseToken0 ? rawPrice : invert(rawPrice)

    pool.currentPrice = normalizedPrice
    pool.save()

    updateCandle(pool, event.block.timestamp, normalizedPrice, event.params.amount0, event.params.amount1)

    let tradeId = event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString()
    let trade = new UnifiedTrade(tradeId)
    trade.pool = poolId
    trade.timestamp = event.block.timestamp
    trade.txHash = event.transaction.hash
    trade.price = normalizedPrice

    let isBuy = false
    if (pool.isBaseToken0) {
        isBuy = event.params.amount0.lt(BigInt.zero())
        trade.amountBase = event.params.amount0.abs().toBigDecimal()
        trade.amountQuote = event.params.amount1.abs().toBigDecimal()
    } else {
        isBuy = event.params.amount1.lt(BigInt.zero())
        trade.amountBase = event.params.amount1.abs().toBigDecimal()
        trade.amountQuote = event.params.amount0.abs().toBigDecimal()
    }
    trade.type = isBuy ? "BUY" : "SELL"
    trade.maker = event.params.sender
    trade.save()
}


// ============================================
// HELPERS
// ============================================

function getOrCreateUnifiedEntity(proposalId: Bytes): UnifiedOneStopShop {
    let id = proposalId.toHexString()
    let entity = UnifiedOneStopShop.load(id)
    if (entity == null) {
        entity = new UnifiedOneStopShop(id)
        // Default values to avoid null errors
        entity.title = "Loading..."
        entity.description = "Loading..."
        entity.marketName = "Initializing..."
        entity.displayNameEvent = "Loading..."
        entity.displayNameQuestion = "Loading..."
        entity.resolutionDate = BigInt.fromI32(0)
        entity.createdAtTimestamp = BigInt.fromI32(0)

        // Placeholders for tokens (will be filled by NewProposal)
        entity.companyToken = "UNKNOWN"
        entity.currencyToken = "UNKNOWN"

        // Ensure dummy known tokens exist to satisfy non-nullable schema? 
        // Schema says TokenInfo! so we need valid IDs.
        // We use a predefined "UNKNOWN" ID.
        let unknown = createTokenInfo(ZERO_ADDRESS)
        entity.companyToken = unknown
        entity.currencyToken = unknown

        entity.save()
    }
    return entity
}

function findAndLinkPool(factory: AlgebraFactory, tA: Address, tB: Address, baseIsA: boolean, proposalId: Bytes): string | null {
    if (tA == ZERO_ADDRESS || tB == ZERO_ADDRESS) return null

    // Sort tokens for Algebra lookup (just in case)
    let token0 = tA
    let token1 = tB
    if (token0.toHexString() > token1.toHexString()) {
        token0 = tB
        token1 = tA
    }

    let call = factory.try_poolByPair(token0, token1)
    if (!call.reverted && call.value != ZERO_ADDRESS) {
        let poolId = call.value.toHexString()
        let pool = NormalizedPool.load(poolId)
        if (pool) {
            // Found it!
            return poolId
        }
        // If pool is returned by factory but NOT indexed yet
        log.warning("Pool found in factory but missing in Subgraph: {}", [poolId])
        return poolId
    } else {
        log.info("Pool lookup failed for pair: {} - {}", [tA.toHexString(), tB.toHexString()])
    }
    return null
}


function createTokenInfo(addr: Address): string {
    let id = addr.toHexString()
    let token = TokenInfo.load(id)
    if (!token) {
        token = new TokenInfo(id)

        // Default / Fallback
        token.name = "Unknown Token"
        token.symbol = "UNK"
        token.decimals = BigInt.fromI32(18)

        if (addr != ZERO_ADDRESS) {
            let erc20 = ERC20.bind(addr)

            // Name
            let callName = erc20.try_name()
            if (!callName.reverted) {
                token.name = callName.value
            }

            // Symbol: Try string then bytes32
            let callSymbol = erc20.try_symbol()
            if (!callSymbol.reverted) {
                token.symbol = callSymbol.value
            } else {
                // Try bytes32
                // We don't have a helper for this in standard generated code unless we update ABI
                // But usually standard ERC20 abi only has string symbol()
                // If it fails, we keep UNK. 
                // Wait, user hates "TNK". We used "UNK".
                // Maybe we can try to use the address subset?
                token.symbol = "UNK-" + id.slice(2, 6)
            }

            // Decimals
            let callDecimals = erc20.try_decimals()
            if (!callDecimals.reverted) {
                token.decimals = BigInt.fromI32(callDecimals.value)
            }
        }

        token.save()
    }
    return id
}

function getWrapped(contract: FutarchyProposal, index: i32): Address {
    let call = contract.try_wrappedOutcome(BigInt.fromI32(index))
    return !call.reverted ? call.value.getWrapped1155() : ZERO_ADDRESS
}

function getPrice(priceQ96: BigInt, decimal0: BigInt, decimal1: BigInt): BigDecimal {
    let value = priceQ96.toBigDecimal()
    let priceRaw = value.div(Q96).times(value.div(Q96))
    let scaler0 = BigInt.fromI32(10).pow(decimal0.toI32() as u8).toBigDecimal()
    let scaler1 = BigInt.fromI32(10).pow(decimal1.toI32() as u8).toBigDecimal()
    return priceRaw.times(scaler0).div(scaler1)
}

function invert(price: BigDecimal): BigDecimal {
    if (price.equals(BigDecimal.zero())) return BigDecimal.zero()
    return BigDecimal.fromString("1").div(price)
}

function updateCandle(pool: NormalizedPool, timestamp: BigInt, price: BigDecimal, amount0: BigInt, amount1: BigInt): void {
    let ts = timestamp.toI32()
    let period = 3600
    let periodStart = (ts / period) * period
    let id = pool.id + "-" + periodStart.toString()

    let candle = UnifiedCandle.load(id)
    if (!candle) {
        candle = new UnifiedCandle(id)
        candle.pool = pool.id
        candle.time = BigInt.fromI32(periodStart)
        candle.period = period
        candle.open = price
        candle.high = price
        candle.low = price
        candle.close = price
        candle.volume = BigDecimal.zero()
        candle.save()
    } else {
        if (price.gt(candle.high)) candle.high = price
        if (price.lt(candle.low)) candle.low = price
        candle.close = price
        candle.save()
    }
}
