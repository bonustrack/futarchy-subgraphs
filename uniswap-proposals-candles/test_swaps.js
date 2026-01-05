const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.11";

// Query to check Swaps with new fields
const QUERY = `
{
  swaps(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    timestamp
    transactionHash
    origin
    pool { name type }
    tokenIn { symbol }
    tokenOut { symbol }
    amountIn
    amountOut
    price
  }
}
`;

async function testSwaps() {
    console.log("🔍 Verifying Swap Indexing (v0.0.11)...");
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

        if (!result.data || !result.data.swaps) {
            console.error("❌ No data returned.");
            console.log(JSON.stringify(result, null, 2));
            return;
        }

        const swaps = result.data.swaps;
        console.log(`✅ Found ${swaps.length} recent swaps:`);

        const tableData = swaps.map(s => ({
            Time: new Date(parseInt(s.timestamp) * 1000).toISOString().slice(11, 19),
            Pool: s.pool.name,
            Type: s.pool.type,
            User: s.origin.slice(0, 8) + "...",
            Action: `Sell ${s.tokenIn.symbol} -> Buy ${s.tokenOut.symbol}`,
            In: parseFloat(s.amountIn).toFixed(4),
            Out: parseFloat(s.amountOut).toFixed(4),
            Price: parseFloat(s.price).toFixed(6)
        }));

        console.table(tableData);

        // Raw dump of first one for deep check
        if (swaps.length > 0) {
            console.log("\nSample Raw Swap:");
            console.log(swaps[0]);
        }

    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

testSwaps();
