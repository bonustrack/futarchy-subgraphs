// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract FutarchyProposalMetadata is Ownable, Initializable {
    address public proposalAddress;
    string public displayNameQuestion;
    string public displayNameEvent;
    string public description;
    string public metadata;      // On-chain JSON for small data
    string public metadataURI;   // IPFS/Arweave URI for large data
    
    address public editor;       // Optional editor with write access

    event MetadataUpdated(
        string displayNameQuestion,
        string displayNameEvent,
        string description
    );

    event ExtendedMetadataUpdated(string metadata, string metadataURI);
    event EditorSet(address indexed newEditor);
    event EditorRevoked(address indexed oldEditor);

    modifier onlyOwnerOrEditor() {
        require(msg.sender == owner() || msg.sender == editor, "Not owner or editor");
        _;
    }

    constructor() Ownable(msg.sender) {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _proposalAddress,
        string memory _displayNameQuestion,
        string memory _displayNameEvent,
        string memory _description,
        string memory _metadata,
        string memory _metadataURI
    ) external initializer {
        _transferOwnership(_owner);
        proposalAddress = _proposalAddress;
        displayNameQuestion = _displayNameQuestion;
        displayNameEvent = _displayNameEvent;
        description = _description;
        metadata = _metadata;
        metadataURI = _metadataURI;
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

    function updateMetadata(
        string memory _displayNameQuestion,
        string memory _displayNameEvent,
        string memory _description
    ) external onlyOwnerOrEditor {
        displayNameQuestion = _displayNameQuestion;
        displayNameEvent = _displayNameEvent;
        description = _description;
        emit MetadataUpdated(_displayNameQuestion, _displayNameEvent, _description);
    }

    function updateExtendedMetadata(
        string memory _metadata,
        string memory _metadataURI
    ) external onlyOwnerOrEditor {
        metadata = _metadata;
        metadataURI = _metadataURI;
        emit ExtendedMetadataUpdated(_metadata, _metadataURI);
    }
}
