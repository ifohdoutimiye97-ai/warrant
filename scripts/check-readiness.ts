import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  artifactInventory,
  readinessTasks,
  submissionLinks,
  teamTemplate,
} from "../lib/submission-data";
import { getAgentEntries, getContractEntries, getDeploymentStatus, isPlaceholder } from "../lib/deployment-manifest";

const PLACEHOLDER_SCAN_PATTERN = /\b(TBD(?:_[A-Z0-9_]+)?|Optional)\b/g;
const PLACEHOLDER_TEST_PATTERN = /\b(TBD(?:_[A-Z0-9_]+)?|Optional)\b/;

async function exists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const rootDir = process.cwd();
  const requiredPaths = [
    "README.md",
    "docs/submission-form.en.md",
    "docs/submission-form.zh.md",
    "docs/submission-checklist.md",
    "docs/demo-script.md",
    "docs/final-sprint.md",
    "deployments/xlayer-template.json",
    "proofs/sample-proof-packet.json",
  ];

  const issues: string[] = [];
  const successes: string[] = [];
  const { manifest, manifestFile, hasLiveManifest } = await getDeploymentStatus();
  const contractEntries = getContractEntries(manifest);
  const agentEntries = getAgentEntries(manifest);

  for (const relativePath of requiredPaths) {
    const targetPath = path.join(rootDir, relativePath);
    if (await exists(targetPath)) {
      successes.push(`Found required file: ${relativePath}`);
    } else {
      issues.push(`Missing required file: ${relativePath}`);
    }
  }

  for (const artifact of artifactInventory) {
    const artifactPath = path.join(rootDir, artifact.path);
    if (await exists(artifactPath)) {
      successes.push(`Found artifact: ${artifact.path}`);
    } else {
      issues.push(`Missing artifact: ${artifact.path}`);
    }
  }

  if (hasLiveManifest) {
    successes.push(`Found live deployment manifest: deployments/${manifestFile}`);
  } else {
    issues.push("No live deployment manifest found under deployments/xlayer-<chainId>.json");
  }

  const readme = await readFile(path.join(rootDir, "README.md"), "utf8");
  const submissionDraftEn = await readFile(path.join(rootDir, "docs", "submission-form.en.md"), "utf8");
  const submissionDraftZh = await readFile(path.join(rootDir, "docs", "submission-form.zh.md"), "utf8");

  const placeholderFiles = [
    { label: "README.md", content: readme },
    { label: "docs/submission-form.en.md", content: submissionDraftEn },
    { label: "docs/submission-form.zh.md", content: submissionDraftZh },
  ];

  for (const file of placeholderFiles) {
    const matches = file.content.match(PLACEHOLDER_SCAN_PATTERN) ?? [];
    if (matches.length > 0) {
      issues.push(`${file.label} still contains placeholder tokens (${matches.length})`);
    } else {
      successes.push(`${file.label} has no placeholder tokens`);
    }
  }

  for (const item of contractEntries) {
    if (isPlaceholder(item.address)) {
      issues.push(`Contract address still pending for ${item.name}`);
    } else {
      successes.push(`Contract address set for ${item.name}`);
    }
  }

  for (const agent of agentEntries) {
    if (isPlaceholder(agent.address)) {
      issues.push(`Agent wallet still pending for ${agent.name}`);
    } else {
      successes.push(`Agent wallet set for ${agent.name}`);
    }
  }

  for (const item of submissionLinks) {
    if (PLACEHOLDER_TEST_PATTERN.test(item.value)) {
      issues.push(`Submission link still pending for ${item.field}`);
    } else {
      successes.push(`Submission link set for ${item.field}`);
    }
  }

  for (const item of teamTemplate) {
    if (PLACEHOLDER_TEST_PATTERN.test(item.value)) {
      issues.push(`Team field still pending for ${item.field}`);
    } else {
      successes.push(`Team field set for ${item.field}`);
    }
  }

  for (const task of readinessTasks.filter((item) => item.status !== "Done")) {
    issues.push(`Readiness task still pending: ${task.title}`);
  }

  const totalChecks = successes.length + issues.length;
  const completion = totalChecks === 0 ? 0 : Math.round((successes.length / totalChecks) * 100);

  console.log("Warrant readiness report");
  console.log(`Completed checks: ${successes.length}`);
  console.log(`Pending issues: ${issues.length}`);
  console.log(`Completion: ${completion}%`);

  if (successes.length > 0) {
    console.log("\nPassed:");
    for (const item of successes) {
      console.log(`- ${item}`);
    }
  }

  if (issues.length > 0) {
    console.log("\nNeeds attention:");
    for (const item of issues) {
      console.log(`- ${item}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("\nEverything required for submission appears to be filled in.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
