import { CheckpointConfig } from '@snapshot-labs/checkpoint';
import { AggregatorAbi, OrganizationAbi, ProposalMetadataAbi } from './abis';

// Gnosis Chain contract addresses
const AGGREGATOR_ADDRESS = '0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1';
const AGGREGATOR_START_BLOCK = 38000000;

export const config: CheckpointConfig = {
    network_node_url: process.env.RPC_URL || 'https://rpc.gnosis.gateway.fm',

    sources: [
        {
            contract: AGGREGATOR_ADDRESS,
            abi: 'Aggregator',
            start: AGGREGATOR_START_BLOCK,
            events: [
                { name: 'OrganizationAdded(address)', fn: 'handleOrganizationAdded' },
                { name: 'OrganizationCreatedAndAdded(address,string)', fn: 'handleOrganizationCreated' },
                { name: 'OrganizationRemoved(address)', fn: 'handleOrganizationRemoved' },
                { name: 'AggregatorInfoUpdated(string,string)', fn: 'handleAggregatorInfoUpdated' },
                { name: 'ExtendedMetadataUpdated(string,string)', fn: 'handleAggregatorMetadataUpdated' },
                { name: 'EditorSet(address)', fn: 'handleAggregatorEditorSet' }
            ]
        }
    ],

    // Dynamic templates for orgs created via factory
    templates: {
        Organization: {
            abi: 'Organization',
            events: [
                { name: 'ProposalAdded(address)', fn: 'handleProposalAdded' },
                { name: 'ProposalCreatedAndAdded(address,string,string)', fn: 'handleProposalCreated' },
                { name: 'ProposalRemoved(address)', fn: 'handleProposalRemoved' },
                { name: 'OrganizationInfoUpdated(string,string)', fn: 'handleOrganizationInfoUpdated' },
                { name: 'ExtendedMetadataUpdated(string,string)', fn: 'handleOrganizationMetadataUpdated' },
                { name: 'EditorSet(address)', fn: 'handleOrganizationEditorSet' }
            ]
        },
        ProposalMetadata: {
            abi: 'ProposalMetadata',
            events: [
                { name: 'ProposalInfoUpdated(string,string,string)', fn: 'handleProposalInfoUpdated' },
                { name: 'ExtendedMetadataUpdated(string,string)', fn: 'handleProposalMetadataUpdated' },
                { name: 'EditorSet(address)', fn: 'handleProposalEditorSet' }
            ]
        }
    },

    abis: {
        Aggregator: AggregatorAbi,
        Organization: OrganizationAbi,
        ProposalMetadata: ProposalMetadataAbi
    }
};
