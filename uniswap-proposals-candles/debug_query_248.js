const fs = require('fs');

// USER SUGGESTED ID: 1718248 (instead of 1718249)
const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718248/uniswap-proposals-candles/v0.0.1";

async function runQuery(label, query, logs) {
    logs.push(`\n--- Testing: ${label} ---`);
    try {
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

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

const QUERY = `{ proposals(first: 1) { id } }`;

async function main() {
    const logs = [];
    logs.push(`Target URL: ${SUBGRAPH_URL}`);
    await runQuery("Test ID 1718248", QUERY, logs);

    fs.writeFileSync('debug_result_248.json', logs.join('\n'));
}

main();
