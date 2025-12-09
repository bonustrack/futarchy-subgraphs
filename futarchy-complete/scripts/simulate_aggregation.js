const { ethers } = require("ethers");
const fs = require('fs');

// Config
const RPC_URL = "https://rpc.gnosischain.com";
const AGGREGATOR_ADDR = "0xdc5825b60462F38C41E0d3e7F7e3052148A610EE"; // FutarchyFi
const ALGEBRA_FACTORY_ADDR = "0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766";

// ABIs
const ABI_AGGREGATOR = [
    "function getOrganizations(uint256,uint256) view returns (address[])",
    "function getOrganizationsCount() view returns (uint256)",
    "function aggregatorName() view returns (string)"
];
const ABI_ORG = [
    "function getProposals(uint256,uint256) view returns (address[])",
    "function getProposalsCount() view returns (uint256)",
    "function companyName() view returns (string)"
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
    "function wrappedOutcome(uint256) view returns (address, bytes)"
];
const ABI_ERC20 = [
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];
const ABI_ALGEBRA_FACTORY = ["function poolByPair(address,address) view returns (address)"];
const ABI_POOL = [
    "function globalState() view returns (uint160,int24,uint16,uint8,uint8,uint8,bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
];

const ZERO_ADDRESS = ethers.ZeroAddress;
const Q96 = BigInt("79228162514264337593543950336");

