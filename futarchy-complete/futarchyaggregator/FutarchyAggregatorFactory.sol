// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./FutarchyAggregatorsMetadata.sol";

contract FutarchyAggregatorFactory {
    address public immutable implementation;

    event AggregatorMetadataCreated(address indexed metadata, string name);

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function createAggregatorMetadata(
        string memory aggregatorName,
        string memory description,
        string memory metadata,
        string memory metadataURI
    ) external returns (address) {
        address clone = Clones.clone(implementation);
        FutarchyAggregatorsMetadata(clone).initialize(
            msg.sender,
            aggregatorName,
            description,
            metadata,
            metadataURI
        );
        emit AggregatorMetadataCreated(clone, aggregatorName);
        return clone;
    }
}
