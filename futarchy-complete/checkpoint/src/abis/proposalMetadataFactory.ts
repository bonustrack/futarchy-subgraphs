// ProposalMetadataFactory ABI - for indexing proposal creation events directly
export const ProposalMetadataFactoryAbi = [
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
                "indexed": true,
                "internalType": "address",
                "name": "proposalAddress",
                "type": "address"
            }
        ],
        "name": "ProposalMetadataCreated",
        "type": "event"
    }
];
