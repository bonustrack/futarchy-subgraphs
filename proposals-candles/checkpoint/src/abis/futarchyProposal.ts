// FutarchyProposal ABI - Contract read functions
export const FutarchyProposalAbi = [
    {
        inputs: [],
        name: 'marketName',
        outputs: [{ internalType: 'string', name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'collateralToken1',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [],
        name: 'collateralToken2',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        // Actual signature: wrappedOutcome(uint256):(address,bytes)
        // Returns: wrapped1155 token address and data bytes
        inputs: [{ internalType: 'uint256', name: 'index', type: 'uint256' }],
        name: 'wrappedOutcome',
        outputs: [
            { internalType: 'address', name: 'wrapped1155', type: 'address' },
            { internalType: 'bytes', name: 'data', type: 'bytes' }
        ],
        stateMutability: 'view',
        type: 'function'
    }
] as const;

