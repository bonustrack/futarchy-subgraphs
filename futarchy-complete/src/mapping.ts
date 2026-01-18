import { Address, Bytes, BigInt, BigDecimal, log, DataSourceContext } from "@graphprotocol/graph-ts"
import { NewProposal } from "../generated/FutarchyFactory/FutarchyFactory"
import { Pool as PoolEvent, AlgebraFactory } from "../generated/AlgebraFactory/AlgebraFactory"
import { FutarchyProposal } from "../generated/FutarchyFactory/FutarchyProposal"
import { AggregatorMetadataCreated } from "../generated/Creator/Creator"
import { OrganizationMetadataCreated } from "../generated/OrganizationFactory/OrganizationFactory"
import { ProposalMetadataCreated } from "../generated/ProposalMetadataFactory/ProposalMetadataFactory"
import { OrganizationAdded, OrganizationCreatedAndAdded, AggregatorInfoUpdated, ExtendedMetadataUpdated as AggregatorExtendedMetadataUpdated, EditorSet as AggregatorEditorSet, EditorRevoked as AggregatorEditorRevoked } from "../generated/templates/AggregatorTemplate/Aggregator"
import { ProposalAdded, ProposalCreatedAndAdded, CompanyInfoUpdated, ExtendedMetadataUpdated as OrganizationExtendedMetadataUpdated, EditorSet as OrganizationEditorSet, EditorRevoked as OrganizationEditorRevoked } from "../generated/templates/OrganizationTemplate/Organization"
import { MetadataUpdated, Proposal as MetadataContract, ExtendedMetadataUpdated as ProposalExtendedMetadataUpdated } from "../generated/templates/ProposalTemplate/Proposal"
// import { Swap } from "../generated/templates/AlgebraPool/AlgebraPool"
import { ERC20 } from "../generated/FutarchyFactory/ERC20"

import {
    UnifiedOneStopShop,
    NormalizedPool,
    TokenInfo,
    PoolLookup,
    Aggregator,
    Organization
} from "../generated/schema"

import {
    // AlgebraPool,
    AggregatorTemplate,
    OrganizationTemplate,
    ProposalTemplate
} from "../generated/templates"

import { Aggregator as AggregatorContract } from "../generated/templates/AggregatorTemplate/Aggregator"
import { Organization as OrganizationContract } from "../generated/templates/OrganizationTemplate/Organization"

const ALGEBRA_FACTORY_ADDRESS = Address.fromString("0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766")
const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000")
const Q96 = BigDecimal.fromString("79228162514264337593543950336")

// Candle periods in seconds: 1 minute, 10 minutes, 1 hour
const CANDLE_PERIODS: i32[] = [60, 600, 3600]
// Max age (in seconds) for each period: 24 hours, 7 days, 0 = unlimited
const CANDLE_MAX_AGES: i32[] = [86400, 604800, 0]

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
// 2. METADATA & HIERARCHY - FACTORY HANDLERS (CREATION)
// ============================================

export function handleAggregatorCreated(event: AggregatorMetadataCreated): void {
    AggregatorTemplate.create(event.params.metadata)

    let entity = new Aggregator(event.params.metadata.toHexString())
    entity.name = event.params.name
    entity.creator = event.transaction.from
    entity.createdAt = event.block.timestamp

    // Fetch description & extended metadata manually
    let contract = AggregatorContract.bind(event.params.metadata)
    let dCall = contract.try_description()
    entity.description = !dCall.reverted ? dCall.value : ""

    let mCall = contract.try_metadata()
    entity.metadata = !mCall.reverted ? mCall.value : ""

    let uCall = contract.try_metadataURI()
    entity.metadataURI = !uCall.reverted ? uCall.value : ""

    let oCall = contract.try_owner()
    entity.owner = !oCall.reverted ? oCall.value : event.transaction.from

    entity.save()
}

export function handleOrganizationMetadataCreated(event: OrganizationMetadataCreated): void {
    // 1. Create Template to listen for updates
    OrganizationTemplate.create(event.params.metadata)

    let orgId = event.params.metadata.toHexString()
    let entity = Organization.load(orgId)
    if (entity == null) {
        entity = new Organization(orgId)
    }

    entity.createdAt = event.block.timestamp
    entity.name = event.params.name

    let contract = OrganizationContract.bind(event.params.metadata)
    let dCall = contract.try_description()
    entity.description = !dCall.reverted ? dCall.value : ""

    let oCall = contract.try_owner()
    entity.owner = !oCall.reverted ? oCall.value : event.transaction.from

    let mCall = contract.try_metadata()
    entity.metadata = !mCall.reverted ? mCall.value : ""

    let uCall = contract.try_metadataURI()
    entity.metadataURI = !uCall.reverted ? uCall.value : ""

    entity.save()
}

