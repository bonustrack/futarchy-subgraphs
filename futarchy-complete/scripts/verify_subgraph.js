const axios = require('axios');
const fs = require('fs');

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/futarchy-complete/0.0.6";

const QUERY = `
{
  aggregators(first: 100) {
    id
    name
    description
    organizations {
      id
      name
      proposals {
        id
        title
        marketName
        companyToken {
          id
          symbol
          decimals
        }
        currencyToken {
          id
          symbol
        }
        poolConditionalYes { id currentPrice }
        poolConditionalNo { id currentPrice }
        poolExpectedYes { id currentPrice }
        poolExpectedNo { id currentPrice }
        poolPredictionYes { id currentPrice }
        poolPredictionNo { id currentPrice }
      }
    }
  }
}
`;

async function verify() {
    console.log(`🔍 Verifying Subgraph at: ${SUBGRAPH_URL}`);

    try {
        const response = await axios.post(SUBGRAPH_URL, { query: QUERY });

        if (response.data.errors) {
            console.error("❌ GraphQL Errors:", JSON.stringify(response.data.errors, null, 2));
            return;
        }

        const data = response.data.data;
        const aggregators = data.aggregators;

        console.log(`✅ Found ${aggregators.length} Aggregators`);

        let totalProposals = 0;
        let incompleteProposals = 0;
        let missingPools = 0;

        aggregators.forEach(agg => {
            console.log(`\n📂 Aggregator: ${agg.name} (${agg.organizations.length} Organizations)`);

            agg.organizations.forEach(org => {
                // Only log organizations if they have proposals or if we want verbose output
                if (org.proposals.length > 0) {
                    console.log(`  🏢 Organization: ${org.name} (${org.proposals.length} Proposals)`);

                    org.proposals.forEach(prop => {
                        totalProposals++;
                        let issues = [];

                        // Check Tokens (Should not be zero address)
                        if (prop.companyToken.id === "0x0000000000000000000000000000000000000000") issues.push("Missing Company Token");
                        if (prop.currencyToken.id === "0x0000000000000000000000000000000000000000") issues.push("Missing Currency Token");

                        // Check Pools (Should not be null)
                        if (!prop.poolConditionalYes) issues.push("Missing Pool: Conditional Yes");
                        if (!prop.poolConditionalNo) issues.push("Missing Pool: Conditional No");

                        if (issues.length > 0) {
                            incompleteProposals++;
                            missingPools += issues.filter(i => i.includes("Pool")).length;
                            console.log(`    ⚠️  Proposal [${prop.title || "No Title"}] (${prop.id.slice(0, 10)}...)`);
                            issues.forEach(issue => console.log(`      - ${issue}`));
                        } else {
                            console.log(`    ✅ Proposal [${prop.title || prop.marketName}] - Complete`);
                        }
                    });
                }
            });
        });

        console.log("\n========================================");
        console.log("📊 SUMMARY");
        console.log("========================================");
        console.log(`Total Proposals:      ${totalProposals}`);
        console.log(`Complete Proposals:   ${totalProposals - incompleteProposals}`);
        console.log(`Incomplete Proposals: ${incompleteProposals}`);
        console.log(`Total Missing Pools:  ${missingPools}`);

    } catch (error) {
        console.error("❌ Request Failed:", error.message);
    }
}

verify();
