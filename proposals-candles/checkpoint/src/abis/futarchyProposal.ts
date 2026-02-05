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
        inputs: [{ internalType: 'uint256', name: 'index', type: 'uint256' }],
        name: 'wrappedOutcome',
        outputs: [
            {
                components: [
                    { internalType: 'contract IERC20', name: 'collateralToken', type: 'address' },
                    { internalType: 'bytes32', name: 'parentCollectionId', type: 'bytes32' },
                    { internalType: 'bytes32', name: 'conditionId', type: 'bytes32' },
                    { internalType: 'uint256', name: 'indexSet', type: 'uint256' },
                    { internalType: 'contract Wrapped1155Factory', name: 'wrapper', type: 'address' },
                    { internalType: 'contract IERC20', name: 'wrapped1155', type: 'address' }
                ],
                internalType: 'struct IFutarchyProposal.WrappedOutcome',
                name: '',
                type: 'tuple'
            }
        ],
        stateMutability: 'view',
        type: 'function'
    }
] as const;
