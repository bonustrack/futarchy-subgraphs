const { ethers } = require("ethers");
const RPC_URL = "https://rpc.gnosischain.com";

const AGGREGATOR = "0xdc5825b60462F38C41E0d3e7F7e3052148A610EE"; // FutarchyFi
const ORG = "0xe204584Feb4564d3891739E395F6d6198F218247"; // Gnosis DAO

async function getCreationBlock(provider, address) {
    // Binary search for creation block roughly
    let min = 30000000;
    let max = await provider.getBlockNumber();
    let createdBlock = -1;

    // Fast check: is it already there at min?
    let codeAtMin = await provider.getCode(address, min).catch(() => "0x");
    if (codeAtMin.length > 2) {
        return `< ${min} (Already Deployed)`;
    }

    while (min <= max) {
        let mid = Math.floor((min + max) / 2);
        let code = await provider.getCode(address, mid).catch(() => "0x");

        if (code.length > 2) {
            createdBlock = mid;
            max = mid - 1;
        } else {
            min = mid + 1;
        }
    }
    return createdBlock;
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("🕵️ Checking Creation Blocks...");

    const aggBlock = await getCreationBlock(provider, AGGREGATOR);
    console.log(`Aggregator (${AGGREGATOR}): Created at Block ~${aggBlock}`);

    const orgBlock = await getCreationBlock(provider, ORG);
    console.log(`Organization (${ORG}): Created at Block ~${orgBlock}`);
}

main();
