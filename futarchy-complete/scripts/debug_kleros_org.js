const { ethers } = require("ethers");

const RPC_URL = "https://rpc.gnosischain.com";
const ORG_ADDR = "0x74bf4a8596a3e271720f8154eaac6017f9ef39ee"; // Kleros DAO

const ABI_ORG = [
    "function getProposals(uint256,uint256) view returns (address[])", 
    "function getProposalsCount() view returns (uint256)",
    "function companyName() view returns (string)"
];

const ABI_PROP_META = [
    "function proposalAddress() view returns (address)", 
    "function displayNameQuestion() view returns (string)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const org = new ethers.Contract(ORG_ADDR, ABI_ORG, provider);

    console.log(`🔍 inspecting Kleros DAO: ${ORG_ADDR}`);
    
    // 1. Basic Info
    const name = await org.companyName();
    const count = await org.getProposalsCount();
    console.log(`   Name: ${name}`);
    console.log(`   Proposals Count (On-Chain): ${count}`);

    if (count > 0) {
        const proposals = await org.getProposals(0, Number(count));
        for (const meta of proposals) {
            console.log(`\n   📄 Metadata: ${meta}`);
            
            // Check Block Number if possible (needs filtering logs or just assuming)
            // We'll check the proposal linked
            const metaContract = new ethers.Contract(meta, ABI_PROP_META, provider);
            try {
                const tradingAddr = await metaContract.proposalAddress();
                console.log(`      Linked to Trading Proposal: ${tradingAddr}`);
                
                // Get creation block of the Metadata contract?
                // Easier to check 'ProposalAdded' event logs on the Org
                const logs = await provider.getLogs({
                    address: ORG_ADDR,
                    topics: [
                        ethers.id("ProposalAdded(address)")
                        // Note: Depending on standard, it might be indexed or not. 
                        // Our ABI says: event ProposalAdded(address indexed proposalMetadata);
                        // So topic 1 is the metadata address.
                    ],
                    fromBlock: 0,
                    toBlock: "latest"
                });
                
                // Find log for this meta
                const log = logs.find(l => {
                    // indexed arg is in topics[1] padded
                    return l.topics[1].toLowerCase() === ethers.zeroPadValue(meta, 32).toLowerCase();
                });
                
                if (log) {
                    console.log(`      📅 ProposalAdded Block: ${log.blockNumber}`);
                    if (log.blockNumber < 42900000) {
                        console.log(`      ⚠️  TOO OLD! Before StartBlock 42,900,000`);
                    } else {
                        console.log(`      ✅  Within Range (After 42,900,000)`);
                    }
                } else {
                    console.log(`      ⚠️  Could not find creation event log?`);
                }

            } catch (e) {
                console.log(`      ❌ Error reading metadata: ${e.message}`);
            }
        }
    }
}

main().catch(console.error);
