export const OrganizationAbi = [
    // Events
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'proposalMetadata', type: 'address' }
        ],
        name: 'ProposalAdded',
        type: 'event'
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'proposalMetadata', type: 'address' },
            { indexed: true, internalType: 'address', name: 'proposalAddress', type: 'address' }
        ],
        name: 'ProposalCreatedAndAdded',
        type: 'event'
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'proposalMetadata', type: 'address' }
        ],
        name: 'ProposalRemoved',
        type: 'event'
    },
    {
        anonymous: false,
        inputs: [
            { indexed: false, internalType: 'string', name: 'newName', type: 'string' },
            { indexed: false, internalType: 'string', name: 'newDescription', type: 'string' }
        ],
        name: 'OrganizationInfoUpdated',
        type: 'event'
    },
    {
        anonymous: false,
        inputs: [
            { indexed: false, internalType: 'string', name: 'metadata', type: 'string' },
            { indexed: false, internalType: 'string', name: 'metadataURI', type: 'string' }
        ],
        name: 'ExtendedMetadataUpdated',
        type: 'event'
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'newEditor', type: 'address' }
        ],
        name: 'EditorSet',
        type: 'event'
    },
    // View functions
    {
        inputs: [],
        name: 'companyName',
        outputs: [{ internalType: 'string', name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'description',
        outputs: [{ internalType: 'string', name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'metadata',
        outputs: [{ internalType: 'string', name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'metadataURI',
        outputs: [{ internalType: 'string', name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'owner',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'editor',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function'
    }
] as const;
