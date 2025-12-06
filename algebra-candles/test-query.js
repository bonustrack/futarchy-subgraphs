// Node 22+ has native fetch, no need to require node-fetch
// const fetch = require('node-fetch'); 

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/algebra-candles/v0.0.1";

const QUERY = `
{
  pool(id: "0x462bb6bb0261b2159b0e3cc763a1499e29afc1F8") {
    id
    lastPrice
    tick
    timestamp
  }
  candles(first: 5, orderBy: periodStartUnix, orderDirection: desc) {
    periodStartUnix
    open
    high
    low
    close
    volumeToken0
  }
}
`;

async function testSubgraph() {
    console.log("🔍 Querying Subgraph...");
    console.log("URL:", SUBGRAPH_URL);

    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: QUERY }),
        });

        const result = await response.json();

        if (result.errors) {
            console.error("❌ GraphQL Errors:", result.errors);
            return;
        }

        if (!result.data) {
            console.error("❌ No data returned!");
            return;
        }

        console.log("✅ Success! Data Received:");
        console.log(JSON.stringify(result.data, null, 2));

    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

// Check if fetch is available globally (Node 18+), else verify node-fetch
if (!globalThis.fetch) {
    console.log("⚠️ Global fetch not found. Please install node-fetch or use Node.js 18+");
    // Attempting to require it simply to show intention, although in this env it might fail if not installed.
    // We will just try to run it.
}

testSubgraph();
