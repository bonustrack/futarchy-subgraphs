// Algebra Factory ABI - Pool creation event (Gnosis Chain)
// Note: Algebra uses "Pool" event without fee parameter
export const AlgebraFactoryAbi = [
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'token0', type: 'address' },
            { indexed: true, internalType: 'address', name: 'token1', type: 'address' },
            { indexed: false, internalType: 'address', name: 'pool', type: 'address' }
        ],
        name: 'Pool',
        type: 'event'
    }
] as const;
