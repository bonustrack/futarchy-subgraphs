const { ethers } = require("ethers");

const RPC_URL = "https://rpc.gnosischain.com";

// Contracts to check
const CONTRACTS = [
    { name: "Aggregator (FutarchyFi)", address: "0xdc5890e7195420dc99320ae6c596cc6840dada7f" }, // Replace with actual ID if different
    { name: "Organization (Kleros DAO)", address: "0x74bf4a8596a3e271720f8154eaac6017f9ef39ee" },
    { name: "Organization (Gnosis DAO)", address: "0xe204584feb4564d3891739e395f6d6198f218247" }
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log("🔍 Checking Creation Blocks...");

    for (const c of CONTRACTS) {
        // Simple binary search could be used, or getting code at block.
        // But reliable way is to scan logs? Or get transaction count 0?
        // Easiest: getCode at current block (verify exists), then binary search
        // OR: Look for it in the event logs of its parent (Factory/Creator).

        // Since we don't have the parent handy for all, let's use a quick binary search for code existence.
        // It's "good enough" to know if it existed before 42,900,000.

        const existsNow = await provider.getCode(c.address);
        if (existsNow === "0x") {
            console.log(`❌ ${c.name}: Does not exist at HEAD!`);
            continue;
        }

        const isBefore = await hasCodeAt(provider, c.address, 42900000);
        console.log(`   ${c.name} (${c.address})`);
        console.log(`      Created BEFORE 42,900,000? ${isBefore ? "YES (Problem!)" : "NO (Safe)"}`);

        if (isBefore) {
            // Find roughly when
            // let start = 0; let end = 42900000;
            // ... (implement binary search if needed, but YES is enough to prove the bug)
        }
    }
}

async function hasCodeAt(provider, address, block) {
    try {
        const code = await provider.getCode(address, block);
        return code !== "0x";
    } catch (e) {
        console.log("Error fetching code: " + e.message);
        return false;
    }
}

main().catch(console.error);
