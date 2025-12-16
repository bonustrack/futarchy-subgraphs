// Used built-in fetch
// const fetch = require('node-fetch');

const ENDPOINT = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.6";

const query = `
query {
  proposals(first: 5, orderBy: id, orderDirection: desc) {
    id
    pools {
      id
      token0 { symbol role }
      token1 { symbol role }
      isInverted
      candles(first: 1) { open }
    }
  }
}
`;

async function main() {
  console.log("Querying subgraph...");
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    if (data.errors) {
      console.error("GraphQL Errors:", JSON.stringify(data.errors, null, 2));
      return;
    }

    const proposals = data.data.proposals;
    console.log(`Found ${proposals.length} proposals.`);

    proposals.forEach(p => {
      console.log(`\nProposal: ${p.id}`);
      console.log(`  Pools: ${p.pools.length}`);
      p.pools.forEach(pool => {
        console.log(`    - Pool ${pool.id} [${pool.token0.symbol}/${pool.token1.symbol}] Inv: ${pool.isInverted}`);
      });
    });

  } catch (error) {
    console.error("Execution Error:", error);
  }
}

main();
