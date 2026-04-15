# Agents

These TypeScript files describe the three service roles used by the Warrant MVP.

## Agent roles

- `scout-agent.ts`: reads pool state, proposes a rebalance, builds proof input payloads.
- `executor-agent.ts`: checks verifier state and submits proof-gated actions to the vault.
- `treasury-agent.ts`: records fee snapshots and reward accounting updates.

The current files are scaffolds meant to make responsibilities explicit for hackathon review and follow-on implementation.
