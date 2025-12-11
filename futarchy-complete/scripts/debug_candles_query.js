const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const CANDLES_URL = "https://api.studio.thegraph.com/query/1718249/algebra-candles/v0.0.1";
const REGISTRY_URL = "https://api.studio.thegraph.com/query/1718249/futarchy-complete/v0.0.21";
const PROPOSAL_ID = "0x7e9fc0c3d6c1619d4914556ad2dee6051ce68418"; // Gnosis proposal

async function run() {
    console.log("1. Fetching Pool ID from Registry (v0.0.21)...");
    const regQuery = `{
        unifiedOneStopShop(id: "${PROPOSAL_ID}") {
            id
            poolConditionalYes { id }
        }
    }`;

    const regRes = await fetch(REGISTRY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: regQuery })
    });
    const regJson = await regRes.json();
    console.log("Registry Result:", JSON.stringify(regJson, null, 2));

    if (!regJson.data?.unifiedOneStopShop?.poolConditionalYes?.id) {
        console.error("Pool Conditional YES not found in Registry!");
        return;
    }

    const poolId = regJson.data.unifiedOneStopShop.poolConditionalYes.id;
    console.log(`\n2. Querying Candles for Pool: ${poolId} from Algebra Candles (v0.0.1)...`);

    const candleQuery = `{
        candles(where: { pool: "${poolId}" }, first: 5) {
            id
            time
            close
        }
        trades(where: { pool: "${poolId}" }, first: 5) {
            id
            price
            timestamp
        }
        pool(id: "${poolId}") {
            id
            totalVolume
        }
    }`;

    const candleRes = await fetch(CANDLES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: candleQuery })
    });
    const candleJson = await candleRes.json();
    console.log("Candles Result:", JSON.stringify(candleJson, null, 2));
}

run();
