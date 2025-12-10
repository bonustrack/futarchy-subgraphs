const { ethers } = require('ethers');

const RPC_URL = "https://rpc.gnosischain.com";
const POOL_ADDRESS = "0x4fF34E270CA54944955b2F595CeC4CF53BDc9e0c"; // The missing pool

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log(`Checking age of pool: ${POOL_ADDRESS}`);

    // Quick heuristic: get code. if no code, it doesn't exist.
    const code = await provider.getCode(POOL_ADDRESS);
    if (code === '0x') {
        console.error("Pool has no code! It might not exist.");
        return;
    }

    // Binary search for creation block is expensive/slow without an indexer.
    // Instead, let's just get the current block and maybe minimal verify history?
    // Actually, we can just guess. 
    // Gnosis blocks are 5s. 
    // Let's try to get the logs for the Pool creation event from the Algebra Factory?

    const ALGEBRA_FACTORY = "0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766";
    const POOL_EVENT_TOPIC = "0x91ccaa7a278130b65168c3a0c8d3bcae2556743182ee889650b339f428763785"; // Pool(address,address,address)

    // We can filter logs for the factory.
    // But we need a range. 

    const currentBlock = await provider.getBlockNumber();
    console.log(`Current Block: ${currentBlock}`);

    // Try finding the log in chunks of 5M blocks backwards?
    // StartBlock is 42900000.
    // Let's check if the log exists BEFORE 42900000.

    const searchEnd = 42900000;
    const CHUNK_SIZE = 1000000; // 1M blocks per chunk might be safe on Gnosis, let's try 500k if fails.
    let start = 30000000;
    const end = await provider.getBlockNumber();

    console.log(`Searching for Pool creation from ${start} to ${end} in chunks of ${CHUNK_SIZE}...`);

    const iface = new ethers.Interface(["event Pool(address indexed token0, address indexed token1, address pool)"]);

    while (start < end) {
        const to = Math.min(start + CHUNK_SIZE, end);
        console.log(`Scanning ${start} -> ${to}...`);
        try {
            const logs = await provider.getLogs({
                address: ALGEBRA_FACTORY,
                topics: [POOL_EVENT_TOPIC], // Just topic 0, filter in memory for pool
                fromBlock: start,
                toBlock: to
            });

            for (const log of logs) {
                try {
                    const parsed = iface.parseLog(log);
                    if (parsed.args[2].toLowerCase() === POOL_ADDRESS.toLowerCase()) {
                        console.log(`\n[FOUND!] Pool created at block: ${log.blockNumber}`);
                        return; // Done
                    }
                } catch (e) { /* ignore parse error */ }
            }
        } catch (e) {
            console.log(`  Error scanning chunk ${start}-${to}: ${e.message.slice(0, 100)}`);
            // Retry chunk? Or just skip? If RPC error, maybe reduce size
        }
        start = to + 1;
    }
    console.log("Finished scan. Pool NOT found.");
}

main();

