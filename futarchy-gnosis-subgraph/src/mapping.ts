import { Address, Bytes, BigInt, log } from "@graphprotocol/graph-ts"
import { NewProposal } from "../generated/FutarchyFactory/FutarchyFactory"
import { Pool as PoolEvent, AlgebraFactory } from "../generated/AlgebraFactory/AlgebraFactory"
import { FutarchyProposal } from "../generated/FutarchyFactory/FutarchyProposal"
import { Proposal, TokenLookup } from "../generated/schema"

const ALGEBRA_FACTORY_ADDRESS = Address.fromString("0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766")
const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000")

export function handleNewProposal(event: NewProposal): void {
    let proposalId = event.params.proposal
    let entity = new Proposal(Bytes.fromHexString(proposalId.toHexString()))

    entity.marketName = event.params.marketName
    entity.conditionId = event.params.conditionId
    entity.questionId = event.params.questionId
    entity.createdAtTimestamp = event.block.timestamp
    entity.createdAtBlock = event.block.number

    // 1. Fetch Tokens from Proposal Contract
    let contract = FutarchyProposal.bind(proposalId)

    // Fetch Collateral
    let col1Call = contract.try_collateralToken1()
    let col2Call = contract.try_collateralToken2()
    let companyToken = !col1Call.reverted ? col1Call.value : ZERO_ADDRESS
    let currencyToken = !col2Call.reverted ? col2Call.value : ZERO_ADDRESS

    entity.companyToken = companyToken
    entity.currencyToken = currencyToken

    // Fetch Wrapped Outcomes (0,1,2,3)
    let w0 = getWrapped(contract, 0) // YES_COMPANY
    let w1 = getWrapped(contract, 1) // NO_COMPANY
    let w2 = getWrapped(contract, 2) // YES_CURRENCY
    let w3 = getWrapped(contract, 3) // NO_CURRENCY

    entity.outcomeYesCompany = w0
    entity.outcomeNoCompany = w1
    entity.outcomeYesCurrency = w2
    entity.outcomeNoCurrency = w3

    entity.save()

    // 2. Create Lookups (Indexes tokens so we can find this proposal later)
    createLookup(w0, proposalId, "YES_COMPANY")
    createLookup(w1, proposalId, "NO_COMPANY")
    createLookup(w2, proposalId, "YES_CURRENCY")
    createLookup(w3, proposalId, "NO_CURRENCY")

    // 3. Check if Pools ALREADY exist (Pool created before Proposal?)
    let factory = AlgebraFactory.bind(ALGEBRA_FACTORY_ADDRESS)
    entity.poolConditionalYes = checkPool(factory, w0, w2)
    entity.poolConditionalNo = checkPool(factory, w1, w3)
    entity.poolExpectedValueYes = checkPool(factory, w0, currencyToken)
    entity.poolExpectedValueNo = checkPool(factory, w1, currencyToken)
    entity.poolPredictionYes = checkPool(factory, w2, currencyToken)
    entity.poolPredictionNo = checkPool(factory, w3, currencyToken)

    entity.save()
}

// 4. Handle NEW Pools being created
export function handlePoolCreated(event: PoolEvent): void {
    let t0 = event.params.token0
    let t1 = event.params.token1
    let pool = event.params.pool

    // Check if either token belongs to a known Proposal
    let lookup0 = TokenLookup.load(t0)
    let lookup1 = TokenLookup.load(t1)

    if (lookup0 != null) linkPoolToProposal(lookup0.proposal, lookup0.role, t1, pool)
    if (lookup1 != null) linkPoolToProposal(lookup1.proposal, lookup1.role, t0, pool)
}

// --- Helpers ---

function getWrapped(contract: FutarchyProposal, index: i32): Address {
    let call = contract.try_wrappedOutcome(BigInt.fromI32(index))
    if (!call.reverted) {
        // ABI says output name is 'wrapped1155', codegen usually makes this getter:
        return call.value.getWrapped1155()
    }
    return ZERO_ADDRESS
}

function createLookup(token: Address, proposal: Address, role: string): void {
    if (token == ZERO_ADDRESS) return
    let lookup = new TokenLookup(token)
    lookup.proposal = Bytes.fromHexString(proposal.toHexString())
    lookup.role = role
    lookup.save()
}

function checkPool(factory: AlgebraFactory, tA: Address, tB: Address): Bytes | null {
    if (tA == ZERO_ADDRESS || tB == ZERO_ADDRESS) return null
    let call = factory.try_poolByPair(tA, tB)
    if (!call.reverted && call.value != ZERO_ADDRESS) return call.value
    return null
}

function linkPoolToProposal(proposalId: Bytes, role: string, otherToken: Address, pool: Address): void {
    let p = Proposal.load(proposalId)
    if (p == null) return

    let currency = Address.fromBytes(p.currencyToken)
    let yesComp = Address.fromBytes(p.outcomeYesCompany)
    let noComp = Address.fromBytes(p.outcomeNoCompany)
    let yesCurr = Address.fromBytes(p.outcomeYesCurrency)
    let noCurr = Address.fromBytes(p.outcomeNoCurrency)

    // Logic: "If I am YES_COMPANY, and the other token is YES_CURRENCY, this is the Conditional Pool"
    if (role == "YES_COMPANY") {
        if (otherToken == yesCurr) p.poolConditionalYes = pool
        if (otherToken == currency) p.poolExpectedValueYes = pool
    }
    if (role == "NO_COMPANY") {
        if (otherToken == noCurr) p.poolConditionalNo = pool
        if (otherToken == currency) p.poolExpectedValueNo = pool
    }
    if (role == "YES_CURRENCY") {
        if (otherToken == yesComp) p.poolConditionalYes = pool
        if (otherToken == currency) p.poolPredictionYes = pool
    }
    if (role == "NO_CURRENCY") {
        if (otherToken == noComp) p.poolConditionalNo = pool
        if (otherToken == currency) p.poolPredictionNo = pool
    }
    p.save()
}
