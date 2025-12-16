const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.8";

const TOKEN_ID = "0x241bf1b22bb1f0591301910d7f22ddec2f0f75c3";

const QUERY = `
{
  token: whitelistedToken(id: "${TOKEN_ID}") {
    id
    symbol
    role
    proposal # Should be null
  }
  pools0: pools(where: {token0: "${TOKEN_ID}"}) {
    id
    token0 { symbol id role }
    token1 { symbol id role }
  }
  pools1: pools(where: {token1: "${TOKEN_ID}"}) {
    id
    token0 { symbol id role }
    token1 { symbol id role }
  }
}
`;

async function testSubgraph() {
    console.log("🔍 Querying for token pools...");
    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: QUERY }),
        });
        const result = await response.json();
        console.log(JSON.stringify(result.data, null, 2));
    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

testSubgraph();
