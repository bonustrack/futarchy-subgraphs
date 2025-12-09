const { ethers } = require("ethers");

const RPC_URL = "https://rpc.gnosischain.com";
const PROP_ADDR = "0x2c1e08674f3f78f8a1426a41c41b8bf546fa481a"; // Kleros Proposal from screenshot

const ABI_PROP = [
    {
        "inputs": [{ "name": "index", "type": "uint256" }],
        "name": "wrappedOutcome",
        "outputs": [
            { "name": "wrapped1155", "type": "address" },
            { "name": "data", "type": "bytes" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    // Add older variants just in case?
    "function collateralToken1() view returns (address)",
    "function collateralToken2() view returns (address)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(PROP_ADDR, ABI_PROP, provider);

    console.log(`🔍 Inspecting Proposal: ${PROP_ADDR}`);
    console.log(`   (Checking wrappedOutcome calls...)`);

    try {
        const c1 = await contract.collateralToken1();
        console.log(`   Collateral 1: ${c1}`);
    } catch (e) {
        console.log(`   ❌ Collateral 1 failed: ${e.message}`);
    }

    // Try indices 0 to 3
    for (let i = 0; i < 4; i++) {
        try {
            console.log(`\n   --- Index ${i} ---`);
            const res = await contract.wrappedOutcome(i);
            // res is likely [address, bytes]
            console.log(`   ✅ Success!`);
            console.log(`      Address: ${res[0]}`);
            console.log(`      Data: ${res[1]}`);
        } catch (e) {
            console.log(`   ❌ Index ${i} failed: ${e.message}`);
            // Try explicit call with raw calldata if needed?
        }
    }
}

main().catch(console.error);
