const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.9";
const PROPOSAL_ID = "0x3d076d5d12341226527241f8a489d4a8863b73e5";

const QUERY = `
{
  proposal(id: "${PROPOSAL_ID}") {
    id
    pools {
      id
      token0 {
        id
        symbol
        role
      }
      token1 {
        id
        symbol
        role
      }
      fee
      liquidity
      sqrtPrice
      tick
    }
  }
}
`;

async function main() {
    console.log(`🔍 Querying Proposal: ${PROPOSAL_ID}`);
    console.log(`🌐 URL: ${SUBGRAPH_URL}`);

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

        if (!result.data || !result.data.proposal) {
            console.error("❌ Proposal not found or no data returned.");
            return;
        }

        console.log("✅ Data Received:");
        console.log(JSON.stringify(result.data, null, 2));

    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

main();
