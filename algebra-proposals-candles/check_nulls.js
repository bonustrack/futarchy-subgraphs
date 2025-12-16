const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.8";

const QUERY = `
{
  whitelistedTokens(first: 20) {
    id
    symbol
    role
    proposal
  }
  proposals(first: 5) {
    id
    pools {
      id
    }
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

        console.log("✅ Data Received:");
        console.log(JSON.stringify(result.data, null, 2));

    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

testSubgraph();
