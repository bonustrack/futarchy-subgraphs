import { evm } from '@snapshot-labs/checkpoint';
import { createPublicClient, http, parseAbi } from 'viem';
import { gnosis } from 'viem/chains';
import { Aggregator, Organization, ProposalEntity } from '../.checkpoint/models';

// Viem client for reading contract state
const client = createPublicClient({
    chain: gnosis,
    transport: http(process.env.RPC_URL || 'https://rpc.gnosischain.com')
});

// Organization ABI for reading state
const OrgAbi = parseAbi([
    'function companyName() view returns (string)',
    'function description() view returns (string)',
    'function metadata() view returns (string)',
    'function metadataURI() view returns (string)',
    'function owner() view returns (address)',
    'function editor() view returns (address)'
]);

// Proposal ABI for reading state  
const ProposalAbi = parseAbi([
    'function proposalAddress() view returns (address)',
    'function displayNameQuestion() view returns (string)',
    'function displayNameEvent() view returns (string)',
    'function description() view returns (string)',
    'function metadata() view returns (string)',
    'function metadataURI() view returns (string)',
    'function owner() view returns (address)',
    'function editor() view returns (address)'
]);

// Aggregator address constant (same as in config)
const AGGREGATOR_ADDRESS = '0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1';
const INDEXER_NAME = 'gnosis';

// ============================================
// AGGREGATOR HANDLERS
// ============================================

export const handleOrganizationAdded: evm.Writer = async ({ event, blockNumber, source, helpers }) => {
    if (!event) return;

    const orgAddress = ((event as any).args?.organizationMetadata as string)?.toLowerCase();
    // Use source.contract if available, otherwise fall back to default aggregator
    const aggregatorId = source?.contract?.toLowerCase() || AGGREGATOR_ADDRESS;

    if (!orgAddress) return;

    try {
        // Read organization data from contract
        const [name, description, metadata, metadataURI, owner, editor] = await Promise.all([
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'companyName' }),
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'description' }),
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'metadata' }),
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'metadataURI' }),
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'owner' }),
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'editor' })
        ]);

        // Create Organization entity using generated model
        const org = new Organization(orgAddress, INDEXER_NAME);
        org.aggregator = aggregatorId;
        org.name = name as string;
        org.description = description as string;
        org.metadata = metadata as string;
        org.metadataURI = metadataURI as string;
        org.owner = (owner as string).toLowerCase();
        org.editor = (editor as string).toLowerCase();
        org.createdAt = Number(blockNumber);
        await org.save();

        // Start listening to the new organization
        await helpers.executeTemplate('Organization', {
            contract: orgAddress,
            start: blockNumber
        });

        console.log(`✅ Organization added: ${name} (${orgAddress}) -> aggregator: ${aggregatorId}`);
    } catch (error) {
        console.error(`❌ Failed to add organization ${orgAddress}:`, error);
    }
};


export const handleOrganizationCreated: evm.Writer = async ({ event, blockNumber, source, helpers }) => {
    if (!event) return;

    const args = (event as any).args;
    const orgAddress = (args?.organizationMetadata as string)?.toLowerCase();
    const companyName = args?.companyName;
    // Use source.contract or default aggregator
    const aggregatorId = source?.contract?.toLowerCase() || AGGREGATOR_ADDRESS;

    if (!orgAddress) return;

    try {
        // Read full organization data
        const [description, metadata, metadataURI, owner, editor] = await Promise.all([
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'description' }),
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'metadata' }),
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'metadataURI' }),
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'owner' }),
            client.readContract({ address: orgAddress as `0x${string}`, abi: OrgAbi, functionName: 'editor' })
        ]);

        const org = new Organization(orgAddress, INDEXER_NAME);
        org.aggregator = aggregatorId;
        org.name = companyName;
        org.description = description as string;
        org.metadata = metadata as string;
        org.metadataURI = metadataURI as string;
        org.owner = (owner as string).toLowerCase();
        org.editor = (editor as string).toLowerCase();
        org.createdAt = Number(blockNumber);
        await org.save();

        await helpers.executeTemplate('Organization', {
            contract: orgAddress,
            start: blockNumber
        });

        console.log(`✅ Organization created: ${companyName} (${orgAddress})`);
    } catch (error) {
        console.error(`❌ Failed to create organization ${orgAddress}:`, error);
    }
};

