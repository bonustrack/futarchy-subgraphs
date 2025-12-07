import { Bytes, BigInt, Address } from "@graphprotocol/graph-ts"
import { AggregatorMetadataCreated } from "../generated/Creator/Creator"
import { OrganizationAdded, AggregatorInfoUpdated } from "../generated/templates/AggregatorTemplate/Aggregator"
import { ProposalAdded, CompanyInfoUpdated } from "../generated/templates/OrganizationTemplate/Organization"
import { MetadataUpdated } from "../generated/templates/ProposalTemplate/Proposal"

// Import Templates
import { AggregatorTemplate, OrganizationTemplate, ProposalTemplate } from "../generated/templates"

// Import Entities
import { Aggregator, Organization, Proposal } from "../generated/schema"

// Import Contract Bindings (to read state)
import { Aggregator as AggregatorContract } from "../generated/Creator/Aggregator"
import { Organization as OrganizationContract } from "../generated/templates/AggregatorTemplate/Organization"
import { Proposal as ProposalContract } from "../generated/templates/OrganizationTemplate/Proposal"

export function handleAggregatorCreated(event: AggregatorMetadataCreated): void {
    // 1. Start indexing the new Aggregator contract
    AggregatorTemplate.create(event.params.metadata)

    let entity = new Aggregator(event.params.metadata.toHexString())
    entity.name = event.params.name
    entity.creator = event.transaction.from
    entity.txHash = event.transaction.hash
    entity.createdAt = event.block.timestamp

    // 2. Bind to the contract to fetch the description
    let contract = AggregatorContract.bind(event.params.metadata)
    let descCall = contract.try_description()
    entity.description = descCall.reverted ? "" : descCall.value

    entity.save()
}

export function handleOrganizationAdded(event: OrganizationAdded): void {
    // 1. Start indexing the new Organization contract
    OrganizationTemplate.create(event.params.organizationMetadata)

    let entity = new Organization(event.params.organizationMetadata.toHexString())
    entity.aggregator = event.address.toHexString() // Link to parent Aggregator
    entity.createdAt = event.block.timestamp

    // 2. Fetch details from the new contract
    let contract = OrganizationContract.bind(event.params.organizationMetadata)

    let nameCall = contract.try_companyName()
    entity.name = nameCall.reverted ? "Unknown" : nameCall.value

    let descCall = contract.try_description()
    entity.description = descCall.reverted ? "" : descCall.value

    let ownerCall = contract.try_owner()
    entity.owner = ownerCall.reverted ? event.transaction.from : ownerCall.value

    entity.save()

    // 3. Backfill existing proposals (Addressing the race condition)
    let countCall = contract.try_getProposalsCount()
    if (!countCall.reverted) {
        let count = countCall.value
        if (count > BigInt.fromI32(0)) {
            let proposalsCall = contract.try_getProposals(BigInt.fromI32(0), count)
            if (!proposalsCall.reverted) {
                let proposalAddresses = proposalsCall.value
                for (let i = 0; i < proposalAddresses.length; i++) {
                    let items = proposalAddresses[i]
                    createProposalHelper(items, event.params.organizationMetadata, event.block.timestamp, event.transaction.from)
                }
            }
        }
    }
}

export function handleProposalAdded(event: ProposalAdded): void {
    createProposalHelper(event.params.proposalMetadata, event.address, event.block.timestamp, event.transaction.from)
}

function createProposalHelper(proposalAddress: Bytes, organizationAddress: Bytes, timestamp: BigInt, txFrom: Bytes): void {
    let id = proposalAddress.toHexString()
    let entity = Proposal.load(id)

    // Ensure template is created
    ProposalTemplate.create(Address.fromBytes(proposalAddress))

    if (entity == null) {
        entity = new Proposal(id)
        entity.createdAt = timestamp
    }

    entity.organization = organizationAddress.toHexString()

    // Fetch details
    let contract = ProposalContract.bind(Address.fromBytes(proposalAddress))

    let qCall = contract.try_displayNameQuestion()
    entity.displayNameQuestion = qCall.reverted ? "" : qCall.value

    let eCall = contract.try_displayNameEvent()
    entity.displayNameEvent = eCall.reverted ? "" : eCall.value

    let dCall = contract.try_description()
    entity.description = dCall.reverted ? "" : dCall.value

    let addrCall = contract.try_proposalAddress()
    entity.proposalAddress = addrCall.reverted ? Bytes.empty() : addrCall.value

    let ownerCall = contract.try_owner()
    entity.owner = ownerCall.reverted ? txFrom : ownerCall.value

    entity.save()
}

export function handleAggregatorUpdated(event: AggregatorInfoUpdated): void {
    let entity = Aggregator.load(event.address.toHexString())
    if (entity) {
        entity.name = event.params.newName
        entity.description = event.params.newDescription
        entity.save()
    }
}

export function handleOrganizationUpdated(event: CompanyInfoUpdated): void {
    let entity = Organization.load(event.address.toHexString())
    if (entity) {
        entity.name = event.params.newName
        entity.description = event.params.newDescription
        entity.save()
    }
}

export function handleProposalMetadataUpdated(event: MetadataUpdated): void {
    let entity = Proposal.load(event.address.toHexString())
    if (entity) {
        entity.displayNameQuestion = event.params.displayNameQuestion
        entity.displayNameEvent = event.params.displayNameEvent
        entity.description = event.params.description
        entity.save()
    }
}
