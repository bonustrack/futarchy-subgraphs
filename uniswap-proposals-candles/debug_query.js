const fs = require('fs');

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/uniswap-proposals-candles/v0.0.1";

async function runQuery(label, query, logs) {
    logs.push(`\n--- Testing: ${label} ---`);
    try {
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        // Check HTTP status first
        if (!res.ok) {
            logs.push(`❌ HTTP Error: ${res.status}`);
            const text = await res.text();
            logs.push(`   Body: ${text}`);
            return;
        }

        const data = await res.json();
        if (data.errors) {
            logs.push("❌ Graph Errors: " + JSON.stringify(data.errors, null, 2));
        } else {
            logs.push("✅ Success!");
            logs.push(JSON.stringify(data.data, null, 2));
        }
    } catch (e) {
        logs.push(`❌ Network/Fetch Error: ${e.message}`);
    }
}

const FAILING_QUERY = `
{
    proposals(first: 5, orderBy: id, orderDirection: desc) {
        id
        marketName
        pools(where: { liquidity_gt: 0 }) {
            id
        }
    }
}
`;

const WORKING_QUERY = `
{
    proposals(first: 5) {
        id
        marketName
    }
}
`;

async function main() {
    const logs = [];
    logs.push(`Target URL: ${SUBGRAPH_URL}`);
    await runQuery("Simple Query", WORKING_QUERY, logs);
    await runQuery("Failing Query", FAILING_QUERY, logs);

    fs.writeFileSync('debug_result.json', logs.join('\n'));
}

main();