export const handleOrganizationRemoved: evm.Writer = async ({ event }) => {
    if (!event) return;
    const orgAddress = ((event as any).args?.organizationMetadata as string)?.toLowerCase();
    console.log(`🗑️ Organization removed: ${orgAddress}`);
};

export const handleAggregatorInfoUpdated: evm.Writer = async ({ event }) => {
    const args = (event as any)?.args;
    console.log(`📝 Aggregator info updated: ${args?.newName}`);
};

export const handleAggregatorMetadataUpdated: evm.Writer = async ({ event }) => {
    console.log(`📦 Aggregator metadata updated`);
};

export const handleAggregatorEditorSet: evm.Writer = async ({ event }) => {
    const args = (event as any)?.args;
    console.log(`✏️ Aggregator editor set: ${args?.newEditor}`);
};

// ============================================
// ORGANIZATION HANDLERS
// ============================================

export const handleProposalAdded: evm.Writer = async ({ event, blockNumber, source, helpers }) => {
    if (!event) return;

    const proposalAddress = ((event as any).args?.proposalMetadata as string)?.toLowerCase();
    const orgAddress = source?.contract.toLowerCase();

    if (!proposalAddress) return;

    try {
        // Read proposal data from contract
        const [tradingAddress, title, displayNameEvent, description, metadata, metadataURI, owner, editor] = await Promise.all([
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'proposalAddress' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'displayNameQuestion' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'displayNameEvent' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'description' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'metadata' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'metadataURI' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'owner' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'editor' })
        ]);

        const proposal = new ProposalEntity(proposalAddress, INDEXER_NAME);
        proposal.organization = orgAddress || null;
        proposal.owner = (owner as string).toLowerCase();
        proposal.editor = (editor as string).toLowerCase();
        proposal.proposalAddress = (tradingAddress as string).toLowerCase();
        proposal.title = title as string;
        proposal.description = description as string;
        proposal.metadata = metadata as string;
        proposal.metadataURI = metadataURI as string;
        proposal.displayNameEvent = displayNameEvent as string;
        proposal.displayNameQuestion = title as string;
        proposal.createdAtTimestamp = Number(blockNumber);
        await proposal.save();

        await helpers.executeTemplate('ProposalMetadata', {
            contract: proposalAddress,
            start: blockNumber
        });

        console.log(`✅ Proposal added: ${(title as string)?.slice(0, 50)}...`);
    } catch (error) {
        console.error(`❌ Failed to add proposal ${proposalAddress}:`, error);
    }
};

export const handleProposalCreated: evm.Writer = async ({ event, blockNumber, source, helpers }) => {
    if (!event) return;

    const args = (event as any).args;
    const proposalAddress = (args?.proposalMetadata as string)?.toLowerCase();
    const orgAddress = source?.contract.toLowerCase();

    if (!proposalAddress) return;

    try {
        const [tradingAddress, title, displayNameEvent, description, metadata, metadataURI, owner, editor] = await Promise.all([
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'proposalAddress' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'displayNameQuestion' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'displayNameEvent' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'description' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'metadata' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'metadataURI' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'owner' }),
            client.readContract({ address: proposalAddress as `0x${string}`, abi: ProposalAbi, functionName: 'editor' })
        ]);

        const proposal = new ProposalEntity(proposalAddress, INDEXER_NAME);
        proposal.organization = orgAddress || null;
        proposal.owner = (owner as string).toLowerCase();
        proposal.editor = (editor as string).toLowerCase();
        proposal.proposalAddress = (tradingAddress as string).toLowerCase();
        proposal.title = title as string;
        proposal.description = description as string;
        proposal.metadata = metadata as string;
        proposal.metadataURI = metadataURI as string;
        proposal.displayNameEvent = displayNameEvent as string;
        proposal.displayNameQuestion = title as string;
        proposal.createdAtTimestamp = Number(blockNumber);
        await proposal.save();

        await helpers.executeTemplate('ProposalMetadata', {
            contract: proposalAddress,
            start: blockNumber
        });

        console.log(`✅ Proposal created: ${(title as string)?.slice(0, 50)}...`);
    } catch (error) {
        console.error(`❌ Failed to create proposal ${proposalAddress}:`, error);
    }
};

