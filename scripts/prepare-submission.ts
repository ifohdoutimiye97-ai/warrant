import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  artifactInventory,
  happyPathTransactions,
  happyPathVerifiedFacts,
  proofPacket,
  readinessTasks,
  skillUsage,
  submissionChecklist,
  submissionCommands,
  submissionFormCopy,
  submissionLinks,
  submissionOverview,
  teamTemplate,
} from "../lib/submission-data";
import { getAgentEntries, getContractEntries, getDeploymentStatus } from "../lib/deployment-manifest";

function tableRow(columns: string[]) {
  return `| ${columns.join(" | ")} |`;
}

function bulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

async function main() {
  const generatedAt = new Date().toISOString();
  const outputDir = path.join(process.cwd(), "submission");
  const { manifest, manifestFile, hasLiveManifest } = await getDeploymentStatus();
  const contractEntries = getContractEntries(manifest);
  const agentEntries = getAgentEntries(manifest);

  await mkdir(outputDir, { recursive: true });

  const packetMarkdown = `# ${submissionOverview.projectName}

Generated at ${generatedAt}

## Overview

- Track: ${submissionOverview.category}
- Pitch: ${submissionOverview.shortPitch}
- Target pool: ${submissionOverview.targetPool}
- Integrations: ${submissionOverview.primaryIntegrations.join(", ")}
- Manifest source: ${manifestFile}${hasLiveManifest ? " (live deployment)" : " (template fallback)"}

## Deployment Manifest

${tableRow(["Contract", "Address", "Purpose"])}
${tableRow(["---", "---", "---"])}
${contractEntries
  .map((contract) => tableRow([contract.name, `\`${contract.address}\``, contract.purpose]))
  .join("\n")}

## Agent Wallets

${tableRow(["Agent", "Address", "Role"])}
${tableRow(["---", "---", "---"])}
${agentEntries.map((agent) => tableRow([agent.name, `\`${agent.address}\``, agent.role])).join("\n")}

## End-to-end Verification on X Layer Mainnet

Full warrant lifecycle executed by \`pnpm tsx scripts/run-happy-path.ts\` at block ${happyPathVerifiedFacts.block} on chainId ${happyPathVerifiedFacts.chainId}. Pool ${happyPathVerifiedFacts.poolLabel} (\`${happyPathVerifiedFacts.pool}\`). Strategy #${happyPathVerifiedFacts.strategyId}, vault #${happyPathVerifiedFacts.vaultId}, proofId \`${happyPathVerifiedFacts.proofId}\`.

${tableRow(["Step", "Actor", "tx hash"])}
${tableRow(["---", "---", "---"])}
${happyPathTransactions
  .map((t) => tableRow([`\`${t.step}\``, t.actor, `[\`${t.txHash.slice(0, 18)}…\`](https://www.okx.com/web3/explorer/xlayer/tx/${t.txHash})`]))
  .join("\n")}

Verified facts (from this run):

- Pool tick: ${happyPathVerifiedFacts.currentTick}, price ${happyPathVerifiedFacts.priceToken1InToken0}
- Proposed range: [${happyPathVerifiedFacts.proposedRangeLowerTick}, ${happyPathVerifiedFacts.proposedRangeUpperTick}]
- proposalHash: \`${happyPathVerifiedFacts.proposalHash}\`
- executionHash: \`${happyPathVerifiedFacts.executionHash}\`
- Warrant consumed: isVerified flipped true → false after executeRebalance
- Daily budget decremented: remainingRebalancesToday 2 → 1
- Gas used for executeRebalance: ${happyPathVerifiedFacts.gasUsedExecuteRebalance.toLocaleString()}
- Epoch #${happyPathVerifiedFacts.epochId} recorded via TreasuryAgent with split scout=${happyPathVerifiedFacts.rewardSplit.scout}/executor=${happyPathVerifiedFacts.rewardSplit.executor}/treasury=${happyPathVerifiedFacts.rewardSplit.treasury}/retained=${happyPathVerifiedFacts.rewardSplit.retained} (of grossFees=${happyPathVerifiedFacts.rewardSplit.grossFees})

Skill modules exercised end-to-end:

${happyPathVerifiedFacts.skillAuditPassed.map((s) => `- ${s}`).join("\n")}

## Proof Packet Snapshot

${tableRow(["Field", "Value"])}
${tableRow(["---", "---"])}
${Object.entries(proofPacket)
  .map(([field, value]) => tableRow([field, `\`${String(value)}\``]))
  .join("\n")}

## Integration Notes

${skillUsage.map((item) => `### ${item.name}\n\n${item.detail}`).join("\n\n")}

## Artifact Inventory

${tableRow(["Artifact", "Path", "Status"])}
${tableRow(["---", "---", "---"])}
${artifactInventory.map((item) => tableRow([item.name, `\`${item.path}\``, item.status])).join("\n")}

## Team

${tableRow(["Field", "Value"])}
${tableRow(["---", "---"])}
${teamTemplate.map((item) => tableRow([item.field, item.value])).join("\n")}

## Submission Links

${tableRow(["Field", "Value"])}
${tableRow(["---", "---"])}
${submissionLinks.map((item) => tableRow([item.field, item.value])).join("\n")}

## Google Form Copy

${submissionFormCopy.map((item) => `### ${item.field}\n\n${item.value}`).join("\n\n")}

## Readiness Tasks

${tableRow(["Task", "Status", "Note"])}
${tableRow(["---", "---", "---"])}
${readinessTasks.map((task) => tableRow([task.title, task.status, task.note])).join("\n")}

## Checklist

${bulletList(submissionChecklist)}

## Useful Commands

${submissionCommands.map((item) => `- \`${item.command}\` — ${item.note}`).join("\n")}
`;

  const googleFormMarkdown = `# Google Form Copy Deck

Generated at ${generatedAt}

${submissionFormCopy.map((item) => `## ${item.field}\n\n${item.value}`).join("\n\n")}
`;

  const packetJson = {
    generatedAt,
    overview: submissionOverview,
    deploymentManifest: {
      manifestFile,
      hasLiveManifest,
      ...manifest,
    },
    agentIdentities: agentEntries,
    contractEntries,
    proofPacket,
    happyPathTransactions,
    happyPathVerifiedFacts,
    skillUsage,
    artifactInventory,
    teamTemplate,
    submissionLinks,
    submissionChecklist,
    submissionCommands,
    submissionFormCopy,
    readinessTasks,
  };

  await Promise.all([
    writeFile(path.join(outputDir, "FINAL_PACKET.md"), `${packetMarkdown}\n`, "utf8"),
    writeFile(path.join(outputDir, "GOOGLE_FORM_COPY.md"), `${googleFormMarkdown}\n`, "utf8"),
    writeFile(path.join(outputDir, "final-packet.json"), `${JSON.stringify(packetJson, null, 2)}\n`, "utf8"),
  ]);

  console.log(`Submission packet generated in ${outputDir}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
