const { ethers } = require('ethers');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/futarchy-complete/v0.0.16";
const GNOSIS_PROPOSAL_ID = "0x9590daf4d5cd4009c3f9767c5e7668175cfd37cf";
const RPC_URL = "https://rpc.gnosischain.com";
const ALGEBRA_FACTORY = "0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766";

const FACTORY_ABI = ["function poolByPair(address, address) view returns (address)"];

async function main() {
    console.log(`Deep Dive: Gnosis Proposal ${GNOSIS_PROPOSAL_ID}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 1. Fetch Subgraph Data
    const query = `
    {
      unifiedOneStopShop(id: "${GNOSIS_PROPOSAL_ID}") {
        title
        companyToken { id symbol }
        currencyToken { id symbol }
        outcomeYesCompany
        outcomeNoCompany
        outcomeYesCurrency
        outcomeNoCurrency
        poolConditionalYes { id }
      }
    }
    `;

    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const json = await response.json();
        const data = json.data.unifiedOneStopShop;

        if (!data) {
            console.log("Proposal NOT found in subgraph!");
            return;
        }

        console.log("Subgraph Data:");
        console.log(`  Title: ${data.title}`);
        console.log(`  Company Token: ${data.companyToken.id} (${data.companyToken.symbol})`);
        console.log(`  Currency Token: ${data.currencyToken.id} (${data.currencyToken.symbol})`);
        console.log(`  Outcome Yes (Company): ${data.outcomeYesCompany}`);
        console.log(`  Outcome Yes (Currency): ${data.outcomeYesCurrency}`);

        const token0 = data.outcomeYesCompany; // w0
        const token1 = data.outcomeYesCurrency; // w2

        if (token0 && token1) {
            console.log(`\nChecking On-Chain Pool for Pair: ${token0} <-> ${token1}`);
            const factory = new ethers.Contract(ALGEBRA_FACTORY, FACTORY_ABI, provider);
            const pool = await factory.poolByPair(token0, token1);
            console.log(`  -> Algebra Factory returned Pool: ${pool}`);

            if (pool === "0x0000000000000000000000000000000000000000") {
                console.log("  [!] Factory has NO pool for these tokens.");
                console.log("      Possible reasons:");
                console.log("      1. These are the wrong tokens (check wrapping?)");
                console.log("      2. The pool was never created (unlikely if market existed)");
                console.log("      3. Tokens need sorting? (Factory handles this, but let's check order)");
                // Factory usually handles sorting but let's be sure
            } else {
                console.log("  [!] Pool EXISTS on chain but is missing in Subgraph?");
                console.log("      If missing in subgraph, it means the 'Pool' event wasn't indexed or the link logic failed.");
            }
        } else {
            console.log("  [!] Missing Outcome Tokens in Subgraph. Heal logic failed to fetch them.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
