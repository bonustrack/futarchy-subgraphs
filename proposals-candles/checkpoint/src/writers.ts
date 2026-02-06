// Event Writers for multichain proposal pool candles
// Pattern: DEX-specific handlers call shared core logic

import { evm } from '@snapshot-labs/checkpoint';
import { createPublicClient, http } from 'viem';
import { gnosis, mainnet } from 'viem/chains';
import { WhitelistedToken, Proposal, Pool, Candle, Swap } from '../.checkpoint/models';
import { FutarchyProposalAbi, ERC20Abi } from './abis';
import {
    CHAIN_IDS,
    getSourceName,
    DexType,
    ROLE_YES_COMPANY,
    ROLE_NO_COMPANY,
    ROLE_YES_CURRENCY,
    ROLE_NO_CURRENCY,
    ROLE_COLLATERAL,
    ROLE_COMPANY,
    CANDLE_PERIODS,
    convertSqrtPriceX96,
    classifyPool,
    formatPoolName,
    createId
} from './adapters';

// Viem clients for each chain
const gnosisClient = createPublicClient({
    chain: gnosis,
    transport: http(process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com')
});

const mainnetClient = createPublicClient({
    chain: mainnet,
    transport: http(process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com')
});

const getClient = (indexer: string) => indexer === 'mainnet' ? mainnetClient : gnosisClient;

// Track which pools belong to which DEX for swap/mint/burn routing
const poolDexMap = new Map<string, DexType>();

// ============================================================================
// FUTARCHY PROTOCOL HANDLERS (Shared across chains)
// ============================================================================

export const handleNewProposal: evm.Writer = async ({ event, blockNumber, source, helpers }) => {
    if (!event) return;

    const indexer = getSourceName(source);
    const args = (event as any).args;

    // Debug: Log full event structure to understand indexed params
    console.log(`[${indexer}] DEBUG NewProposal event:`, JSON.stringify({
        args: args,
        topics: (event as any).topics,
        address: (event as any).address,
        keys: args ? Object.keys(args) : 'no args'
    }, null, 2));

    const proposalAddr = (args?.proposal as string)?.toLowerCase();
    const marketName = args?.marketName;
    const chainId = CHAIN_IDS[indexer] || 100;

    if (!proposalAddr) {
        console.log(`[${indexer}] WARNING: proposalAddr is undefined/null, skipping`);
        return;
    }

    console.log(`[${indexer}] NewProposal: ${proposalAddr}`);

    const client = getClient(indexer);
    const proposalId = createId(chainId, proposalAddr);

    try {
        // Get collateral tokens from proposal contract
        const [collateral1, collateral2] = await Promise.all([
            client.readContract({ address: proposalAddr as `0x${string}`, abi: FutarchyProposalAbi, functionName: 'collateralToken1' }).catch(() => null),
            client.readContract({ address: proposalAddr as `0x${string}`, abi: FutarchyProposalAbi, functionName: 'collateralToken2' }).catch(() => null)
        ]);

        // Whitelist collateral tokens
        if (collateral1) {
            await saveToken(indexer, collateral1 as string, ROLE_COMPANY, null, client);
        }
        if (collateral2) {
            await saveToken(indexer, collateral2 as string, ROLE_COLLATERAL, null, client);
        }

        // Get 4 wrapped outcome tokens
        const roles = [ROLE_YES_COMPANY, ROLE_NO_COMPANY, ROLE_YES_CURRENCY, ROLE_NO_CURRENCY];
        const outcomeTokenIds: string[] = [];

        for (let i = 0; i < 4; i++) {
            try {
                const outcome = await client.readContract({
                    address: proposalAddr as `0x${string}`,
                    abi: FutarchyProposalAbi,
                    functionName: 'wrappedOutcome',
                    args: [BigInt(i)]
                }) as any;

                // New ABI returns (address wrapped1155, bytes data)
                // outcome is an array: [wrapped1155Address, dataBytes]
                // or object: { wrapped1155, data }
                const tokenAddress = outcome[0] || outcome.wrapped1155;

                console.log(`[${indexer}] wrappedOutcome[${i}]: ${tokenAddress}`);

                if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
                    await saveToken(indexer, tokenAddress, roles[i], proposalId, client);
                    outcomeTokenIds.push(createId(chainId, tokenAddress));
                }
            } catch (err) {
                console.log(`[${indexer}] wrappedOutcome[${i}] failed:`, (err as any)?.message || err);
            }
        }

        // Create proposal entity
        const proposal = new Proposal(proposalId, indexer);
        proposal.chain = chainId;
        proposal.address = proposalAddr;
        proposal.marketName = marketName || '';
        proposal.companyToken = collateral1 ? createId(chainId, collateral1 as string) : '';
        proposal.currencyToken = collateral2 ? createId(chainId, collateral2 as string) : '';
        proposal.outcomeTokens = JSON.stringify(outcomeTokenIds);
        await proposal.save();

        console.log(`✅ [${indexer}] Whitelisted tokens for proposal ${proposalAddr} (${outcomeTokenIds.length} outcome tokens)`);
    } catch (err) {
        console.error(`❌ [${indexer}] Error processing proposal ${proposalAddr}:`, err);
    }
};


async function saveToken(
    indexer: string,
    address: string,
    role: string,
    proposalId: string | null,
    client: any
) {
    const chainId = CHAIN_IDS[indexer] || 100;
    const tokenId = createId(chainId, address);

    // Skip if token already exists (same token can be in multiple proposals)
    const existing = await WhitelistedToken.loadEntity(tokenId, indexer);
    if (existing) {
        console.log(`[${indexer}] Token already exists: ${tokenId}`);
        return;
    }

    let symbol = 'UNKNOWN';
    let decimals = 18;

    try {
        const [sym, dec] = await Promise.all([
            client.readContract({ address: address as `0x${string}`, abi: ERC20Abi, functionName: 'symbol' }).catch(() => 'UNKNOWN'),
            client.readContract({ address: address as `0x${string}`, abi: ERC20Abi, functionName: 'decimals' }).catch(() => 18)
        ]);
        symbol = sym as string;
        decimals = Number(dec);
    } catch {
        console.warn(`[${indexer}] Could not fetch token metadata for ${address}`);
    }

    const token = new WhitelistedToken(tokenId, indexer);
    token.chain = chainId;
    token.address = address.toLowerCase();
    token.symbol = symbol;
    token.decimals = decimals;
    token.role = role;
    token.proposal = proposalId;
    await token.save();

    console.log(`[${indexer}] Whitelisted: ${tokenId} (${symbol}) as ${role}`);
}

// ============================================================================
// DEX-SPECIFIC POOL CREATION HANDLERS
// ============================================================================

export const handleAlgebraPoolCreated: evm.Writer = async ({ event, blockNumber, source, helpers }) => {
    if (!event) return;

    const indexer = getSourceName(source);
    const args = (event as any).args;
    const token0 = (args?.token0 as string)?.toLowerCase();
    const token1 = (args?.token1 as string)?.toLowerCase();
    const poolAddr = (args?.pool as string)?.toLowerCase();

    await createPoolEntity(indexer, poolAddr, token0, token1, 'ALGEBRA', null, blockNumber, helpers);
};

export const handleUniswapPoolCreated: evm.Writer = async ({ event, blockNumber, source, helpers }) => {
    if (!event) return;

    const indexer = getSourceName(source);
    const args = (event as any).args;
    const token0 = (args?.token0 as string)?.toLowerCase();
    const token1 = (args?.token1 as string)?.toLowerCase();
    const fee = args?.fee?.toString();
    const poolAddr = (args?.pool as string)?.toLowerCase();

    await createPoolEntity(indexer, poolAddr, token0, token1, 'UNISWAP_V3', fee, blockNumber, helpers);
};

async function createPoolEntity(
    indexer: string,
    poolAddr: string,
    token0: string,
    token1: string,
    dex: DexType,
    fee: string | null,
    blockNumber: number | bigint,
    helpers: any
) {
    const chainId = CHAIN_IDS[indexer] || 100;
    const poolId = createId(chainId, poolAddr);
    const token0Id = createId(chainId, token0);
    const token1Id = createId(chainId, token1);

    // Check if both tokens are whitelisted
    const wt0 = await WhitelistedToken.loadEntity(token0Id, indexer);
    const wt1 = await WhitelistedToken.loadEntity(token1Id, indexer);

    if (!wt0 || !wt1) {
        // Skip non-Futarchy pools
        return;
    }

    // Track DEX type
    poolDexMap.set(poolId, dex);

    // Classify pool type
    const { type, isInverted, outcomeSide } = classifyPool(wt0.role || '', wt1.role || '');
    const name = formatPoolName(wt0.symbol || 'T0', wt1.symbol || 'T1', isInverted);

    // Create pool entity
    const pool = new Pool(poolId, indexer);
    pool.chain = chainId;
    pool.address = poolAddr;
    pool.dex = dex;
    pool.token0 = token0Id;
    pool.token1 = token1Id;
    pool.fee = fee || '';
    pool.liquidity = '0';
    pool.sqrtPrice = '0';
    pool.price = '0';
    pool.tick = 0;
    pool.isInverted = isInverted ? 1 : 0;
    pool.name = name;
    pool.type = type;
    pool.outcomeSide = outcomeSide;
    pool.volumeToken0 = '0';
    pool.volumeToken1 = '0';
    pool.proposal = wt0.proposal || wt1.proposal;
    await pool.save();

    // Start tracking pool events via template
    const templateName = dex === 'ALGEBRA' ? 'AlgebraPool' : 'UniswapV3Pool';
    await helpers.executeTemplate(templateName, { contract: poolAddr, start: blockNumber });

    console.log(`✅ [${indexer}] Created ${dex} pool: ${poolId} (${name})`);
}

// ============================================================================
// SHARED POOL EVENT HANDLERS
// ============================================================================

export const handleInitialize: evm.Writer = async ({ event, source }) => {
    if (!event) return;

    const indexer = getSourceName(source);
    const args = (event as any).args;
    const chainId = CHAIN_IDS[indexer] || 100;
    const poolAddr = (event as any).address?.toLowerCase();
    const poolId = createId(chainId, poolAddr);

    // Both Algebra and Uniswap V3 have same event signature
    const sqrtPriceX96 = BigInt((args?.[0] || args?.price || args?.sqrtPriceX96 || 0).toString());
    const tick = Number(args?.[1] || args?.tick || 0);
    const price = convertSqrtPriceX96(sqrtPriceX96);

    const pool = await Pool.loadEntity(poolId, indexer);
    if (pool) {
        pool.sqrtPrice = sqrtPriceX96.toString();
        pool.price = price.toString();
        pool.tick = tick;
        await pool.save();
    }

    console.log(`[${indexer}] Initialize pool ${poolId}: price=${price.toFixed(8)}`);
};

export const handleSwap: evm.Writer = async ({ event, source, block }) => {
    if (!event) return;

    const indexer = getSourceName(source);
    const args = (event as any).args;
    const chainId = CHAIN_IDS[indexer] || 100;
    const poolAddr = (event as any).address?.toLowerCase();
    const poolId = createId(chainId, poolAddr);

    const sender = (args?.sender as string)?.toLowerCase() || '';
    const recipient = (args?.recipient as string)?.toLowerCase() || '';
    const amount0 = BigInt((args?.amount0 || 0).toString());
    const amount1 = BigInt((args?.amount1 || 0).toString());
    const sqrtPriceX96 = BigInt((args?.[4] || args?.price || args?.sqrtPriceX96 || 0).toString());
    const liquidity = BigInt((args?.[5] || args?.liquidity || 0).toString());
    const tick = Number(args?.[6] || args?.tick || 0);

    const price = convertSqrtPriceX96(sqrtPriceX96);
    const timestamp = Number(block?.timestamp || Math.floor(Date.now() / 1000));
    const blockNum = Number(block?.number || 0);

    // Create swap entity
    const txHash = (event as any).transactionHash || '';
    const logIndex = (event as any).logIndex || 0;
    const swapId = `${poolId}-${txHash}-${logIndex}`;

    const swap = new Swap(swapId, indexer);
    swap.chain = chainId;
    swap.transactionHash = txHash;
    swap.timestamp = timestamp;
    swap.pool = poolId;
    swap.sender = sender;
    swap.recipient = recipient;
    swap.origin = sender;
    swap.amount0 = amount0.toString();
    swap.amount1 = amount1.toString();
    swap.amountIn = (amount0 < 0n ? (-amount0).toString() : amount0.toString());
    swap.amountOut = (amount1 < 0n ? (-amount1).toString() : amount1.toString());
    swap.tokenIn = amount0 > 0n ? 'token0' : 'token1';
    swap.tokenOut = amount0 > 0n ? 'token1' : 'token0';
    swap.price = price.toString();
    await swap.save();

    // Update pool
    const pool = await Pool.loadEntity(poolId, indexer);
    if (pool) {
        pool.sqrtPrice = sqrtPriceX96.toString();
        pool.price = price.toString();
        pool.liquidity = liquidity.toString();
        pool.tick = tick;
        pool.volumeToken0 = (BigInt(pool.volumeToken0 || '0') + (amount0 < 0n ? -amount0 : amount0)).toString();
        pool.volumeToken1 = (BigInt(pool.volumeToken1 || '0') + (amount1 < 0n ? -amount1 : amount1)).toString();
        await pool.save();
    }

    // Update candles for each period
    for (const period of CANDLE_PERIODS) {
        const periodStart = Math.floor(timestamp / period) * period;
        const candleId = `${poolId}-${period}-${periodStart}`;

        let candle = await Candle.loadEntity(candleId, indexer);
        const priceStr = price.toString();

        if (!candle) {
            candle = new Candle(candleId, indexer);
            candle.chain = chainId;
            candle.pool = poolId;
            candle.time = timestamp;
            candle.period = period;
            candle.periodStartUnix = periodStart;
            candle.block = blockNum;
            candle.open = priceStr;
            candle.high = priceStr;
            candle.low = priceStr;
            candle.close = priceStr;
            candle.volumeToken0 = '0';
            candle.volumeToken1 = '0';
        } else {
            candle.close = priceStr;
            candle.time = timestamp;
            candle.block = blockNum;
            if (parseFloat(priceStr) > parseFloat(candle.high || '0')) candle.high = priceStr;
            if (parseFloat(priceStr) < parseFloat(candle.low || priceStr)) candle.low = priceStr;
        }

        candle.volumeToken0 = (BigInt(candle.volumeToken0 || '0') + (amount0 < 0n ? -amount0 : amount0)).toString();
        candle.volumeToken1 = (BigInt(candle.volumeToken1 || '0') + (amount1 < 0n ? -amount1 : amount1)).toString();
        await candle.save();
    }

    console.log(`[${indexer}] Swap on ${poolId}: price=${price.toFixed(8)}`);
};

export const handleMint: evm.Writer = async ({ event, source }) => {
    if (!event) return;

    const indexer = getSourceName(source);
    const args = (event as any).args;
    const chainId = CHAIN_IDS[indexer] || 100;
    const poolAddr = (event as any).address?.toLowerCase();
    const poolId = createId(chainId, poolAddr);

    const liquidityDelta = BigInt((args?.[4] || args?.liquidityAmount || args?.amount || 0).toString());

    const pool = await Pool.loadEntity(poolId, indexer);
    if (pool) {
        pool.liquidity = (BigInt(pool.liquidity || '0') + liquidityDelta).toString();
        await pool.save();
    }

    console.log(`[${indexer}] Mint on ${poolId}: +${liquidityDelta.toString()}`);
};

export const handleBurn: evm.Writer = async ({ event, source }) => {
    if (!event) return;

    const indexer = getSourceName(source);
    const args = (event as any).args;
    const chainId = CHAIN_IDS[indexer] || 100;
    const poolAddr = (event as any).address?.toLowerCase();
    const poolId = createId(chainId, poolAddr);

    const liquidityDelta = BigInt((args?.[3] || args?.liquidityAmount || args?.amount || 0).toString());

    const pool = await Pool.loadEntity(poolId, indexer);
    if (pool) {
        const currentLiq = BigInt(pool.liquidity || '0');
        pool.liquidity = (currentLiq > liquidityDelta ? currentLiq - liquidityDelta : 0n).toString();
        await pool.save();
    }

    console.log(`[${indexer}] Burn on ${poolId}: -${liquidityDelta.toString()}`);
};
