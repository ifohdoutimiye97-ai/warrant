import { SubmissionPanel } from "@/components/submission-panel";
import { getAgentEntries, getContractEntries, getDeploymentStatus } from "@/lib/deployment-manifest";

export default async function SubmitPage() {
  const { manifest, manifestFile, hasLiveManifest } = await getDeploymentStatus();

  return (
    <SubmissionPanel
      manifest={manifest}
      manifestFile={manifestFile}
      hasLiveManifest={hasLiveManifest}
      contractEntries={getContractEntries(manifest)}
      agentEntries={getAgentEntries(manifest)}
    />
  );
}
