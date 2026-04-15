"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DeploymentManifest } from "@/lib/deployment-manifest";

export type LiveDeploymentSnapshot = {
  manifest: DeploymentManifest;
  manifestFile: string;
  hasLiveManifest: boolean;
};

const LiveDeploymentContext = createContext<LiveDeploymentSnapshot | null>(null);

export function LiveDeploymentProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: LiveDeploymentSnapshot;
}) {
  return <LiveDeploymentContext.Provider value={value}>{children}</LiveDeploymentContext.Provider>;
}

export function useLiveDeployment() {
  const ctx = useContext(LiveDeploymentContext);
  if (!ctx) {
    throw new Error("useLiveDeployment must be used within LiveDeploymentProvider");
  }
  return ctx;
}
