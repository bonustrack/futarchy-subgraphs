const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.25";

async function run() {
    const query = `
    {
        p1: proposal(id: "0x01a863c7fedd7ca99355a017ea1eda219c4c7c48") {
            id
            marketName
            outcomeTokens { id role }
        }
        p2: proposal(id: "0x9590daf4d5cd4009c3f9767c5e7668175cfd37cf") {
            id
            marketName
            outcomeTokens { id role }
        }
    }`;

    console.log("Querying v0.0.25 to compare proposals...");

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

        const p1 = json.data.p1;
        const p2 = json.data.p2;

        console.log("\n=== PROPOSAL COMPARISON ===");
        if (p1) {
            console.log(`[Target] ${p1.id} - ${p1.marketName}`);
            console.log(`Outcomes: ${p1.outcomeTokens.length}`);
        } else {
            console.log("[Target] 0x01a8... NOT FOUND");
        }

        if (p2) {
            console.log(`[Conflicting] ${p2.id} - ${p2.marketName}`);
            console.log(`Outcomes: ${p2.outcomeTokens.length}`);
        } else {
            console.log("[Conflicting] 0x9590... NOT FOUND");
        }
        console.log("===========================");

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

run();
