// const fetch = require('node-fetch'); // Native fetch in Node 18+

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.13";
const PROPOSAL_ID = "0x9590daf4d5cd4009c3f9767c5e7668175cfd37cf";

async function run() {
    const query = `
    {
        proposal(id: "${PROPOSAL_ID}") {
            marketName
            pools(where: { liquidity_gt: 0 }) {
                id
                name
                type
                token0 { symbol id }
                token1 { symbol id }
                fee
                liquidity
            }
        }
    }`;

    try {
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const { data } = await res.json();

        if (!data.proposal) {
            console.log("Proposal not found");
            return;
        }

        console.log(`Market: ${data.proposal.marketName}`);
        console.log(`Pools Found: ${data.proposal.pools.length}`);

        data.proposal.pools.forEach(p => {
            console.log(`[${p.type}] ${p.name}`);
            console.log(`  ID: ${p.id}`);
            console.log(`  Tokens: ${p.token0.symbol} / ${p.token1.symbol}`);
            console.log(`  Liquidity: ${p.liquidity}`);
            console.log(`  Fee: ${p.fee}`);
            console.log('---');
        });

    } catch (e) {
        console.error(e);
    }
}

run();
