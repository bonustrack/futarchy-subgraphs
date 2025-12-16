const ENDPOINT = "https://api.studio.thegraph.com/query/1719045/algebra-proposal-candles/v0.0.6";

const query = `
query {
  token: whitelistedToken(id: "0x2c32fa8990fda4f32bf6ba17e1e55623c5361dc8") {
    id
    symbol
    role
    proposal {
      id
    }
  }
}
`;

async function main() {
    console.log("Checking token 0x2c32fa8990fda4f32bf6ba17e1e55623c5361dc8...");
    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const data = await response.json();

        if (data.errors) {
            console.log("Errors:", data.errors);
        } else {
            console.log("Token Data:", JSON.stringify(data.data.token, null, 2));
        }

    } catch (error) {
        console.error("Execution Error:", error);
    }
}

main();
