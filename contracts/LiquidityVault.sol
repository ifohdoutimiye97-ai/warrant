// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStrategyRegistry {
    function consumeRebalance(uint256 strategyId) external;

    function ownerOf(uint256 strategyId) external view returns (address);

    function existsAndActive(uint256 strategyId) external view returns (bool);
}

interface IProofVerifier {
    function consumeProof(bytes32 proofId, uint256 expectedStrategyId, bytes32 expectedExecutionHash) external returns (bool);
}

/// @title LiquidityVault
/// @notice Owner-facing vault that only executes a rebalance after consuming a
///         proof that exactly matches the structured execution parameters.
///         The execution hash is computed INSIDE the contract from the
///         RebalanceAction struct, so the executor cannot substitute a
///         different set of parameters after the proof has been verified.
contract LiquidityVault {
    struct VaultPosition {
        address owner;
        address baseToken;
        address quoteToken;
        uint256 strategyId;
        bool active;
    }

    /// @notice Exact parameters the executor must provide on rebalance. The
    ///         keccak256 of this struct must equal the executionHash that the
    ///         scout committed to when calling ProofVerifier.submitProof.
    struct RebalanceAction {
        address pool;
        int24 lowerTick;
        int24 upperTick;
        int256 liquidityDelta;
        address recipient;
    }

    IStrategyRegistry public immutable strategyRegistry;
    IProofVerifier public immutable proofVerifier;
    address public owner;
    address public executor;

    mapping(uint256 => VaultPosition) public vaults;
    uint256 public nextVaultId = 1;

    event VaultCreated(uint256 indexed vaultId, address indexed owner, uint256 indexed strategyId);
    event ExecutorUpdated(address indexed executor);
    event RebalanceExecuted(
        uint256 indexed vaultId,
        bytes32 indexed proofId,
        bytes32 executionHash,
        address pool,
        int24 lowerTick,
        int24 upperTick,
        int256 liquidityDelta,
        address recipient
    );

    modifier onlyExecutor() {
        require(msg.sender == executor, "Not executor");
        _;
    }

    modifier onlyVaultOwner() {
        require(msg.sender == owner, "Not vault owner");
        _;
    }

    constructor(address registry, address verifier, address initialExecutor) {
        require(registry != address(0), "Registry required");
        require(verifier != address(0), "Verifier required");
        require(initialExecutor != address(0), "Executor required");
        strategyRegistry = IStrategyRegistry(registry);
        proofVerifier = IProofVerifier(verifier);
        owner = msg.sender;
        executor = initialExecutor;
    }

    function setExecutor(address newExecutor) external onlyVaultOwner {
        require(newExecutor != address(0), "Executor required");
        executor = newExecutor;
        emit ExecutorUpdated(newExecutor);
    }

    /// @notice Creates a vault bound to a strategy. The caller must be the
    ///         owner of the strategy in StrategyRegistry. This prevents
    ///         unrelated addresses from binding vaults to someone else's
    ///         strategy and consuming their daily budget.
    function createVault(address baseToken, address quoteToken, uint256 strategyId) external returns (uint256 vaultId) {
        require(baseToken != address(0), "Base token required");
        require(quoteToken != address(0), "Quote token required");
        require(baseToken != quoteToken, "Tokens must differ");
        require(strategyRegistry.ownerOf(strategyId) == msg.sender, "Not strategy owner");
        require(strategyRegistry.existsAndActive(strategyId), "Strategy inactive");

        vaultId = nextVaultId++;
        vaults[vaultId] = VaultPosition({
            owner: msg.sender,
            baseToken: baseToken,
            quoteToken: quoteToken,
            strategyId: strategyId,
            active: true
        });

        emit VaultCreated(vaultId, msg.sender, strategyId);
    }

    /// @notice Execute a rebalance after consuming a verified proof. The
    ///         execution hash is computed from the exact RebalanceAction
    ///         fields, so the executor cannot deviate from the parameters
    ///         that were committed at proof submission time.
    function executeRebalance(
        uint256 vaultId,
        bytes32 proofId,
        RebalanceAction calldata action
    ) external onlyExecutor {
        VaultPosition storage position = vaults[vaultId];
        require(position.active, "Vault inactive");

        bytes32 executionHash = keccak256(
            abi.encode(action.pool, action.lowerTick, action.upperTick, action.liquidityDelta, action.recipient)
        );

        // Proof gate: must match BOTH the strategy id and the committed
        // execution hash exactly. Reverts on any mismatch or replay attempt.
        proofVerifier.consumeProof(proofId, position.strategyId, executionHash);

        // Daily cap: consumes one slot; reverts if exceeded.
        strategyRegistry.consumeRebalance(position.strategyId);

        // Capital-movement layer is EXTERNAL to the vault by design. The
        // vault's single job is to be the proof gate: recompute the
        // executionHash on-chain from the exact RebalanceAction struct,
        // consume the warrant (replay-safe), and emit the structured event
        // below. The actual liquidity work (NFPM mint / decreaseLiquidity /
        // collect, or SwapRouter02.exactInputSingle) runs at the Executor
        // agent tier AFTER this transaction confirms — see
        // `agents/executor-agent.ts` methods `mintPositionViaNfpm`,
        // `swapLegViaRouter02`, and the composite `executeRebalanceAndMint`.
        // This separation keeps the vault's attack surface small and lets
        // any X Layer protocol plug its own post-warrant handler without
        // forking the gate; see `docs/integration-guide.md`.
        emit RebalanceExecuted(
            vaultId,
            proofId,
            executionHash,
            action.pool,
            action.lowerTick,
            action.upperTick,
            action.liquidityDelta,
            action.recipient
        );
    }
}
