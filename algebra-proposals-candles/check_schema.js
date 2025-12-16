const ENDPOINT = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.5";

const query = `
query Introspection {
  __schema {
    queryType {
      fields {
        name
      }
    }
    types {
      name
      kind
    }
  }
}
`;

async function main() {
    console.log("Introspecting schema...");
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

        const fields = data.data.__schema.queryType.fields.map(f => f.name);
        console.log("Available Query Fields:", fields.join(", "));

        const types = data.data.__schema.types.map(t => t.name);
        const hasProposal = types.includes("Proposal");
        console.log("Has 'Proposal' Type:", hasProposal);

    } catch (error) {
        console.error("Execution Error:", error);
    }
}

main();
