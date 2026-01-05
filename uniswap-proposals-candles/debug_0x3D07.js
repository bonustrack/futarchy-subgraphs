
const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.17";
const PROPOSAL_ID = "0x3d076d5d12341226527241f8a489d4a8863b73e5";

async function run() {
    // 1. Fetch Proposal & Pools & Candles
    // We can fetch candles here because they ARE derived in the schema
    const queryProposal = `
    {
        proposal(id: "${PROPOSAL_ID}") {
            id
            marketName
            pools {
                id
                type
                token0 { symbol }
                token1 { symbol }
                liquidity
                candles(first: 3, orderBy: time, orderDirection: desc) {
                    time
                    close
                }
            }
        }
    }`;

    try {
        console.log("Fetching Proposal & Pools...");
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryProposal })
        });
        const { data, errors } = await res.json();

        if (errors) {
            console.error("GraphQL Errors (Proposal):", errors);
            return;
        }

        if (!data || !data.proposal) {
            console.log("Proposal not found");
            return;
        }

        console.log(`Proposal: ${data.proposal.id}`);
        console.log(`Market: ${data.proposal.marketName}`);
        console.log(`Pools: ${data.proposal.pools.length}`);
        console.log('---');

        // 2. Fetch Swaps for each pool
        for (const p of data.proposal.pools) {
            console.log(`[${p.type}] ${p.id}`);
            console.log(`  Tokens: ${p.token0.symbol} / ${p.token1.symbol}`);
            console.log(`  Liquidity: ${p.liquidity}`);

            // Candles (from initial query)
            console.log(`  Candles Found: ${p.candles.length}`);
            if (p.candles.length > 0) {
                console.log(`    Last Candle Close: ${p.candles[0].close} @ ${p.candles[0].time}`);
            }

            // Swaps (Separate Query)
            const querySwaps = `{
                swaps(first: 3, orderBy: timestamp, orderDirection: desc, where: { pool: "${p.id}" }) {
                    timestamp
                    price
                    amount0
                    amount1
                }
            }`;

            const swapRes = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: querySwaps })
            });
            const swapData = await swapRes.json();

            if (swapData.errors) {
                console.error("  Swap Query Error:", swapData.errors);
            } else {
                const swaps = swapData.data ? swapData.data.swaps : [];
                console.log(`  Swaps Found: ${swaps.length}`);
                if (swaps.length > 0) {
                    console.log(`    Last Swap Price: ${swaps[0].price} @ ${swaps[0].timestamp}`);
                }
            }
            console.log('-');
        }

    } catch (e) {
        console.error("Script Error:", e);
    }
}

run();
