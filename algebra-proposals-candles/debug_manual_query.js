const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.25";

async function run() {
    const query = `
    {
        proposals(first: 1, orderBy: id, orderDirection: desc) {
            id
            marketName
            companyToken { symbol decimals id }
            currencyToken { symbol decimals id }
            outcomeTokens { 
                symbol 
                role 
                decimals 
            }
        }
    }`;

    console.log("Querying v0.0.25 for latest proposal...");

    try {
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const json = await res.json();

        if (json.errors) {
            console.error("Errors:", JSON.stringify(json.errors, null, 2));
            return;
        }

        const p = json.data.proposals[0];
        if (!p) {
            console.log("No proposals found yet (Indexing might be in progress).");
            return;
        }

        console.log("\n=== LATEST PROPOSAL DATA ===");
        console.log(`Market: ${p.marketName}`);
        console.log(`Company Token: ${p.companyToken ? p.companyToken.symbol : 'NULL'}`);
        console.log(`Currency Token: ${p.currencyToken ? p.currencyToken.symbol : 'NULL'}`);
        console.log(`Outcome Tokens: ${p.outcomeTokens.length}`);
        p.outcomeTokens.forEach(t => {
            console.log(` - ${t.role}: ${t.symbol} (${t.decimals})`);
        });
        console.log("============================");

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

run();
