const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.10";

// Query to check the new 'name' and 'type' fields
const QUERY = `
{
  pools(first: 10, orderBy: id, orderDirection: desc) {
    id
    name
    type
    token0 { symbol role }
    token1 { symbol role }
  }
}
`;

async function testSubgraph() {
    console.log("🔍 Verifying Pool Classification...");
    console.log("URL:", SUBGRAPH_URL);

    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: QUERY }),
        });

        const result = await response.json();

        if (result.errors) {
            console.error("❌ GraphQL Errors:", JSON.stringify(result.errors, null, 2));
            return;
        }

        if (!result.data || !result.data.pools) {
            console.error("❌ No data returned.");
            return;
        }

        console.log("✅ Data Received:");
        console.table(result.data.pools.map(p => ({
            id: p.id.slice(0, 8) + "...",
            name: p.name,
            type: p.type,
            t0: p.token0.symbol,
            t1: p.token1.symbol
        })));

    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

testSubgraph();
