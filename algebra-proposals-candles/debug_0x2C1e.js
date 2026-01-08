

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718248/algebra-proposals-candles/0.0.6';
const ID = '0x2C1e08674f3F78f8a1426a41C41B8BF546fA481a'.toLowerCase();

const query = `
  query CheckEntity($id: ID!) {
    proposal(id: $id) {
      id
      title
      creator
      collateralToken { id symbol }
    }
    pool(id: $id) {
      id
      token0 { id symbol }
      token1 { id symbol }
      proposal { id }
    }
    token(id: $id) {
      id
      symbol
      name
    }
    whitelistedToken(id: $id) {
      id
      symbol
    }
  }
`;

async function main() {
    console.log(`Checking ID: ${ID} on ${SUBGRAPH_URL}`);

    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                variables: { id: ID }
            }),
        });

        const result = await response.json();

        if (result.errors) {
            console.error('GraphQL Errors:', result.errors);
            return;
        }

        console.log(JSON.stringify(result.data, null, 2));

    } catch (error) {
        console.error('Network Error:', error);
    }
}

main();