async function main() {
    console.log("🚀 STARTING MANUAL RAM AGGREGATION SIMULATION...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 1. Aggregator
    const aggContract = new ethers.Contract(AGGREGATOR_ADDR, ABI_AGGREGATOR, provider);
    let aggName = "Unknown";
    try { aggName = await aggContract.aggregatorName(); } catch (e) { }

    let orgs = [];
    try {
        const aggCount = await aggContract.getOrganizationsCount();
        console.log(`\n📂 AGGREGATOR: ${aggName} (${AGGREGATOR_ADDR})`);
        console.log(`   └── Count: ${aggCount}`);
        if (aggCount > 0) {
            orgs = await aggContract.getOrganizations(0, Number(aggCount));
        }
    } catch (e) {
        console.error("   ❌ Failed to fetch organizations from Aggregator", e.message);
    }

    for (const orgAddr of orgs) {
        // 2. Organization
        const orgContract = new ethers.Contract(orgAddr, ABI_ORG, provider);
        let orgName = "Unknown Org";
        let proposals = [];

        try {
            orgName = await orgContract.companyName();
            const propCount = await orgContract.getProposalsCount();
            if (propCount > 0) {
                // Fetch in chunks if large, but assuming small for now
                proposals = await orgContract.getProposals(0, Number(propCount));
            }
        } catch (e) {
            console.log(`   ⚠️ Error reading Org ${orgAddr}: ${e.message}`);
            continue;
        }

        console.log(`\n   🏢 ORGANIZATION: ${orgName} (${orgAddr})`);
        console.log(`      └── Found ${proposals.length} Proposals`);

        for (const metaAddr of proposals) {
            // 3. Metadata
            let question = "Error data";
            let tradingAddr = ZERO_ADDRESS;

            try {
                const metaContract = new ethers.Contract(metaAddr, ABI_PROP_META, provider);
                question = await metaContract.displayNameQuestion().catch(e => "Error Fetching Question");
                tradingAddr = await metaContract.proposalAddress().catch(e => ZERO_ADDRESS);
            } catch (e) { }

            if (tradingAddr === ZERO_ADDRESS) {
                console.log(`      ⚠️  Metadata ${metaAddr} has no trading address linked.`);
                continue;
            }

            console.log(`\n      📜 PROPOSAL METADATA (${metaAddr})`);
            console.log(`         ├── Question: "${question}"`);
            console.log(`         └── Trading Contract: ${tradingAddr}`);

            // 4. Trading Logic
            try {
                const tradeContract = new ethers.Contract(tradingAddr, ABI_FUTARCHY_PROP, provider);
                const marketName = await tradeContract.marketName();
                const col1 = await tradeContract.collateralToken1(); // Company Token
                const col2 = await tradeContract.collateralToken2(); // Currency (Quote)

                const t1 = new ethers.Contract(col1, ABI_ERC20, provider);
                const t2 = new ethers.Contract(col2, ABI_ERC20, provider);
                const s1 = await t1.symbol().catch(e => "UNK");
                const s2 = await t2.symbol().catch(e => "UNK");
                const d2 = await t2.decimals().catch(e => 18); // Currency decimals

                console.log(`         ⚡ TRADING DETAILS:`);
                console.log(`            ├── Market: ${marketName}`);
                console.log(`            ├── Company Token: ${s1} (${col1})`);
                console.log(`            └── Currency Token: ${s2} (${col2})`);

                // 5. Pools & Pricing
                const w0_res = await tradeContract.wrappedOutcome(0); // YES_LONG
                const w1_res = await tradeContract.wrappedOutcome(1); // NO_LONG
                const w2_res = await tradeContract.wrappedOutcome(2); // YES_SHORT
                const w3_res = await tradeContract.wrappedOutcome(3); // NO_SHORT

                const wLogic = [
                    { type: "Conditional YES", tA: w0_res[0], tB: w2_res[0], desc: "Pays 1 if YES, 0 if NO (Conditional)" },
                    { type: "Conditional NO", tA: w1_res[0], tB: w3_res[0], desc: "Pays 1 if NO, 0 if YES (Conditional)" },
                    { type: "Expected YES", tA: w0_res[0], tB: col2, desc: "Buys 1 Outcome YES with Currency" },
                    { type: "Expected NO", tA: w1_res[0], tB: col2, desc: "Buys 1 Outcome NO with Currency" },
                    { type: "Prediction YES", tA: w2_res[0], tB: col2, desc: "Prediction YES vs Currency" }, // Verify mapping logic
                    { type: "Prediction NO", tA: w3_res[0], tB: col2, desc: "Prediction NO vs Currency" }
                ];

                const factory = new ethers.Contract(ALGEBRA_FACTORY_ADDR, ABI_ALGEBRA_FACTORY, provider);

                console.log(`            🏊 POOLS & PRICING:`);
                console.log(`            (Showing how much Currency is needed to buy 1 Unit of Outcome)`);

                for (const p of wLogic) {
                    if (p.tA === ZERO_ADDRESS || p.tB === ZERO_ADDRESS) continue;

                    const poolAddr = await factory.poolByPair(p.tA, p.tB);
                    if (poolAddr === ZERO_ADDRESS) {
                        console.log(`               ❌ [${p.type}] Not Created`);
                        continue;
                    }

                    // Fetch Price
                    const poolContract = new ethers.Contract(poolAddr, ABI_POOL, provider);
                    const globalState = await poolContract.globalState();
                    const priceQ96 = globalState[0];

                    const sqrtPriceX96 = BigInt(priceQ96);
                    let price = (Number(sqrtPriceX96) / Number(Q96)) ** 2;

                    // Determine direction
                    const token0 = await poolContract.token0();

                    let label = "";
                    let finalPrice = 0;

                    if (p.type.includes("Expected") || p.type.includes("Prediction")) {
                        if (token0.toLowerCase() === p.tA.toLowerCase()) {
                            // Token0 is Outcome. Token1 is Currency.
                            // Price in pool is T1/T0 => Currency/Outcome.
                            finalPrice = price;
                        } else {
                            // Token0 is Currency. Token1 is Outcome.
                            // Price in pool is T1/T0 => Outcome/Currency.
                            finalPrice = 1 / price;
                        }

                        label = `${finalPrice.toFixed(4)} ${s2} per 1 ${p.type.split(" ")[1]}`;
                    } else {
                        label = `Raw Price: ${price.toFixed(4)}`;
                    }

                    console.log(`               ✅ [${p.type}] ${poolAddr}`);
                    console.log(`                  Logic: ${p.desc}`);
                    if (label) console.log(`                  Price: ${label}`);
                }
            } catch (e) {
                console.log(`         ⚠️ Error reading trading info: ${e.message}`);
            }
        }
    }
}

main().catch(console.error);
