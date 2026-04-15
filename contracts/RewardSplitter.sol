// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RewardSplitter
/// @notice Records per-epoch reward attribution. Only authorized recorders
///         (e.g. LiquidityVault or the Treasury agent wallet, configured at
///         deployment time) may write epochs. Each record enforces the
///         invariant scoutReward + executorReward + treasuryReward <= grossFees.
contract RewardSplitter {
    struct EpochRecord {
        uint256 grossFees;
        uint256 scoutReward;
        uint256 executorReward;
        uint256 treasuryReward;
        bytes32 proofId;
        address recorder;
        uint40 recordedAt;
    }

    address public owner;
    mapping(address => bool) public authorizedRecorders;
    mapping(uint256 => EpochRecord) public epochs;
    mapping(bytes32 => bool) public proofAlreadyRecorded;
    uint256 public nextEpochId = 1;

    event RecorderAuthorizationUpdated(address indexed recorder, bool allowed);
    event EpochRecorded(
        uint256 indexed epochId,
        uint256 grossFees,
        uint256 scoutReward,
        uint256 executorReward,
        uint256 treasuryReward,
        bytes32 indexed proofId,
        address indexed recorder
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedRecorders[msg.sender], "Not authorized recorder");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setRecorder(address recorder, bool allowed) external onlyOwner {
        require(recorder != address(0), "Recorder required");
        authorizedRecorders[recorder] = allowed;
        emit RecorderAuthorizationUpdated(recorder, allowed);
    }

    function recordEpoch(
        uint256 grossFees,
        uint256 scoutReward,
        uint256 executorReward,
        uint256 treasuryReward,
        bytes32 proofId
    ) external onlyAuthorized returns (uint256 epochId) {
        require(proofId != bytes32(0), "Proof id required");
        require(!proofAlreadyRecorded[proofId], "Proof already settled");
        // Split invariant: the sum of rewards cannot exceed the gross fees.
        require(scoutReward + executorReward + treasuryReward <= grossFees, "Rewards exceed fees");

        epochId = nextEpochId++;
        epochs[epochId] = EpochRecord({
            grossFees: grossFees,
            scoutReward: scoutReward,
            executorReward: executorReward,
            treasuryReward: treasuryReward,
            proofId: proofId,
            recorder: msg.sender,
            recordedAt: uint40(block.timestamp)
        });
        proofAlreadyRecorded[proofId] = true;

        emit EpochRecorded(epochId, grossFees, scoutReward, executorReward, treasuryReward, proofId, msg.sender);
    }
}
