const axios = require('axios');

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1718249/futarchy-complete/v0.0.12";

async function main() {
    try {
        const res = await axios.post(SUBGRAPH_URL, {
            query: `{
                _meta {
                    block {
                        number
                    }
                    hasIndexingErrors
                }
            }`
        });

        if (res.data.errors) {
            console.log("GRAPH_ERROR");
            console.error(JSON.stringify(res.data.errors));
        } else if (res.data.data && res.data.data._meta) {
            console.log(`BLOCK:${res.data.data._meta.block.number}`);
            if (res.data.data._meta.hasIndexingErrors) console.log("INDEXING_ERRORS_DETECTED");
        } else {
            console.log("NO_DATA");
        }
    } catch (e) {
        console.log("CONNECTION_FAIL");
        console.error(e.message);
    }
}

main();
