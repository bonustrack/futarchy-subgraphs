const { ethers } = require("ethers");

// Gnosis RPC
const PROVIDER_URL = "https://rpc.gnosischain.com";
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

// Contract Addresses from User
const ORG_ADDRESS = "0x41727e353ab437396c5f71cc8ec2f12493290263";
const PROPOSAL_ADDRESS = "0x5a77165445191f5dfe99edcd1496725bcb750fd4";

async function main() {
    console.log(`Connecting to ${PROVIDER_URL}...`);

    // 1. Check Organization
    console.log(`\nChecking Organization: ${ORG_ADDRESS}`);
    const orgCode = await provider.getCode(ORG_ADDRESS);
    if (orgCode === "0x") {
        console.error("❌ Organization Contract NOT found (no code at address)");
    } else {
        console.log("✅ Organization Contract code found!");
        // Try to read metadata if possible (using minimal ABI)
        try {
            const abi = ["function companyName() view returns (string)", "function owner() view returns (address)"];
            const contract = new ethers.Contract(ORG_ADDRESS, abi, provider);
            const name = await contract.companyName();
            const owner = await contract.owner();
            console.log(`   - Name: ${name}`);
            console.log(`   - Owner: ${owner}`);
        } catch (e) {
            console.log("   - Could not read details (ABI mismatch?):", e.message);
        }
    }

    // 2. Check Proposal
    console.log(`\nChecking Proposal: ${PROPOSAL_ADDRESS}`);
    const propCode = await provider.getCode(PROPOSAL_ADDRESS);
    if (propCode === "0x") {
        console.error("❌ Proposal Contract NOT found (no code at address)");
    } else {
        console.log("✅ Proposal Contract code found!");
        try {
            const abi = [
                "function displayNameQuestion() view returns (string)",
                "function proposalAddress() view returns (address)"
            ];
            const contract = new ethers.Contract(PROPOSAL_ADDRESS, abi, provider);
            const question = await contract.displayNameQuestion();
            const tradingAddr = await contract.proposalAddress();
            console.log(`   - Question: ${question}`);
            console.log(`   - Trading Contract: ${tradingAddr}`);
        } catch (e) {
            console.log("   - Could not read details:", e.message);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
