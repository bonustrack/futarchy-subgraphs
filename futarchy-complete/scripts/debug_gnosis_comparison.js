const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = "https://rpc.gnosischain.com";
const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/futarchy-complete/v0.0.15";

const KLEROS_DAO_ID = "0x74bf4a8596a3e271720f8154eaac6017f9ef39ee";
const GNOSIS_DAO_ID = "0xe204584feb4564d3891739e395f6d6198f218247";

// ABIs
const ORGANIZATION_ABI = [
    "function getProposalsCount() view returns (uint256)",
    "function getProposals(uint256 offset, uint256 limit) view returns (address[])",
    "function companyName() view returns (string)"
];

const PROPOSAL_ABI = [
    "function collateralToken1() view returns (address)",
    "function collateralToken2() view returns (address)",
    "function wrappedOutcome(uint256) view returns (address)",
    "function marketName() view returns (string)",
    "function description() view returns (string)"
];

const WRAPPED_TOKEN_ABI = [
    "function getWrapped1155() view returns (address)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log(`Analyzing Gnosis DAO (${GNOSIS_DAO_ID}) vs Kleros DAO (${KLEROS_DAO_ID})...`);

    // 1. Fetch On-Chain Data for Gnosis DAO
    const gnosisOrg = new ethers.Contract(GNOSIS_DAO_ID, ORGANIZATION_ABI, provider);
    const gnosisCount = await gnosisOrg.getProposalsCount();
    console.log(`\nGnosis DAO On-Chain Proposals: ${gnosisCount}`);

    const gnosisProposals = await gnosisOrg.getProposals(0, gnosisCount);

    // Analyze the first few proposals of Gnosis DAO
    console.log("Inspecting Gnosis DAO Proposals (On-Chain):");
    for (let i = 0; i < Math.min(gnosisProposals.length, 3); i++) {
        const propAddr = gnosisProposals[i];
        console.log(`  [${i}] ${propAddr}`);
        try {
            const prop = new ethers.Contract(propAddr, PROPOSAL_ABI, provider);
            const c1 = await prop.collateralToken1();
            const c2 = await prop.collateralToken2();
            const marketName = await prop.marketName();
            console.log(`      Market: ${marketName}`);
            console.log(`      Collateral 1: ${c1}`);
            console.log(`      Collateral 2: ${c2}`);
        } catch (e) {
            console.log(`      Error fetching details: ${e.message}`);
        }
    }

    // 2. Fetch Subgraph Data
    console.log("\nFetching Subgraph Data...");
    const query = `
    {
      gnosis: organization(id: "${GNOSIS_DAO_ID}") {
        name
        proposals {
          id
          title
          poolConditionalYes { id }
        }
      }
      kleros: organization(id: "${KLEROS_DAO_ID}") {
        name
        proposals {
          id
          title
          poolConditionalYes { id }
        }
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

        if (json.errors) {
            console.error("Subgraph Errors:", json.errors);
        } else {
            const gnosisData = json.data.gnosis;
            const klerosData = json.data.kleros;

            console.log(`\nSubgraph Gnosis DAO: ${gnosisData ? gnosisData.name : 'Not Found'}`);
            if (gnosisData) {
                console.log(`  Proposals Indexed: ${gnosisData.proposals.length}`);
                gnosisData.proposals.forEach(p => {
                    console.log(`    - ${p.id}: ${p.title} (Pool: ${p.poolConditionalYes ? 'YES' : 'MISSING'})`);
                });
            }

            console.log(`\nSubgraph Kleros DAO: ${klerosData ? klerosData.name : 'Not Found'}`);
            if (klerosData) {
                console.log(`  Proposals Indexed: ${klerosData.proposals.length}`);
                // Just summary for Kleros as baseline
                const validPools = klerosData.proposals.filter(p => p.poolConditionalYes).length;
                console.log(`    - Proposals with Pools: ${validPools}/${klerosData.proposals.length}`);
            }
        }

    } catch (e) {
        console.error("Error fetching subgraph:", e);
    }
}

main();
