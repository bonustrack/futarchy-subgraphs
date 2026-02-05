// Uniswap V3 Factory ABI - Pool creation event (Ethereum Mainnet)
// Note: Uniswap V3 uses "PoolCreated" with fee parameter
export const UniswapV3FactoryAbi = [
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'token0', type: 'address' },
            { indexed: true, internalType: 'address', name: 'token1', type: 'address' },
            { indexed: true, internalType: 'uint24', name: 'fee', type: 'uint24' },
            { indexed: false, internalType: 'int24', name: 'tickSpacing', type: 'int24' },
            { indexed: false, internalType: 'address', name: 'pool', type: 'address' }
        ],
        name: 'PoolCreated',
        type: 'event'
    }
] as const;
