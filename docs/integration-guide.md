# Integration Guide · Hooking into Warrant

*A one-page guide for any X Layer protocol, DAO, or agent framework
that wants to gate its own actions on warrant-verified proofs.*

---

## TL;DR

`ProofVerifier.isVerified(bytes32 proofId) → bool` is the entire
integration surface. Call it in your contract or off-chain agent before
executing any sensitive action, and the warrant gate works for you the
same way it works for `LiquidityVault`. No token approval, no off-chain
signatures, no migration — just a cross-contract view call.

---

## Why integrate

Warrant is positioned as **primitive infrastructure**, not a single
product. The dual-hash warrant (proposalHash + executionHash) is a
general-purpose policy-enforcement pattern. Any of the following are
natural integration targets:

| Use case | Who benefits | Hook point |
|---|---|---|
| Warrant-gated swap routers | DEX aggregators on X Layer | `require(proofVerifier.isVerified(proofId))` before `SwapRouter02.exactInputSingle` |
| Warrant-gated lending | Lending protocols giving AI agents borrowing power | Same `require` before `flashLoan` / `borrow` |
| Warrant-gated DAO treasury moves | X Layer DAOs letting agents propose on-chain spends | Pre-vote sanity check on a proposed spend calldata |
| Warrant-gated cross-chain bridges | Bridges allowing AI-initiated transfers | Verify the bridge initiation was policy-compliant |
| Warrant-gated oracles | Oracle updaters controlled by autonomous agents | Bind feed-update calldata to a warrant |

In all cases the *authorization primitive* is the same. What differs
is only the asset or action the warrant guards.

---

## Wire-up in 20 lines of Solidity

```solidity
// Any X Layer protocol contract:
interface IProofVerifier {
    function isVerified(bytes32 proofId) external view returns (bool);
    function consumeProof(
        bytes32 proofId,
        uint256 expectedStrategyId,
        bytes32 expectedExecutionHash
    ) external returns (bool);
}

contract WarrantGatedAction {
    IProofVerifier public constant PROOF_VERIFIER =
        IProofVerifier(0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8); // X Layer mainnet

    function doTheAction(
        bytes32 proofId,
        uint256 expectedStrategyId,
        bytes32 expectedExecutionHash,
        /* your action args */
    ) external {
        // Option 1 — peek only. The same warrant can still be consumed
        // elsewhere (cheap, but replay-safe only if you track proofIds).
        require(PROOF_VERIFIER.isVerified(proofId), "No warrant");

        // Option 2 — consume. The warrant is burned here and cannot be
        // re-used anywhere else. Use this when YOUR contract is the
        // single legitimate consumer.
        PROOF_VERIFIER.consumeProof(proofId, expectedStrategyId, expectedExecutionHash);

        // ... your action
    }
}
```

If you use Option 2 you must first be authorized as a consumer:
```solidity
PROOF_VERIFIER.setConsumer(yourContractAddress, true);
// owner-only — request from the Warrant team.
```

---

## Wire-up in TypeScript (off-chain agents)

```ts
import { Contract, JsonRpcProvider } from "ethers";

const PROOF_VERIFIER_ABI = [
  "function isVerified(bytes32 proofId) view returns (bool)",
];

const rpc = new JsonRpcProvider("https://rpc.xlayer.tech");
const proofVerifier = new Contract(
  "0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8",
  PROOF_VERIFIER_ABI,
  rpc,
);

export async function guard(proofId: string, action: () => Promise<void>) {
  const ok = await proofVerifier.isVerified(proofId);
  if (!ok) throw new Error(`Warrant ${proofId} is not verified. Action refused.`);
  return action();
}
```

---

## Getting a warrant for YOUR action

You have two paths:

### Path A — use Warrant's Scout agent

Point Warrant's StrategyRegistry at a strategy that matches your
policy, and have your off-chain agent call
`POST /api/scout/propose` on the Warrant server. It returns a
proposal + signed attestation that lands on `ProofVerifier`, and you
consume that proofId.

This is zero-code-on-your-side: you piggyback on Warrant's Scout.

### Path B — run your own attestation signer

`AttestationVerifier` accepts ECDSA signatures from any pre-authorized
signer. Deploy your own signer wallet, have the Warrant owner whitelist
it via `setSigner(yourAddress)`, and then your agent signs warrants
directly.

This gives you independent sovereignty — you don't need Warrant's
Scout to exist.

---

## Upgrade path: swap in a zk-SNARK verifier

`ProofVerifier.setVerifier(newVerifierAddress)` lets the owner replace
`AttestationVerifier` with a groth16 / plonk verifier **without any
data migration**. All past proofIds remain valid under the new scheme,
and your integration contract needs zero changes because you only
depend on the `isVerified()` view.

---

## FAQ

**Q: Does my contract need to hold tokens?**
No. Warrant's proof-gate pattern is orthogonal to custody. You decide
where the assets live; Warrant only answers "was this move
authorized".

**Q: What's the gas cost of a warrant check?**
`isVerified()` is a single SLOAD on mainnet — a few thousand gas.
`consumeProof()` is an SSTORE on top of that, still well under 50k.

**Q: Can multiple contracts share a single warrant?**
Yes, if all of them use `isVerified()` (Option 1). Only the
authorized consumer that calls `consumeProof()` burns the warrant.

**Q: Who is the authorized signer today?**
On X Layer mainnet:
`0x86b0E1c48d39D58304939c0681818F0E1c1e8d83` — Warrant's Scout agent.
Documented fully in [`docs/agent-identities.md`](./agent-identities.md).

---

## Reach out

Drop an issue at the repo, or tag us on X. Integration requests
usually take under 24h to whitelist.
