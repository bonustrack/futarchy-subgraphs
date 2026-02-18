// Creator (Aggregator Factory) ABI - for indexing aggregator creation events  
export const CreatorAbi = [
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "metadata",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "name",
                "type": "string"
            }
        ],
        "name": "AggregatorMetadataCreated",
        "type": "event"
    }
];
