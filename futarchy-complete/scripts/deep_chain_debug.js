const { ethers } = require("ethers");
const axios = require("axios");
const fs = require('fs');

// Config
const RPC_URL = "https://rpc.gnosischain.com";
const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/futarchy-complete/v0.0.7";

// Spec Targets
const AGGREGATOR_ADDR = "0xdc5825b60462F38C41E0d3e7F7e3052148A610EE";
const ORG_ADDR = "0xe204584Feb4564d3891739E395F6d6198F218247"; // GNOSIS DAO
const PROPOSAL_META_ADDR = "0xA62c418D49dd955df13C92F6939E1ebc09227077";

// ABIs
const ABI_AGGREGATOR = ["function getOrganizations(uint256,uint256) view returns (address[])"];
const ABI_ORG = [
    "function getProposals(uint256,uint256) view returns (address[])",
    "function getProposalsCount() view returns (uint256)"
];
const ABI_PROP_META = [
    "function proposalAddress() view returns (address)",
    "function displayNameQuestion() view returns (string)",
    "function displayNameEvent() view returns (string)"
];
const ABI_FUTARCHY_PROP = [
    "function marketName() view returns (string)",
    "function collateralToken1() view returns (address)",
    "function collateralToken2() view returns (address)",
    "function wrappedOutcome(uint256) view returns (address, bytes)" // wrapped1155, data
];
const ABI_ERC20 = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];
const ABI_ALGEBRA_FACTORY = ["function poolByPair(address,address) view returns (address)"];

const ALGEBRA_FACTORY_ADDR = "0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766";
const ZERO_ADDRESS = ethers.ZeroAddress;

let logs = "";
function log(msg) {
    console.log(msg);
    logs += msg + "\n";
}

