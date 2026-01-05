const { ethers } = require("ethers");

// CONFIG
const PROPOSAL_ID = "0x01a863c7fedd7ca99355a017ea1eda219c4c7c48";
const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.25";
const RPC_URL = "https://rpc.gnosischain.com";

// ABI matching (address wrapped1155, bytes data)
const ABI = [
    "function wrappedOutcome(uint256 index) view returns (address, bytes)"
];
const WRAPPER_ABI = [
    "function wrapped1155() view returns (address)"
];

async function run() {
    console.log(`Analyzing Proposal: ${PROPOSAL_ID}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Check if contract exists
    const code = await provider.getCode(PROPOSAL_ID);
    if (code === '0x') {
        console.error("ERROR: No code at PROPOSAL_ID. Is the address correct?");
        return;
    }

    const contract = new ethers.Contract(PROPOSAL_ID, ABI, provider);

    // 1. Fetch Outcome Tokens from Chain
    console.log("1. Fetching On-Chain Outcome Tokens...");
    const outcomeAddresses = [];
    for (let i = 0; i < 4; i++) {
        try {
            // Ethers v6 checks
            // returns Result(2) [ address, bytes ]
            const result = await contract.wrappedOutcome(i);
            const wrapperAddress = result[0];

            console.log(`   [${i}] Outcome Wrapper: ${wrapperAddress}`);

            // The address returned IS the outcome token (Wrapped 1155 or similar)
            // The mapping logic uses this address directly: res.value.getWrapped1155() -> saveToken(address)
            const tokenAddress = wrapperAddress;

            console.log(`   [${i}] Outcome Token: ${tokenAddress}`);
            outcomeAddresses.push(tokenAddress.toLowerCase());

        } catch (e) {
            console.error(`   [${i}] Error fetching from chain:`, e.code || e.message);
            // console.error(e); 
        }
    }

    if (outcomeAddresses.length === 0) {
        console.error("No outcome tokens found on chain. Aborting Subgraph check.");
        return;
    }

    // 2. Check Subgraph for these tokens
    console.log("\n2. Checking Subgraph Entities...");
    const query = `
    {
        tokens: whitelistedTokens(where: { id_in: ${JSON.stringify(outcomeAddresses)} }) {
            id
            symbol
            role
            proposal { id }
        }
        proposal(id: "${PROPOSAL_ID}") {
            id
            outcomeTokens { id }
        }
    }`;

    try {
        const res = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            body: JSON.stringify({ query }),
            headers: { 'Content-Type': 'application/json' }
        });
        const json = await res.json();

        if (json.errors) {
            console.error("GraphQL Errors:", json.errors);
            return;
        }

        const data = json.data;
        console.log("   Subgraph Proposal found:", !!data.proposal);
        if (data.proposal) {
            console.log(`   Linked Outcome Tokens in Subgraph: ${data.proposal.outcomeTokens.length}`);
        }

        console.log("\n   Individual Token Status:");
        outcomeAddresses.forEach(addr => {
            const t = data.tokens.find(x => x.id === addr);
            if (t) {
                console.log(`   [FOUND] ${addr}`);
                console.log(`       Role: ${t.role}`);
                console.log(`       Linked Proposal: ${t.proposal ? t.proposal.id : 'NULL'}`);
            } else {
                console.log(`   [MISSING] ${addr} (Not indexed at all)`);
            }
        });

    } catch (e) {
        console.error("Subgraph Fetch Error:", e);
    }
}

run();
