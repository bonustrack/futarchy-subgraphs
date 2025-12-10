const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/futarchy-complete/v0.0.16";

async function main() {
    const query = `{ _meta { block { number } deployment } }`;
    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const json = await response.json();
        console.log(JSON.stringify(json, null, 2));
    } catch (e) {
        console.error(e);
    }
}
main();
