// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZkVerifier {
    function verify(bytes calldata proofData, bytes32[] calldata publicInputs) external view returns (bool);
}

interface IStrategyRegistryView {
    function existsAndActive(uint256 strategyId) external view returns (bool);
}

/// @title ProofVerifier
/// @notice Accepts zk-proof submissions and binds each proof to BOTH the scout's
///         proposal hash (what was asked) AND the scout's committed execution hash
///         (the exact parameters the executor will later have to run). Consuming a
///         proof requires the executor to replay the execution hash. No mismatch,
///         no capital moves.
contract ProofVerifier {
    struct ProofRecord {
        uint256 strategyId;
        bytes32 proposalHash;
        bytes32 executionHash;
        bytes32 publicInputsHash;
        address prover;
        uint40 submittedAt;
        bool verified;
        bool consumed;
    }

    address public owner;
    IZkVerifier public verifier;
    IStrategyRegistryView public immutable strategyRegistry;
    bool public insecureDemoMode;

    mapping(bytes32 => ProofRecord) private proofRecords;
    mapping(address => bool) public authorizedConsumers;

    event ProofAccepted(
        bytes32 indexed proofId,
        uint256 indexed strategyId,
        bytes32 indexed proposalHash,
        bytes32 executionHash,
        bytes32 publicInputsHash,
        address prover,
        address verifierContract,
        bool insecureDemoMode
    );
    event ProofConsumed(
        bytes32 indexed proofId,
        uint256 indexed strategyId,
        bytes32 indexed executionHash,
        address consumer
    );
    event VerifierUpdated(address indexed verifier);
    event ConsumerAuthorizationUpdated(address indexed consumer, bool allowed);
    event InsecureDemoModeUpdated(bool enabled);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not verifier owner");
        _;
    }

    constructor(address verifierAddress, address registryAddress, bool allowInsecureDemoMode) {
        require(registryAddress != address(0), "Registry required");
        owner = msg.sender;
        verifier = IZkVerifier(verifierAddress);
        strategyRegistry = IStrategyRegistryView(registryAddress);
        insecureDemoMode = allowInsecureDemoMode;
    }

    function setVerifier(address verifierAddress) external onlyOwner {
        verifier = IZkVerifier(verifierAddress);
        emit VerifierUpdated(verifierAddress);
    }

    function setConsumer(address consumer, bool allowed) external onlyOwner {
        require(consumer != address(0), "Consumer required");
        authorizedConsumers[consumer] = allowed;
        emit ConsumerAuthorizationUpdated(consumer, allowed);
    }

    function setInsecureDemoMode(bool enabled) external onlyOwner {
        insecureDemoMode = enabled;
        emit InsecureDemoModeUpdated(enabled);
    }

    /// @notice Submit a zk proof binding a scout proposal to a concrete
    ///         execution commitment. The executor will later have to replay
    ///         the exact execution hash when calling consumeProof.
    /// @param proofId      Unique id for this proof (caller-generated).
    /// @param strategyId   Strategy this proof belongs to.
    /// @param proposalHash Hash describing WHAT the scout is proposing.
    /// @param executionHash Hash describing the EXACT execution parameters the
    ///                      scout is committing to. Must be reproducible from
    ///                      the structured action params passed to
    ///                      LiquidityVault.executeRebalance.
    function submitProof(
        bytes32 proofId,
        uint256 strategyId,
        bytes32 proposalHash,
        bytes32 executionHash,
        bytes32[] calldata publicInputs,
        bytes calldata proofData
    ) external returns (bool) {
        require(proofId != bytes32(0), "Proof id required");
        require(proofRecords[proofId].submittedAt == 0, "Proof already used");
        require(strategyId != 0, "Strategy id required");
        require(proposalHash != bytes32(0), "Proposal hash required");
        require(executionHash != bytes32(0), "Execution hash required");
        require(publicInputs.length > 0, "Public inputs required");
        require(proofData.length > 0, "Proof payload required");
        require(strategyRegistry.existsAndActive(strategyId), "Strategy not found or inactive");
        require(_verifyProof(proofData, publicInputs), "Proof rejected");

        bytes32 publicInputsHash = keccak256(abi.encode(publicInputs));
        proofRecords[proofId] = ProofRecord({
            strategyId: strategyId,
            proposalHash: proposalHash,
            executionHash: executionHash,
            publicInputsHash: publicInputsHash,
            prover: msg.sender,
            submittedAt: uint40(block.timestamp),
            verified: true,
            consumed: false
        });

        emit ProofAccepted(
            proofId,
            strategyId,
            proposalHash,
            executionHash,
            publicInputsHash,
            msg.sender,
            address(verifier),
            insecureDemoMode
        );
        return true;
    }

    /// @notice Consume an accepted proof. Caller must be an authorized
    ///         consumer (e.g. LiquidityVault). The proof is burned (marked
    ///         consumed) on success, preventing replay.
    /// @param proofId               The proof id returned by submitProof.
    /// @param expectedStrategyId    Strategy id the caller expects this proof to belong to.
    /// @param expectedExecutionHash Hash of the actual execution parameters the
    ///                              caller is about to run. Must equal the
    ///                              executionHash committed at submit time.
    function consumeProof(
        bytes32 proofId,
        uint256 expectedStrategyId,
        bytes32 expectedExecutionHash
    ) external returns (bool) {
        require(authorizedConsumers[msg.sender], "Not authorized consumer");

        ProofRecord storage record = proofRecords[proofId];
        require(record.verified, "Proof not verified");
        require(!record.consumed, "Proof already consumed");
        require(record.strategyId == expectedStrategyId, "Strategy mismatch");
        require(record.executionHash == expectedExecutionHash, "Execution mismatch");

        record.consumed = true;

        emit ProofConsumed(proofId, expectedStrategyId, expectedExecutionHash, msg.sender);
        return true;
    }

    function isVerified(bytes32 proofId) external view returns (bool) {
        ProofRecord storage record = proofRecords[proofId];
        return record.verified && !record.consumed;
    }

    function getProofRecord(bytes32 proofId) external view returns (ProofRecord memory) {
        return proofRecords[proofId];
    }

    function _verifyProof(bytes calldata proofData, bytes32[] calldata publicInputs) internal view returns (bool) {
        if (address(verifier) != address(0)) {
            return verifier.verify(proofData, publicInputs);
        }

        return insecureDemoMode && proofData.length > 0 && publicInputs.length > 0;
    }
}
