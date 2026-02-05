// FutarchyFactory ABI - Events for proposal creation
export const FutarchyFactoryAbi = [
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'proposal', type: 'address' },
            { indexed: false, internalType: 'string', name: 'marketName', type: 'string' },
            { indexed: false, internalType: 'bytes32', name: 'parentCollectionId', type: 'bytes32' },
            { indexed: false, internalType: 'bytes32', name: 'conditionId', type: 'bytes32' }
        ],
        name: 'NewProposal',
        type: 'event'
    }
] as const;