export const handleProposalRemoved: evm.Writer = async ({ event }) => {
    if (!event) return;
    const proposalAddress = ((event as any).args?.proposalMetadata as string)?.toLowerCase();
    console.log(`🗑️ Proposal removed: ${proposalAddress}`);
};

export const handleOrganizationInfoUpdated: evm.Writer = async ({ event, source }) => {
    const args = (event as any)?.args;
    const orgAddress = source?.contract.toLowerCase();

    if (args?.newName && orgAddress) {
        const org = await Organization.loadEntity(orgAddress, INDEXER_NAME);
        if (org) {
            org.name = args.newName;
            org.description = args.newDescription || '';
            await org.save();
            console.log(`📝 Organization info updated: ${args.newName}`);
        }
    }
};

export const handleOrganizationMetadataUpdated: evm.Writer = async ({ event, source }) => {
    const args = (event as any)?.args;
    const orgAddress = source?.contract.toLowerCase();

    if (orgAddress) {
        const org = await Organization.loadEntity(orgAddress, INDEXER_NAME);
        if (org) {
            org.metadata = args?.metadata || '';
            org.metadataURI = args?.metadataURI || '';
            await org.save();
        }
    }
    console.log(`📦 Organization metadata updated`);
};

export const handleOrganizationEditorSet: evm.Writer = async ({ event, source }) => {
    const args = (event as any)?.args;
    const orgAddress = source?.contract.toLowerCase();

    if (orgAddress && args?.newEditor) {
        const org = await Organization.loadEntity(orgAddress, INDEXER_NAME);
        if (org) {
            org.editor = args.newEditor.toLowerCase();
            await org.save();
        }
    }
    console.log(`✏️ Organization editor set: ${args?.newEditor}`);
};

// ============================================
// PROPOSAL HANDLERS
// ============================================

export const handleProposalInfoUpdated: evm.Writer = async ({ event, source }) => {
    const args = (event as any)?.args;
    const proposalAddress = source?.contract.toLowerCase();

    if (proposalAddress) {
        const proposal = await ProposalEntity.loadEntity(proposalAddress, INDEXER_NAME);
        if (proposal) {
            proposal.title = args?.displayNameQuestion || '';
            proposal.displayNameEvent = args?.displayNameEvent || '';
            proposal.description = args?.description || '';
            await proposal.save();
        }
    }
    console.log(`📝 Proposal info updated`);
};

export const handleProposalMetadataUpdated: evm.Writer = async ({ event, source }) => {
    const args = (event as any)?.args;
    const proposalAddress = source?.contract.toLowerCase();

    if (proposalAddress) {
        const proposal = await ProposalEntity.loadEntity(proposalAddress, INDEXER_NAME);
        if (proposal) {
            proposal.metadata = args?.metadata || '';
            proposal.metadataURI = args?.metadataURI || '';
            await proposal.save();
        }
    }
    console.log(`📦 Proposal metadata updated`);
};

export const handleProposalEditorSet: evm.Writer = async ({ event, source }) => {
    const args = (event as any)?.args;
    const proposalAddress = source?.contract.toLowerCase();

    if (proposalAddress && args?.newEditor) {
        const proposal = await ProposalEntity.loadEntity(proposalAddress, INDEXER_NAME);
        if (proposal) {
            proposal.editor = args.newEditor.toLowerCase();
            await proposal.save();
        }
    }
    console.log(`✏️ Proposal editor set: ${args?.newEditor}`);
};

// Export all writers
export const writers = {
    handleOrganizationAdded,
    handleOrganizationCreated,
    handleOrganizationRemoved,
    handleAggregatorInfoUpdated,
    handleAggregatorMetadataUpdated,
    handleAggregatorEditorSet,
    handleProposalAdded,
    handleProposalCreated,
    handleProposalRemoved,
    handleOrganizationInfoUpdated,
    handleOrganizationMetadataUpdated,
    handleOrganizationEditorSet,
    handleProposalInfoUpdated,
    handleProposalMetadataUpdated,
    handleProposalEditorSet
};
