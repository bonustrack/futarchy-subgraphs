// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./FutarchyProposalMetadata.sol";

contract FutarchyOrganizationMetadata is Ownable, Initializable {
    string public companyName;
    string public description;
    string public metadata;      // On-chain JSON for small data
    string public metadataURI;   // IPFS/Arweave URI for large data
    FutarchyProposalMetadata[] public proposals;
    
    address public editor;                    // Optional editor with write access
    address public proposalImplementation;   // Implementation for cloning proposals

    event CompanyInfoUpdated(string newName, string newDescription);
    event ExtendedMetadataUpdated(string metadata, string metadataURI);
    event ProposalAdded(address indexed proposalMetadata);
    event ProposalRemoved(address indexed proposalMetadata);
    event ProposalCreatedAndAdded(address indexed proposalMetadata, address indexed proposalAddress);
    event EditorSet(address indexed newEditor);
    event EditorRevoked(address indexed oldEditor);
    event ProposalImplementationSet(address indexed implementation);

    modifier onlyOwnerOrEditor() {
        require(msg.sender == owner() || msg.sender == editor, "Not owner or editor");
        _;
    }

    constructor() Ownable(msg.sender) {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        string memory _companyName,
        string memory _description,
        string memory _metadata,
        string memory _metadataURI
    ) external initializer {
        _transferOwnership(_owner);
        companyName = _companyName;
        description = _description;
        metadata = _metadata;
        metadataURI = _metadataURI;
    }

    function setProposalImplementation(address _implementation) external onlyOwner {
        proposalImplementation = _implementation;
        emit ProposalImplementationSet(_implementation);
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

    function updateCompanyInfo(string memory _newName, string memory _newDescription) external onlyOwnerOrEditor {
        companyName = _newName;
        description = _newDescription;
        emit CompanyInfoUpdated(_newName, _newDescription);
    }

    function updateExtendedMetadata(
        string memory _metadata,
        string memory _metadataURI
    ) external onlyOwnerOrEditor {
        metadata = _metadata;
        metadataURI = _metadataURI;
        emit ExtendedMetadataUpdated(_metadata, _metadataURI);
    }

    function addProposalMetadata(address _proposalMetadata) external onlyOwnerOrEditor {
        proposals.push(FutarchyProposalMetadata(_proposalMetadata));
        emit ProposalAdded(_proposalMetadata);
    }

    /// @notice Create a new ProposalMetadata and add it to this Organization in one transaction
    /// @dev Requires proposalImplementation to be set first via setProposalImplementation()
    function createAndAddProposalMetadata(
        address proposalAddress,
        string memory displayNameQuestion,
        string memory displayNameEvent,
        string memory _description,
        string memory _metadata,
        string memory _metadataURI
    ) external onlyOwnerOrEditor returns (address) {
        require(proposalImplementation != address(0), "Proposal implementation not set");
        
        // Clone the proposal implementation
        address clone = Clones.clone(proposalImplementation);
        
        // Initialize the clone with the organization as owner
        FutarchyProposalMetadata(clone).initialize(
            address(this),  // Organization owns the proposal
            proposalAddress,
            displayNameQuestion,
            displayNameEvent,
            _description,
            _metadata,
            _metadataURI
        );
        
        // Add to proposals array
        proposals.push(FutarchyProposalMetadata(clone));
        
        emit ProposalCreatedAndAdded(clone, proposalAddress);
        return clone;
    }

    function removeProposalMetadata(uint256 index) external onlyOwnerOrEditor {
        require(index < proposals.length, "Index out of bounds");
        address removed = address(proposals[index]);
        // Swap with last element and pop (gas efficient)
        proposals[index] = proposals[proposals.length - 1];
        proposals.pop();
        emit ProposalRemoved(removed);
    }

    function getProposalsCount() external view returns (uint256) {
        return proposals.length;
    }

    function getProposals(uint256 offset, uint256 limit) external view returns (FutarchyProposalMetadata[] memory) {
        uint256 total = proposals.length;
        if (offset >= total) {
            return new FutarchyProposalMetadata[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        uint256 size = end - offset;
        FutarchyProposalMetadata[] memory result = new FutarchyProposalMetadata[](size);
        
        for (uint256 i = 0; i < size; i++) {
            result[i] = proposals[offset + i];
        }
        
        return result;
    }
}

