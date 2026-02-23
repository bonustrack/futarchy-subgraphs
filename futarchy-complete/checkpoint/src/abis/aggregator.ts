export const AggregatorAbi = [
    {
        anonymous: false,
        inputs: [
            { indexed: false, internalType: 'string', name: 'newName', type: 'string' },
            { indexed: false, internalType: 'string', name: 'newDescription', type: 'string' }
        ],
        name: 'AggregatorInfoUpdated',
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
            { indexed: true, internalType: 'address', name: 'organizationMetadata', type: 'address' }
        ],
        name: 'OrganizationAdded',
        type: 'event'
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'organizationMetadata', type: 'address' },
            { indexed: false, internalType: 'string', name: 'companyName', type: 'string' }
        ],
        name: 'OrganizationCreatedAndAdded',
        type: 'event'
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'organizationMetadata', type: 'address' }
        ],
        name: 'OrganizationRemoved',
        type: 'event'
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' },
            { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' }
        ],
        name: 'OwnershipTransferred',
        type: 'event'
    },
    // View functions
    {
        inputs: [],
        name: 'aggregatorName',
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
