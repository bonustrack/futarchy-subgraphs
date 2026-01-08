const fs = require('fs');

// Trying Deployment ID with Account 1718249
const URL_DEPLOYMENT = "https://api.studio.thegraph.com/query/1718249/uniswap-proposals-candles/id/QmZNePVbYTSSLF9J2fW9k1Yc5j3xNXgLNL78vXkBucfQx8";

async function runQuery(label, url) {
    const logs = [`\n--- Testing: ${label} ---`, `URL: ${url}`];
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: "{ _meta { block { number } } }" }) // Simple query
        });

        if (!res.ok) {
            logs.push(`❌ HTTP Error: ${res.status}`);
            const text = await res.text();
            logs.push(`   Body: ${text}`);
        } else {
            const data = await res.json();
            if (data.errors) {
                logs.push(`❌ Graph Errors: ` + JSON.stringify(data.errors));
            } else {
                logs.push(`✅ Success! Data: ` + JSON.stringify(data));
            }
        }
    } catch (e) {
        logs.push(`❌ Network Error: ${e.message}`);
    }
    console.log(logs.join('\n'));
}

async function main() {
    await runQuery("Deployment ID (1718249)", URL_DEPLOYMENT);
}

main();
