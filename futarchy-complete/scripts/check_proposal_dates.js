const { ethers } = require("ethers");
const fs = require('fs');

const RPC_URL = "https://rpc.gnosischain.com";

// Missing Gnosis Proposal (Trading Address)
const GNOSIS_PROP_1 = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418";
// Kleros Proposal (Trading Address)
const KLEROS_PROP_1 = "0x2C1e08674f3F78f8a1426a41C41B8BF546fA481a";

let logs = "";
function log(msg) {
    console.log(msg);
    logs += msg + "\n";
}

async function main() {
    log("🔍 Checking Proposal Creation Blocks...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const currentBlock = await provider.getBlockNumber();
    log(`Current Block: ${currentBlock}`);

    // Check Gnosis
    log(`\n--- Check 1: Gnosis Missing Proposal (${GNOSIS_PROP_1}) ---`);
    await findCreationBlock(provider, GNOSIS_PROP_1, "Gnosis Missing Proposal");

    // Check Kleros
    log(`\n--- Check 2: Kleros Unlinked Proposal (${KLEROS_PROP_1}) ---`);
    await findCreationBlock(provider, KLEROS_PROP_1, "Kleros Unlinked Proposal");

    fs.writeFileSync("dates.txt", logs);
}

async function findCreationBlock(provider, address, label) {
    log(`Searching for ${label} (${address})...`);

    const code = await provider.getCode(address);
    if (code === "0x") {
        log(`❌ Contract ${address} does not exist at current block!`);
        return;
    }

    let min = 30000000;
    let max = await provider.getBlockNumber();
    let foundBlock = max;

    // Optimization: Check if it exists at 42978530 (Our startBlock)
    const codeAtStart = await provider.getCode(address, 42978530);
    if (codeAtStart !== "0x") {
        log(`⚠️  Contract existed BEFORE our startBlock (42978530)!`);
        max = 42978530; // We search downwards
    } else {
        log(`✅ Contract created AFTER startBlock.`);
        // Assuming we want to find the exact block even if it's after (to confirm)
        // continue searching?
        // Actually if it's AFTER, then our current startBlock *should* have caught it.
        // Wait, if Gnosis prop is MISSING but created AFTER startBlock, then startBlock isn't the issue for THAT one?
        // Let's refine the search to be sure.
        min = 42978530;
    }

    // Just strict binary search to find exact block
    while (min <= max) {
        let mid = Math.floor((min + max) / 2);
        let codeAtMid = await provider.getCode(address, mid);

        if (codeAtMid !== "0x") {
            foundBlock = mid;
            max = mid - 1;
        } else {
            min = mid + 1;
        }
    }
    log(`📅 Creation Block ~ ${foundBlock}`);
}

main().catch(console.error);