export function handleProposalMetadataCreated(event: ProposalMetadataCreated): void {
    let metadataAddr = event.params.metadata
    let tradingProposalAddr = event.params.proposalAddress

    // 1. Create Template to listen for updates
    ProposalTemplate.create(metadataAddr)

    // 2. Populate Unified Entity
    populateUnifiedEntityFromMetadata(tradingProposalAddr, metadataAddr)
}


// ============================================
// 3. METADATA & HIERARCHY - LINKING HANDLERS
// ============================================

export function handleOrganizationAdded(event: OrganizationAdded): void {
    let orgId = event.params.organizationMetadata.toHexString()
    let aggregatorId = event.address.toHexString()

    // Check if Org exists (it should, from Factory)
    let entity = Organization.load(orgId)

    // Fallback: If for some reason we missed the Factory event, create it now (Robustness)
    if (entity == null) {
        OrganizationTemplate.create(event.params.organizationMetadata)
        entity = new Organization(orgId)
        entity.createdAt = event.block.timestamp
        // We can try to fetch details here if we really need to, but ideally Factory handled it.
        // Let's re-use the factory logic just in case:
        let contract = OrganizationContract.bind(event.params.organizationMetadata)
        let nCall = contract.try_companyName()
        entity.name = !nCall.reverted ? nCall.value : "Unknown"
        // ... (other fields left as default/null to keep it simple, or duplicate logic if needed)
    }

    entity.aggregator = aggregatorId
    entity.save()

    // BACKFILL: Still linking proposals if they exist
    // Currently relying on factories for primary indexing, but linking is fine.
    // If proposals were created before org link, they exist but have no org.
    // We can backfill the LINK here.
    let contract = OrganizationContract.bind(event.params.organizationMetadata)
    let countCall = contract.try_getProposalsCount()
    if (!countCall.reverted && countCall.value.gt(BigInt.zero())) {
        let count = countCall.value
        let propsCall = contract.try_getProposals(BigInt.zero(), count)
        if (!propsCall.reverted) {
            let proposals = propsCall.value
            for (let i = 0; i < proposals.length; i++) {
                // This function basically looks up mapped entity and sets org
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

    // Update title logic
    if (entity.marketName && entity.marketName != "Initializing...") {
        entity.title = entity.marketName
    } else if (entity.displayNameQuestion && entity.displayNameQuestion != "Loading...") {
        entity.title = entity.displayNameQuestion
    } else {
        entity.title = entity.displayNameEvent
    }

    entity.save()
}

// EXTENDED METADATA HANDLERS

export function handleAggregatorExtendedMetadataUpdated(event: AggregatorExtendedMetadataUpdated): void {
    let entity = Aggregator.load(event.address.toHexString())
    if (entity) {
        entity.metadata = event.params.metadata
        entity.metadataURI = event.params.metadataURI
        entity.save()
    }
}

export function handleOrganizationExtendedMetadataUpdated(event: OrganizationExtendedMetadataUpdated): void {
    let entity = Organization.load(event.address.toHexString())
    if (entity) {
        entity.metadata = event.params.metadata
        entity.metadataURI = event.params.metadataURI
        entity.save()
    }
}

export function handleProposalExtendedMetadataUpdated(event: ProposalExtendedMetadataUpdated): void {
    let contract = MetadataContract.bind(event.address)
    let call = contract.try_proposalAddress()
    if (call.reverted) return

    let entity = getOrCreateUnifiedEntity(call.value)
    entity.metadata = event.params.metadata
    entity.metadataURI = event.params.metadataURI
    entity.save()
}

// ============================================
// NEW: OrganizationCreatedAndAdded & ProposalCreatedAndAdded HANDLERS
// ============================================

export function handleOrganizationCreatedAndAdded(event: OrganizationCreatedAndAdded): void {
    let orgId = event.params.organizationMetadata.toHexString()
    let aggregatorId = event.address.toHexString()

    // Create Template
    OrganizationTemplate.create(event.params.organizationMetadata)

    // Load or create Organization
    let entity = Organization.load(orgId)
    if (entity == null) {
        entity = new Organization(orgId)
        entity.createdAt = event.block.timestamp
    }

    entity.name = event.params.companyName
    entity.aggregator = aggregatorId

    // Fetch additional details
    let contract = OrganizationContract.bind(event.params.organizationMetadata)
    let dCall = contract.try_description()
    entity.description = !dCall.reverted ? dCall.value : ""

    let oCall = contract.try_owner()
    entity.owner = !oCall.reverted ? oCall.value : event.transaction.from

    let eCall = contract.try_editor()
    entity.editor = !eCall.reverted ? eCall.value : null

    let mCall = contract.try_metadata()
    entity.metadata = !mCall.reverted ? mCall.value : ""

    let uCall = contract.try_metadataURI()
    entity.metadataURI = !uCall.reverted ? uCall.value : ""

    entity.save()
}

export function handleProposalCreatedAndAdded(event: ProposalCreatedAndAdded): void {
    let metadataAddr = event.params.proposalMetadata
    let tradingProposalAddr = event.params.proposalAddress
    let orgId = event.address.toHexString()

    // Create Template
    ProposalTemplate.create(metadataAddr)

    // Populate Unified Entity with organization link
    let entity = getOrCreateUnifiedEntity(tradingProposalAddr)
    entity.organization = orgId
    entity.metadataContract = metadataAddr
    entity.save()

    // Populate from metadata
    populateUnifiedEntityFromMetadata(tradingProposalAddr, metadataAddr)
}

// ============================================
// NEW: EDITOR HANDLERS
// ============================================

export function handleAggregatorEditorSet(event: AggregatorEditorSet): void {
    let entity = Aggregator.load(event.address.toHexString())
    if (entity) {
        entity.editor = event.params.newEditor
        entity.save()
    }
}

export function handleAggregatorEditorRevoked(event: AggregatorEditorRevoked): void {
    let entity = Aggregator.load(event.address.toHexString())
    if (entity) {
        entity.editor = null
        entity.save()
    }
}

export function handleOrganizationEditorSet(event: OrganizationEditorSet): void {
    let entity = Organization.load(event.address.toHexString())
    if (entity) {
        entity.editor = event.params.newEditor
        entity.save()
    }
}

export function handleOrganizationEditorRevoked(event: OrganizationEditorRevoked): void {
    let entity = Organization.load(event.address.toHexString())
    if (entity) {
        entity.editor = null
        entity.save()
    }
}


// ============================================
// 4. REUSABLE LINKING & POPULATION LOGIC
// ============================================

function linkProposalToOrganization(metadataAddr: Address, orgId: string): void {
    // 1. We might not have metadata about which Trading Proposal this is unless we query
    let contract = MetadataContract.bind(metadataAddr)
    let addrCall = contract.try_proposalAddress()

    if (addrCall.reverted) {
        return
    }

    let tradingProposalId = addrCall.value
    let entity = getOrCreateUnifiedEntity(tradingProposalId)

    // LINK
    entity.organization = orgId

    // Also, ensure template is created and metadata linked (idempotent)
    ProposalTemplate.create(metadataAddr)
    entity.metadataContract = metadataAddr

    // Re-run population? It's expensive but ensures consistency if ProposalAdded seen before Factory
    // But duplicate logic... let's trust Factory mostly, or check if "Loading..."
    if (entity.description == "Loading..." || entity.description == null) {
        populateUnifiedEntityFromMetadata(tradingProposalId, metadataAddr)
    }

    entity.save()
}

function populateUnifiedEntityFromMetadata(tradingProposalId: Address, metadataAddr: Address): void {
    let entity = getOrCreateUnifiedEntity(tradingProposalId)

    entity.metadataContract = metadataAddr
    let contract = MetadataContract.bind(metadataAddr)

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

    let mCall = contract.try_metadata()
    entity.metadata = !mCall.reverted ? mCall.value : ""

    let uCall = contract.try_metadataURI()
    entity.metadataURI = !uCall.reverted ? uCall.value : ""

    let ownerCall = contract.try_owner()
    entity.owner = !ownerCall.reverted ? ownerCall.value : null

    // 5. REGISTRY: Always fetch Tokens & Pools (Treat Metadata as primary source)
    let tradeContract = FutarchyProposal.bind(tradingProposalId)

    // FETCH MARKET NAME (Fixes "Initializing..." for backfilled proposals)
    let mNameCall = tradeContract.try_marketName()
    if (!mNameCall.reverted) {
        entity.marketName = mNameCall.value
        if (entity.title == "Loading..." || entity.title == "Initializing...") {
            entity.title = mNameCall.value
        }
    }

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

        let factory = AlgebraFactory.bind(ALGEBRA_FACTORY_ADDRESS)

        entity.poolConditionalYes = findAndLinkPool(factory, w0, w2, true, tradingProposalId)
        entity.poolConditionalNo = findAndLinkPool(factory, w1, w3, true, tradingProposalId)
        entity.poolExpectedYes = findAndLinkPool(factory, w0, c2, true, tradingProposalId)
        entity.poolExpectedNo = findAndLinkPool(factory, w1, c2, true, tradingProposalId)
        entity.poolPredictionYes = findAndLinkPool(factory, w2, c2, true, tradingProposalId)
        entity.poolPredictionNo = findAndLinkPool(factory, w3, c2, true, tradingProposalId)
    } else {
        log.warning("Registry Failed: Could not fetch tokens for prop {}", [tradingProposalId.toHexString()])
    }

    entity.save()
}


// ============================================
// 5. POOL LOGIC & HELPERS
// ============================================
export function handlePoolCreated(event: PoolEvent): void {
    let poolId = event.params.pool.toHexString()
    let pool = new NormalizedPool(poolId)
    pool.baseToken = createTokenInfo(event.params.token0)
    pool.quoteToken = createTokenInfo(event.params.token1)
    pool.isBaseToken0 = true
    pool.currentPrice = BigDecimal.zero()
    pool.volume24h = BigDecimal.zero()
    pool.save()
}

function getOrCreateUnifiedEntity(proposalId: Bytes): UnifiedOneStopShop {
    let id = proposalId.toHexString()
    let entity = UnifiedOneStopShop.load(id)
    if (entity == null) {
        entity = new UnifiedOneStopShop(id)
        // Default values
        entity.title = "Loading..."
        entity.description = "Loading..."
        entity.marketName = "Initializing..."
        entity.displayNameEvent = "Loading..."
        entity.displayNameQuestion = "Loading..."
        entity.resolutionDate = BigInt.fromI32(0)
        entity.createdAtTimestamp = BigInt.fromI32(0)

        let unknown = createTokenInfo(ZERO_ADDRESS)
        entity.companyToken = unknown
        entity.currencyToken = unknown

        entity.save()
    }
    return entity
}

function findAndLinkPool(factory: AlgebraFactory, tA: Address, tB: Address, baseIsA: boolean, proposalId: Bytes): string | null {
    if (tA == ZERO_ADDRESS || tB == ZERO_ADDRESS) return null

    // Sort tokens for Algebra lookup
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

        if (!pool) {
            pool = new NormalizedPool(poolId)
            pool.baseToken = createTokenInfo(token0)
            pool.quoteToken = createTokenInfo(token1)
            pool.isBaseToken0 = true
            pool.currentPrice = BigDecimal.zero()
            pool.volume24h = BigDecimal.zero()
        }

        pool.proposal = proposalId.toHexString()
        pool.save()
        return poolId
    }
    return null
}


function createTokenInfo(addr: Address): string {
    let id = addr.toHexString()
    let token = TokenInfo.load(id)
    if (!token) {
        token = new TokenInfo(id)
        token.name = "Unknown Token"
        token.symbol = "UNK"
        token.decimals = BigInt.fromI32(18)

        if (addr != ZERO_ADDRESS) {
            let erc20 = ERC20.bind(addr)
            let callName = erc20.try_name()
            if (!callName.reverted) token.name = callName.value
            let callSymbol = erc20.try_symbol()
            if (!callSymbol.reverted) token.symbol = callSymbol.value
            else token.symbol = "UNK-" + id.slice(2, 6)
            let callDecimals = erc20.try_decimals()
            if (!callDecimals.reverted) token.decimals = BigInt.fromI32(callDecimals.value)
        }
        token.save()
    }
    return id
}

function getWrapped(contract: FutarchyProposal, index: i32): Address {
    let call = contract.try_wrappedOutcome(BigInt.fromI32(index))
    return !call.reverted ? call.value.getWrapped1155() : ZERO_ADDRESS
}
