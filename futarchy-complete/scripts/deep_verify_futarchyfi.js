const axios = require("axios");
const fs = require('fs');

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/futarchy-complete/v0.0.12";

async function main() {
    console.log("🔍 Starting Deep Verification for 'FutarchyFi'...\n");

    // 1. Find the Aggregator
    const aggQuery = `
    {
        aggregators(where: {name_contains: "FutarchyFi"}) {
            id
            name
            description
            creator
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

    const aggRes = await axios.post(SUBGRAPH_URL, { query: aggQuery });
    if (aggRes.data.errors) throw new Error(JSON.stringify(aggRes.data.errors));

    const aggregators = aggRes.data.data.aggregators;

    if (aggregators.length === 0) {
        console.error("❌ Aggregator 'FutarchyFi' NOT FOUND.");
        return;
    }

    const agg = aggregators[0];
    console.log(`✅ Found Aggregator: ${agg.name} (${agg.id})`);
    console.log(`   Description: ${agg.description || "NULL/EMPTY"}`);
    console.log(`   Organizations: ${agg.organizations.length}`);

    // 2. Iterate Organizations
    for (const org of agg.organizations) {
        console.log(`\n---------------------------------------------------`);
        console.log(`🏢 Organization: ${org.name} (${org.id})`);
        console.log(`   Proposals Count: ${org.proposals.length}`);

        if (org.proposals.length === 0) {
            console.log(`   ⚠️  No proposals to verify.`);
            continue;
        }

        // 3. Deep Verify Proposals (UnifiedOneStopShop)
        for (const pRef of org.proposals) {
            await verifyProposal(pRef.id);
        }
    }
}

async function verifyProposal(proposalId) {
    const query = `
    {
        unifiedOneStopShop(id: "${proposalId}") {
            id
            title
            marketName
            description
            displayNameEvent
            displayNameQuestion
            resolutionDate
            
            companyToken { id symbol name decimals }
            currencyToken { id symbol name decimals }
            
            poolConditionalYes { id isBaseToken0 currentPrice trades(first: 1) { id } }
            poolConditionalNo { id isBaseToken0 currentPrice trades(first: 1) { id } }
            poolExpectedYes { id isBaseToken0 currentPrice trades(first: 1) { id } }
            poolExpectedNo { id isBaseToken0 currentPrice trades(first: 1) { id } }
            poolPredictionYes { id isBaseToken0 currentPrice trades(first: 1) { id } }
            poolPredictionNo { id isBaseToken0 currentPrice trades(first: 1) { id } }
        }
    }
    `;

    try {
        const res = await axios.post(SUBGRAPH_URL, { query });
        const p = res.data.data.unifiedOneStopShop;

        if (!p) {
            console.log(`   ❌ Proposal ${proposalId} not found in UnifiedOneStopShop Entity! (Unlinked?)`);
            return;
        }

        console.log(`   \n   📄 Proposal: ${p.title}`);
        console.log(`      ID: ${p.id}`);
        console.log(`      MarketName: ${p.marketName}`);

        // Metadata Check
        const metaOk = p.title !== "Loading..." && p.description !== "Loading...";
        console.log(`      Metadata Status: ${metaOk ? "✅ OK" : "⚠️  STUCK LOADING"}`);
        if (!metaOk) console.log(`         (Title: ${p.title} | Desc: ${p.description})`);

        // Token Check
        const tknOk = p.companyToken.symbol !== "UNK" && p.companyToken.symbol !== "TKN"; // "UNK-1234" is acceptable if bytes32 failed but logic ran
        console.log(`      Tokens: ${p.companyToken.symbol} / ${p.currencyToken.symbol} [${tknOk ? "✅" : "⚠️"}]`);

        // Pools Check
        const pools = [
            p.poolConditionalYes, p.poolConditionalNo,
            p.poolExpectedYes, p.poolExpectedNo,
            p.poolPredictionYes, p.poolPredictionNo
        ];

        const validPools = pools.filter(pool => pool !== null);
        const allPoolsOk = validPools.length === 6;

        console.log(`      Pools: ${validPools.length}/6 Linked.`);
        if (!allPoolsOk) {
            console.log(`      ❌ MISSING POOLS!`);
            if (!p.poolConditionalYes) console.log("         - Missing ConditionalYes");
            if (!p.poolConditionalNo) console.log("         - Missing ConditionalNo");
            // ...
        } else {
            console.log(`      ✅ All 6 Pools Linked.`);
            // Verify Trades briefly
            const hasTrades = pools.some(pool => pool.trades && pool.trades.length > 0);
            console.log(`      Trades Detected: ${hasTrades ? "Yes" : "No (Fresh Pools?)"}`);
        }

    } catch (e) {
        console.error(`      ❌ Error verifying proposal ${proposalId}:`, e.message);
    }
}

main().catch(console.error);
