const { ethers } = require("ethers");
const axios = require("axios");
const fs = require('fs');

// Configuration
const RPC_URL = "https://rpc.gnosischain.com";
const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/futarchy-complete/0.0.6";
const AGGREGATOR_ADDRESS = "0xdc5825b60462F38C41E0d3e7F7e3052148A610EE";

// ABIs
const AGGREGATOR_ABI = [
    "function getOrganizations(uint256 offset, uint256 limit) view returns (address[])",
    "function aggregatorName() view returns (string)",
    "function description() view returns (string)"
];

const ORGANIZATION_ABI = [
    "function getProposals(uint256 offset, uint256 limit) view returns (address[])",
    "function getProposalsCount() view returns (uint256)",
    "function companyName() view returns (string)"
];

const PROPOSAL_METADATA_ABI = [
    "function proposalAddress() view returns (address)",
    "function displayNameQuestion() view returns (string)",
    "function displayNameEvent() view returns (string)"
];

let logs = "";
function log(msg, ...args) {
    console.log(msg, ...args);
    // basic serialization for args
    const serializedArgs = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(" ");
    logs += msg + " " + serializedArgs + "\n";
}

async function main() {
    log("🔍 Starting Comparison: Chain vs Subgraph...");

    // 1. Connect to Chain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const aggregatorContract = new ethers.Contract(AGGREGATOR_ADDRESS, AGGREGATOR_ABI, provider);

    // 2. Fetch Aggregator Data (Chain)
    log(`\n🔗 [CHAIN] Fetching Aggregator: ${AGGREGATOR_ADDRESS}`);
    const orgAddresses = await aggregatorContract.getOrganizations(0, 50);
    log(`   Found ${orgAddresses.length} Organizations on-chain.`);

    // 3. Fetch Subgraph Data
    log(`\n🌐 [SUBGRAPH] Querying Subgraph...`);
    const subgraphData = await fetchSubgraphData(AGGREGATOR_ADDRESS);

    // 4. Compare Organizations
    for (const orgAddr of orgAddresses) {
        log(`\n---------------------------------------------------`);
        log(`🏢 Organization: ${orgAddr}`);

        // Chain Data
        const orgContract = new ethers.Contract(orgAddr, ORGANIZATION_ABI, provider);
        const name = await orgContract.companyName();
        const count = await orgContract.getProposalsCount();
        const countNum = Number(count);

        // Fetch proposals
        let proposalMetadataAddresses = [];
        if (countNum > 0) {
            proposalMetadataAddresses = await orgContract.getProposals(0, countNum);
        }

        log(`   [CHAIN] Name: "${name}" | Proposal Count: ${countNum}`);
        log(`   [CHAIN] Metadata Addresses:`, proposalMetadataAddresses);

        // Subgraph Data
        const subOrg = subgraphData.organizations.find(o => o.id.toLowerCase() === orgAddr.toLowerCase());

        if (!subOrg) {
            log(`   ❌ [SUBGRAPH] Organization NOT FOUND!`);
        } else {
            log(`   [SUBGRAPH] Name: "${subOrg.name}" | Proposal Count: ${subOrg.proposals.length}`);

            // Compare Proposals
            const subProposals = subOrg.proposals.map(p => p.id.toLowerCase()); // These are TRADING addresses in subgraph

            log(`   [SUBGRAPH] Trading Addresses:`, subProposals);

            // Check if Chain Metadata -> Trading Address matches Subgraph
            for (const metaAddr of proposalMetadataAddresses) {
                try {
                    const metaContract = new ethers.Contract(metaAddr, PROPOSAL_METADATA_ABI, provider);
                    const tradingAddr = await metaContract.proposalAddress();

                    const found = subProposals.includes(tradingAddr.toLowerCase());
                    const status = found ? "✅ OK" : "❌ MISSING IN SUBGRAPH";

                    log(`      - Metadata: ${metaAddr} -> Trading: ${tradingAddr} [${status}]`);

                    if (!found) {
                        const deepCheck = await checkProposalInSubgraph(tradingAddr);
                        if (deepCheck) {
                            log(`        ⚠️  Exist in Subgraph but UNLINKED? Org: ${deepCheck.organization ? deepCheck.organization.id : "NULL"}`);
                        } else {
                            log(`        💀  Does NOT exist in Subgraph at all.`);
                        }
                    }

                } catch (e) {
                    log(`      ⚠️  Error fetching proposal details for ${metaAddr}: ${e.message}`);
                }
            }
        }
    }
    fs.writeFileSync("chain_comparison.txt", logs);
}

async function fetchSubgraphData(aggregatorId) {
    const query = `
    {
        aggregators(where: {id: "${aggregatorId.toLowerCase()}"}) {
            id
            organizations {
                id
                name
                proposals {
                    id
                }
            }
        }
    }
    `;
    const res = await axios.post(SUBGRAPH_URL, { query });
    if (res.data.errors) throw new Error(JSON.stringify(res.data.errors));
    return res.data.data.aggregators[0] || { organizations: [] };
}

async function checkProposalInSubgraph(proposalId) {
    const query = `
    {
        unifiedOneStopShop(id: "${proposalId.toLowerCase()}") {
            id
            organization { id }
        }
    }
    `;
    const res = await axios.post(SUBGRAPH_URL, { query });
    return res.data.data.unifiedOneStopShop;
}

main().catch(console.error);
