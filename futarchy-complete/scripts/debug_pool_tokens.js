const { ethers } = require("ethers");

const RPC_URL = "https://rpc.gnosischain.com";
const PROP_ADDR = "0x2c1e08674f3f78f8a1426a41c41b8bf546fa481a"; // Kleros Proposal
const POOL_ADDR = "0x33b04ed9607e5e6ea5b3ecd8f28daa9abb5d320a"; // Pool from user/candles

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
    "function collateralToken1() view returns (address)",
    "function collateralToken2() view returns (address)"
];

const ABI_POOL = [
    "function token0() view returns (address)",
    "function token1() view returns (address)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const prop = new ethers.Contract(PROP_ADDR, ABI_PROP, provider);
    const pool = new ethers.Contract(POOL_ADDR, ABI_POOL, provider);

    console.log(`🔍 Comparing Proposal vs Pool...`);

    // 1. Get Pool Tokens
    const t0 = await pool.token0();
    const t1 = await pool.token1();
    console.log(`\n🌊 Pool Tokens (${POOL_ADDR}):`);
    console.log(`   Token0: ${t0}`);
    console.log(`   Token1: ${t1}`);

    // 2. Get Proposal Tokens
    const c1 = await prop.collateralToken1();
    const c2 = await prop.collateralToken2();
    console.log(`\n📄 Proposal Collateral:`);
    console.log(`   Col1: ${c1}`);
    console.log(`   Col2: ${c2}`);

    // 3. Get Wrapped Outcomes
    console.log(`\n🎁 Wrapped Outcomes:`);
    for (let i = 0; i < 4; i++) {
        try {
            const res = await prop.wrappedOutcome(i);
            const wAddr = res[0];
            console.log(`   Index ${i}: ${wAddr}`);

            // Check match
            if (wAddr.toLowerCase() === t0.toLowerCase()) console.log(`      matches Pool Token0! ✅`);
            if (wAddr.toLowerCase() === t1.toLowerCase()) console.log(`      matches Pool Token1! ✅`);
        } catch (e) {
            console.log(`   Index ${i}: Error (${e.message})`);
        }
    }

    // Check Collateral Match
    if (c1.toLowerCase() === t0.toLowerCase()) console.log(`   Col1 matches Pool Token0! ✅`);
    if (c1.toLowerCase() === t1.toLowerCase()) console.log(`   Col1 matches Pool Token1! ✅`);
    if (c2.toLowerCase() === t0.toLowerCase()) console.log(`   Col2 matches Pool Token0! ✅`);
    if (c2.toLowerCase() === t1.toLowerCase()) console.log(`   Col2 matches Pool Token1! ✅`);

}

main().catch(console.error);