async function main() {
    log("🔬 STARTING DEEP CHAIN INVESTIGATION 🔬\n");

    // Providers
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 1. Verify Organization Linking
    log(`--- 1. Checking Organization ${ORG_ADDR} ---`);
    const aggContract = new ethers.Contract(AGGREGATOR_ADDR, ABI_AGGREGATOR, provider);
    // Optimization: Just check if Org is in the list? We assume yes.

    const orgContract = new ethers.Contract(ORG_ADDR, ABI_ORG, provider);
    const count = await orgContract.getProposalsCount();
    log(`[CHAIN] Proposal Count: ${count}`);

    const proposals = await orgContract.getProposals(0, count);
    const found = proposals.find(p => p.toLowerCase() === PROPOSAL_META_ADDR.toLowerCase());
    log(`[CHAIN] Metadata Address ${PROPOSAL_META_ADDR} in list? ${found ? "YES" : "NO"}`);

    // 2. Metadata -> Trading Address
    log(`\n--- 2. Checking Metadata ${PROPOSAL_META_ADDR} ---`);
    const metaContract = new ethers.Contract(PROPOSAL_META_ADDR, ABI_PROP_META, provider);
    const tradingAddr = await metaContract.proposalAddress();
    log(`[CHAIN] Trading Address: ${tradingAddr}`);

    const metaQuestion = await metaContract.displayNameQuestion().catch(() => "ERR");
    const metaEvent = await metaContract.displayNameEvent().catch(() => "ERR");
    log(`[CHAIN] Meta Question: "${metaQuestion}"`);
    log(`[CHAIN] Meta Event: "${metaEvent}"`);

    // 3. Trading Contract Details
    log(`\n--- 3. Checking Trading Contract ${tradingAddr} ---`);
    const tradeContract = new ethers.Contract(tradingAddr, ABI_FUTARCHY_PROP, provider);

    const marketName = await tradeContract.marketName().catch(() => "ERR_MARKET_NAME");
    log(`[CHAIN] Market Name: "${marketName}"`);

    const col1 = await tradeContract.collateralToken1();
    const col2 = await tradeContract.collateralToken2();
    log(`[CHAIN] Col1: ${col1}`);
    log(`[CHAIN] Col2: ${col2}`);

    // Check Tokens
    const t1 = new ethers.Contract(col1, ABI_ERC20, provider);
    const s1 = await t1.symbol().catch(() => "UNK");
    const t2 = new ethers.Contract(col2, ABI_ERC20, provider);
    const s2 = await t2.symbol().catch(() => "UNK");
    log(`[CHAIN] Token Symbols: ${s1} / ${s2}`);

    // 4. Wrapped Outcomes & Pools
    log(`\n--- 4. Checking Pools (Algebra Logic) ---`);
    const w0_res = await tradeContract.wrappedOutcome(0);
    const w1_res = await tradeContract.wrappedOutcome(1);
    const w2_res = await tradeContract.wrappedOutcome(2);
    const w3_res = await tradeContract.wrappedOutcome(3);

    const w0 = w0_res[0]; // Is this right? ABI returns (address, bytes)
    const w1 = w1_res[0];
    const w2 = w2_res[0];
    const w3 = w3_res[0];

    log(`[CHAIN] Wrapped Outcomes: [${w0}, ${w1}, ${w2}, ${w3}]`);

    const factory = new ethers.Contract(ALGEBRA_FACTORY_ADDR, ABI_ALGEBRA_FACTORY, provider);

    // Calculate expected pools (Logic from mapping.ts)
    // ConditionalYes: w0 / w2
    // ConditionalNo: w1 / w3
    // ExpectedYes: w0 / col2 (Currency)
    // ExpectedNo: w1 / col2
    // PredictionYes: w2 / col2
    // PredictionNo: w3 / col2

    await checkPool(factory, "ConditionalYes", w0, w2);
    await checkPool(factory, "ConditionalNo", w1, w3);
    await checkPool(factory, "ExpectedYes", w0, col2);
    await checkPool(factory, "ExpectedNo", w1, col2);
    await checkPool(factory, "PredictionYes", w2, col2);
    await checkPool(factory, "PredictionNo", w3, col2);

    // 5. Compare with Subgraph
    log(`\n--- 5. Subgraph Comparison ---`);
    const sgData = await fetchSubgraphProposal(tradingAddr);

    if (!sgData) {
        log(`❌ SUBGRAPH: UnifiedOneStopShop Entity NOT FOUND for ID ${tradingAddr.toLowerCase()}`);
    } else {
        log(`✅ SUBGRAPH: Found Entity!`);
        log(`   - Title: "${sgData.title}"`);
        log(`   - MarketName: "${sgData.marketName}"`);
        log(`   - Tokens: ${sgData.companyToken.symbol}/${sgData.currencyToken.symbol}`);
        log(`   - Org: ${sgData.organization ? sgData.organization.id : "NULL"}`);
        log(`   - All Pools Linked? ${checkPoolsLinked(sgData)}`);
    }

    fs.writeFileSync("deep_debug_log.txt", logs);
}

async function checkPool(factory, label, tA, tB) {
    if (tA === ZERO_ADDRESS || tB === ZERO_ADDRESS) {
        log(`   [${label}] Skipped (Zero Address)`);
        return;
    }
    const pool = await factory.poolByPair(tA, tB);
    log(`   [${label}] Pair ${tA.slice(0, 6)}/${tB.slice(0, 6)} -> Pool: ${pool === ZERO_ADDRESS ? "NONE" : pool}`);
}

async function fetchSubgraphProposal(id) {
    const query = `
    {
        unifiedOneStopShop(id: "${id.toLowerCase()}") {
            id
            title
            marketName
            organization { id }
            companyToken { symbol }
            currencyToken { symbol }
            poolConditionalYes { id }
            poolConditionalNo { id }
            poolExpectedYes { id }
            poolExpectedNo { id }
            poolPredictionYes { id }
            poolPredictionNo { id }
        }
    }
    `;
    const res = await axios.post(SUBGRAPH_URL, { query });
    if (res.data.errors) {
        log(`SUBGRAPH ERROR: ${JSON.stringify(res.data.errors)}`);
        return null;
    }
    return res.data.data.unifiedOneStopShop;
}

function checkPoolsLinked(p) {
    return !!(p.poolConditionalYes && p.poolConditionalNo && p.poolExpectedYes && p.poolExpectedNo && p.poolPredictionYes && p.poolPredictionNo);
}

main().catch(console.error);
