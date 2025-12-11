import { Address, Bytes, BigInt, DataSourceContext } from "@graphprotocol/graph-ts"
import { NewProposal } from "../generated/FutarchyFactory/FutarchyFactory"
import { Transfer } from "../generated/templates/ERC20/ERC20"
import { ERC20 as ERC20Template } from "../generated/templates"
import { FutarchyProposal } from "../generated/FutarchyFactory/FutarchyProposal"
import { Token, Account, Balance } from "../generated/schema"

const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000")

export function handleNewProposal(event: NewProposal): void {
    let proposalId = event.params.proposal
    let contract = FutarchyProposal.bind(proposalId)

    // Fetch Wrapped Outcomes (0,1,2,3)
    // We spawn the ERC20 Template for each outcome logic
    startTracking(contract, 0, proposalId, "YES_COMPANY")
    startTracking(contract, 1, proposalId, "NO_COMPANY")
    startTracking(contract, 2, proposalId, "YES_CURRENCY")
    startTracking(contract, 3, proposalId, "NO_CURRENCY")
}

function startTracking(contract: FutarchyProposal, index: i32, proposalId: Address, role: string): void {
    let call = contract.try_wrappedOutcome(BigInt.fromI32(index))
    if (!call.reverted) {
        let tokenAddr = call.value
        if (tokenAddr != ZERO_ADDRESS) {
            // 1. Create Token Entity
            let token = new Token(tokenAddr)
            token.proposal = proposalId
            token.role = role
            token.save()

            // 2. Spawn Template to listen for Transfers
            ERC20Template.create(tokenAddr)
        }
    }
}

export function handleTransfer(event: Transfer): void {
    let tokenAddr = event.address
    let fromAddr = event.params.from
    let toAddr = event.params.to
    let value = event.params.value

    // Mint or Burn?
    let isMint = (fromAddr == ZERO_ADDRESS)
    let isBurn = (toAddr == ZERO_ADDRESS)

    // Update Sender (if not Mint)
    if (!isMint) {
        let fromAccount = getOrCreateAccount(fromAddr)
        let fromBalance = getOrCreateBalance(fromAccount, tokenAddr)
        fromBalance.amount = fromBalance.amount.minus(value)
        fromBalance.save()
    }

    // Update Receiver (if not Burn)
    if (!isBurn) {
        let toAccount = getOrCreateAccount(toAddr)
        let toBalance = getOrCreateBalance(toAccount, tokenAddr)
        toBalance.amount = toBalance.amount.plus(value)
        toBalance.save()
    }
}

function getOrCreateAccount(addr: Address): Account {
    let account = Account.load(addr)
    if (account == null) {
        account = new Account(addr)
        account.save()
    }
    return account as Account
}

function getOrCreateBalance(account: Account, tokenAddr: Address): Balance {
    let id = account.id.concat(tokenAddr)
    let balance = Balance.load(id)
    if (balance == null) {
        balance = new Balance(id)
        balance.account = account.id
        balance.token = tokenAddr
        balance.amount = BigInt.fromI32(0)
        balance.save()
    }
    return balance as Balance
}
