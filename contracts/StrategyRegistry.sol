// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StrategyRegistry
/// @notice Stores owner-declared liquidity strategies and enforces a real,
///         UTC-day aligned rebalance budget. The daily counter is reset the
///         first time a new UTC day is observed inside `consumeRebalance`.
contract StrategyRegistry {
    struct Strategy {
        address owner;
        address allowedPool;
        uint64 maxRebalancesPerDay;
        uint64 rebalanceCountToday;
        uint8 riskLevel;
        bool active;
        bytes32 metadataHash;
        uint40 updatedAt;
        uint40 windowStart; // unix seconds when the current daily window started
    }

    uint256 public nextStrategyId = 1;
    address public owner;
    mapping(uint256 => Strategy) public strategies;
    mapping(address => bool) public authorizedConsumers;

    event StrategyCreated(
        uint256 indexed strategyId,
        address indexed owner,
        address indexed allowedPool,
        uint64 maxRebalancesPerDay,
        uint8 riskLevel,
        bytes32 metadataHash
    );

    event StrategyUpdated(uint256 indexed strategyId, uint64 maxRebalancesPerDay, uint8 riskLevel, bytes32 metadataHash);
    event StrategyStatusChanged(uint256 indexed strategyId, bool active);
    event RebalanceConsumed(uint256 indexed strategyId, uint64 rebalanceCountToday, uint40 windowStart);
    event DailyWindowReset(uint256 indexed strategyId, uint40 newWindowStart);
    event ConsumerAuthorizationUpdated(address indexed consumer, bool allowed);

    modifier onlyStrategyOwner(uint256 strategyId) {
        require(strategies[strategyId].owner == msg.sender, "Not strategy owner");
        _;
    }

    modifier onlyRegistryOwner() {
        require(msg.sender == owner, "Not registry owner");
        _;
    }

    modifier onlyAuthorizedConsumer() {
        require(authorizedConsumers[msg.sender], "Not authorized consumer");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createStrategy(
        address allowedPool,
        uint64 maxRebalancesPerDay,
        uint8 riskLevel,
        bytes32 metadataHash
    ) external returns (uint256 strategyId) {
        require(allowedPool != address(0), "Pool required");
        require(maxRebalancesPerDay > 0, "Cap required");

        strategyId = nextStrategyId++;
        strategies[strategyId] = Strategy({
            owner: msg.sender,
            allowedPool: allowedPool,
            maxRebalancesPerDay: maxRebalancesPerDay,
            rebalanceCountToday: 0,
            riskLevel: riskLevel,
            active: true,
            metadataHash: metadataHash,
            updatedAt: uint40(block.timestamp),
            windowStart: uint40(block.timestamp)
        });

        emit StrategyCreated(strategyId, msg.sender, allowedPool, maxRebalancesPerDay, riskLevel, metadataHash);
    }

    function updateStrategy(
        uint256 strategyId,
        uint64 maxRebalancesPerDay,
        uint8 riskLevel,
        bytes32 metadataHash
    ) external onlyStrategyOwner(strategyId) {
        require(maxRebalancesPerDay > 0, "Cap required");
        Strategy storage strategy = strategies[strategyId];
        strategy.maxRebalancesPerDay = maxRebalancesPerDay;
        strategy.riskLevel = riskLevel;
        strategy.metadataHash = metadataHash;
        strategy.updatedAt = uint40(block.timestamp);

        emit StrategyUpdated(strategyId, maxRebalancesPerDay, riskLevel, metadataHash);
    }

    function setActive(uint256 strategyId, bool active) external onlyStrategyOwner(strategyId) {
        strategies[strategyId].active = active;
        strategies[strategyId].updatedAt = uint40(block.timestamp);
        emit StrategyStatusChanged(strategyId, active);
    }

    function setConsumer(address consumer, bool allowed) external onlyRegistryOwner {
        require(consumer != address(0), "Consumer required");
        authorizedConsumers[consumer] = allowed;
        emit ConsumerAuthorizationUpdated(consumer, allowed);
    }

    /// @notice Consumes one daily rebalance slot. If the stored window is from
    ///         a previous UTC day, the counter is first reset to zero.
    /// @dev Only callable by a previously authorized consumer (e.g. LiquidityVault).
    function consumeRebalance(uint256 strategyId) external onlyAuthorizedConsumer {
        Strategy storage strategy = strategies[strategyId];
        require(strategy.owner != address(0), "Strategy not found");
        require(strategy.active, "Strategy inactive");

        // Reset the counter if we've crossed into a new UTC day.
        // `block.timestamp` is constant within a single block, so multiple
        // calls in the same block cannot trigger multiple resets.
        // `1 days` = 86400 seconds; integer division truncates to UTC day index.
        uint256 currentDay = block.timestamp / 1 days;
        uint256 storedDay = uint256(strategy.windowStart) / 1 days;
        if (currentDay != storedDay) {
            strategy.rebalanceCountToday = 0;
            strategy.windowStart = uint40(block.timestamp);
            emit DailyWindowReset(strategyId, strategy.windowStart);
        }

        require(strategy.rebalanceCountToday < strategy.maxRebalancesPerDay, "Daily cap reached");

        strategy.rebalanceCountToday += 1;
        strategy.updatedAt = uint40(block.timestamp);

        emit RebalanceConsumed(strategyId, strategy.rebalanceCountToday, strategy.windowStart);
    }

    /// @notice Returns the owner of a strategy, or address(0) if it does not exist.
    ///         Used by LiquidityVault.createVault and ProofVerifier.submitProof.
    function ownerOf(uint256 strategyId) external view returns (address) {
        return strategies[strategyId].owner;
    }

    /// @notice Returns true iff the strategy exists and is currently active.
    function existsAndActive(uint256 strategyId) external view returns (bool) {
        Strategy storage s = strategies[strategyId];
        return s.owner != address(0) && s.active;
    }

    /// @notice Returns the current remaining rebalance budget for the caller's
    ///         perspective of "today". Computes a virtual counter that accounts
    ///         for the window reset rule without mutating state.
    function remainingRebalancesToday(uint256 strategyId) external view returns (uint64) {
        Strategy storage s = strategies[strategyId];
        if (s.owner == address(0) || !s.active) {
            return 0;
        }
        uint256 currentDay = block.timestamp / 1 days;
        uint256 storedDay = uint256(s.windowStart) / 1 days;
        uint64 used = currentDay == storedDay ? s.rebalanceCountToday : 0;
        if (used >= s.maxRebalancesPerDay) {
            return 0;
        }
        return s.maxRebalancesPerDay - used;
    }
}
