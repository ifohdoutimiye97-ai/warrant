/**
 * Warrant contract invariants test suite.
 *
 * These tests spin up an ephemeral in-memory EVM (ethers' built-in
 * `JsonRpcProvider` against Hardhat/Anvil would be the prod choice, but
 * we avoid the extra dep by using ethers v6's `deployContract` against a
 * local `JsonRpcProvider` is not available — so instead we run this
 * against a Node-launched `ganache`/`anvil` if available, and fall back
 * to an in-process ethers `MockProvider` via ethers' `BaseContract`.
 *
 * To avoid adding another dev dep, this file uses a lightweight approach:
 * it deploys each contract to a local anvil RPC if the `LOCAL_RPC_URL`
 * env var is set, otherwise it exits cleanly with a note. CI / future
 * work can wire in a proper ephemeral chain.
 *
 * The point of this file is that the invariants are CODIFIED, not that
 * the exact harness is perfect. Any future test runner that can point
 * at a live RPC will execute the same assertions.
 */

import process from "node:process";
import {
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  keccak256,
  solidityPacked,
  toUtf8Bytes,
  type InterfaceAbi,
} from "ethers";
import { compileContracts } from "./compile-contracts";

type TestCase = { name: string; run: () => Promise<void> };

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function expectRevert(promise: Promise<unknown>, reasonContains?: string) {
  try {
    await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (reasonContains && !message.includes(reasonContains)) {
      throw new Error(
        `Expected revert containing "${reasonContains}", got "${message}".`,
      );
    }
    return;
  }
  throw new Error("Expected revert but call succeeded.");
}

async function main() {
  const rpcUrl = process.env.LOCAL_RPC_URL;
  if (!rpcUrl) {
    console.log(
      "LOCAL_RPC_URL not set. Skipping live invariant tests.\n" +
        "To run: `anvil` (or `ganache`), then `LOCAL_RPC_URL=http://127.0.0.1:8545 pnpm contracts:test`.",
    );
    return;
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const ownerKey = process.env.TEST_DEPLOYER_KEY
    ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // anvil default account 0
  const executorKey = process.env.TEST_EXECUTOR_KEY
    ?? "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // anvil default account 1

  const owner = new Wallet(ownerKey, provider);
  const executor = new Wallet(executorKey, provider);

  const artifacts = await compileContracts({ writeArtifacts: false });

  const deployWithFactory = async (
    artifactName: keyof typeof artifacts,
    args: unknown[] = [],
  ) => {
    const artifact = artifacts[artifactName];
    if (!artifact) throw new Error(`Missing artifact ${String(artifactName)}`);
    const factory = new ContractFactory(
      artifact.abi as InterfaceAbi,
      artifact.bytecode,
      owner,
    );
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    return contract;
  };

  const tests: TestCase[] = [];

  // ---- TEST 1: StrategyRegistry happy path + daily cap ----------------
  tests.push({
    name: "StrategyRegistry: create, consume, daily cap blocks second same-day",
    run: async () => {
      const registry = await deployWithFactory("StrategyRegistry");
      const registryAddress = await registry.getAddress();

      // Owner is the only authorized consumer for this test.
      await (
        await (registry as unknown as {
          setConsumer: (a: string, b: boolean) => Promise<{ wait: () => Promise<unknown> }>;
        }).setConsumer(owner.address, true)
      ).wait();

      const pool = "0x0000000000000000000000000000000000000042";
      const tx = await (registry as unknown as {
        createStrategy: (
          pool: string,
          cap: bigint,
          risk: number,
          metadata: string,
        ) => Promise<{ wait: () => Promise<unknown> }>;
      }).createStrategy(pool, 2n, 2, keccak256(toUtf8Bytes("test-strategy")));
      await tx.wait();

      // Consume twice — both should succeed.
      await (
        await (registry as unknown as {
          consumeRebalance: (id: bigint) => Promise<{ wait: () => Promise<unknown> }>;
        }).consumeRebalance(1n)
      ).wait();
      await (
        await (registry as unknown as {
          consumeRebalance: (id: bigint) => Promise<{ wait: () => Promise<unknown> }>;
        }).consumeRebalance(1n)
      ).wait();

      // Third consume in the same day should revert.
      await expectRevert(
        (registry as unknown as {
          consumeRebalance: (id: bigint) => Promise<unknown>;
        }).consumeRebalance(1n),
        "Daily cap reached",
      );

      assert(registryAddress.length === 42, "registry address should be 20 bytes hex");
    },
  });

  // ---- TEST 2: RewardSplitter invariant ------------------------------
  tests.push({
    name: "RewardSplitter: rewards exceeding grossFees revert",
    run: async () => {
      const splitter = await deployWithFactory("RewardSplitter");
      await (
        await (splitter as unknown as {
          setRecorder: (a: string, b: boolean) => Promise<{ wait: () => Promise<unknown> }>;
        }).setRecorder(owner.address, true)
      ).wait();

      // Happy path: split sum ≤ gross.
      await (
        await (splitter as unknown as {
          recordEpoch: (
            gross: bigint,
            scout: bigint,
            executor: bigint,
            treasury: bigint,
            proofId: string,
          ) => Promise<{ wait: () => Promise<unknown> }>;
        }).recordEpoch(100n, 30n, 30n, 30n, keccak256(toUtf8Bytes("proof-a")))
      ).wait();

      // Invariant violation: split sum > gross.
      await expectRevert(
        (splitter as unknown as {
          recordEpoch: (
            gross: bigint,
            scout: bigint,
            executor: bigint,
            treasury: bigint,
            proofId: string,
          ) => Promise<unknown>;
        }).recordEpoch(100n, 60n, 30n, 30n, keccak256(toUtf8Bytes("proof-b"))),
        "Rewards exceed fees",
      );
    },
  });

  // ---- TEST 3: AttestationVerifier accepts only signed-by-authority --
  tests.push({
    name: "AttestationVerifier: accepts signer signature, rejects stranger",
    run: async () => {
      const verifier = await deployWithFactory("AttestationVerifier", [owner.address]);

      const strategyId = 1n;
      const proposalHash = keccak256(toUtf8Bytes("proposal-1"));
      const executionHash = keccak256(toUtf8Bytes("execution-1"));

      // publicInputs = [strategyId, proposalHash, executionHash]
      const publicInputs = [
        keccak256(solidityPacked(["uint256"], [strategyId])), // pad to bytes32
        proposalHash,
        executionHash,
      ];
      // Recompute the way AttestationVerifier does internally:
      const digest = keccak256(
        solidityPacked(["bytes32", "bytes32", "bytes32"], publicInputs),
      );
      const ownerSig = await owner.signMessage(Uint8Array.from(Buffer.from(digest.slice(2), "hex")));
      const strangerSig = await executor.signMessage(
        Uint8Array.from(Buffer.from(digest.slice(2), "hex")),
      );

      const verifierRead = verifier as unknown as {
        verify: (proofData: string, publicInputs: string[]) => Promise<boolean>;
      };

      const okOwner = await verifierRead.verify(ownerSig, publicInputs);
      assert(okOwner === true, "signer signature should verify");

      const okStranger = await verifierRead.verify(strangerSig, publicInputs);
      assert(okStranger === false, "non-signer signature should be rejected");
    },
  });

  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    process.stdout.write(`  ${test.name} … `);
    try {
      await test.run();
      console.log("ok");
      passed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("FAIL");
      console.log(`    ${message}`);
      failed += 1;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
  // Dummy reference to keep executor variable used even when tests skip it.
  void executor;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
