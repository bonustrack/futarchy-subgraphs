// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./FutarchyOrganizationMetadata.sol";

contract FutarchyAggregatorsMetadata is Ownable, Initializable {
    string public aggregatorName;
    string public description;
    string public metadata;      // On-chain JSON for small data
    string public metadataURI;   // IPFS/Arweave URI for large data
    FutarchyOrganizationMetadata[] public organizations;
    
    address public editor;                       // Optional editor with write access
    address public organizationImplementation;  // Implementation for cloning organizations

    event AggregatorInfoUpdated(string newName, string newDescription);
    event ExtendedMetadataUpdated(string metadata, string metadataURI);
    event OrganizationAdded(address indexed organizationMetadata);
    event OrganizationRemoved(address indexed organizationMetadata);
    event OrganizationCreatedAndAdded(address indexed organizationMetadata, string companyName);
    event EditorSet(address indexed newEditor);
    event EditorRevoked(address indexed oldEditor);
    event OrganizationImplementationSet(address indexed implementation);

    modifier onlyOwnerOrEditor() {
        require(msg.sender == owner() || msg.sender == editor, "Not owner or editor");
        _;
    }

    constructor() Ownable(msg.sender) {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        string memory _aggregatorName,
        string memory _description,
        string memory _metadata,
        string memory _metadataURI
    ) external initializer {
        _transferOwnership(_owner);
        aggregatorName = _aggregatorName;
        description = _description;
        metadata = _metadata;
        metadataURI = _metadataURI;
    }

    function setOrganizationImplementation(address _implementation) external onlyOwner {
        organizationImplementation = _implementation;
        emit OrganizationImplementationSet(_implementation);
    }

    function setEditor(address _editor) external onlyOwner {
        editor = _editor;
        emit EditorSet(_editor);
    }

    function revokeEditor() external onlyOwner {
        address oldEditor = editor;
        editor = address(0);
        emit EditorRevoked(oldEditor);
    }

    function updateAggregatorInfo(string memory _newName, string memory _newDescription) external onlyOwnerOrEditor {
        aggregatorName = _newName;
        description = _newDescription;
        emit AggregatorInfoUpdated(_newName, _newDescription);
    }

    function updateExtendedMetadata(
        string memory _metadata,
        string memory _metadataURI
    ) external onlyOwnerOrEditor {
        metadata = _metadata;
        metadataURI = _metadataURI;
        emit ExtendedMetadataUpdated(_metadata, _metadataURI);
    }

    function addOrganizationMetadata(address _organizationMetadata) external onlyOwnerOrEditor {
        organizations.push(FutarchyOrganizationMetadata(_organizationMetadata));
        emit OrganizationAdded(_organizationMetadata);
    }

    /// @notice Create a new Organization and add it to this Aggregator in one transaction
    /// @dev Requires organizationImplementation to be set first via setOrganizationImplementation()
    function createAndAddOrganizationMetadata(
        string memory companyName,
        string memory _description,
        string memory _metadata,
        string memory _metadataURI
    ) external onlyOwnerOrEditor returns (address) {
        require(organizationImplementation != address(0), "Organization implementation not set");
        
        // Clone the organization implementation
        address clone = Clones.clone(organizationImplementation);
        
        // Initialize the clone with the aggregator as owner
        FutarchyOrganizationMetadata(clone).initialize(
            address(this),  // Aggregator owns the organization
            companyName,
            _description,
            _metadata,
            _metadataURI
        );
        
        // Add to organizations array
        organizations.push(FutarchyOrganizationMetadata(clone));
        
        emit OrganizationCreatedAndAdded(clone, companyName);
        return clone;
    }

    function removeOrganizationMetadata(uint256 index) external onlyOwnerOrEditor {
        require(index < organizations.length, "Index out of bounds");
        address removed = address(organizations[index]);
        // Swap with last element and pop (gas efficient)
        organizations[index] = organizations[organizations.length - 1];
        organizations.pop();
        emit OrganizationRemoved(removed);
    }

    function getOrganizationsCount() external view returns (uint256) {
        return organizations.length;
    }

    function getOrganizations(uint256 offset, uint256 limit) external view returns (FutarchyOrganizationMetadata[] memory) {
        uint256 total = organizations.length;
        if (offset >= total) {
            return new FutarchyOrganizationMetadata[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        FutarchyOrganizationMetadata[] memory result = new FutarchyOrganizationMetadata[](size);

        for (uint256 i = 0; i < size; i++) {
            result[i] = organizations[offset + i];
        }

        return result;
    }
}

