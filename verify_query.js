// Using native fetch
// Node 18+ has native fetch. Let's try native fetch first, if it fails, I'll fallback to https.

async function run() {
    const query = `
    {
        proposals(where: { organization: "0xe204584feb4564d3891739e395f6d6198f218247" }) {
            id
            displayNameQuestion
            description
        }
    }`;

    try {
        const response = await fetch("https://api.studio.thegraph.com/query/1718249/futarchy-aggregator-gnosis/v0.0.7", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });

        const json = await response.json();
        console.log(JSON.stringify(json, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

run();
