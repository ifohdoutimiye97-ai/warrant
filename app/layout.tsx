import type { Metadata } from "next";
import "./globals.css";
import { DemoProvider } from "@/components/demo-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WalletProvider } from "@/components/wallet-context";
import { LiveDeploymentProvider } from "@/components/live-deployment-context";
import { EnvironmentBanner } from "@/components/environment-banner";
import { getDeploymentStatus } from "@/lib/deployment-manifest";

export const metadata: Metadata = {
  title: "Warrant — Proof-gated Liquidity Agents on X Layer",
  description:
    "Warrant is a proof-gated liquidity agent system on X Layer. Capital cannot move until a warrant clears the verifier. No warrant, no move.",
  metadataBase: new URL("https://warrant.fi"),
  openGraph: {
    title: "Warrant — Proof-gated Liquidity Agents on X Layer",
    description:
      "No warrant, no move. Warrant delegates Uniswap concentrated liquidity to AI agents without giving them blind authority.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@warrant_fi",
    title: "Warrant — Proof-gated Liquidity Agents on X Layer",
    description: "No warrant, no move. Proof-gated liquidity agents on X Layer.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const deploymentStatus = await getDeploymentStatus();

  return (
    <html className="dark" lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LiveDeploymentProvider value={deploymentStatus}>
          <WalletProvider>
            <DemoProvider>
              <EnvironmentBanner />
              <SiteHeader />
              <main>{children}</main>
              <SiteFooter />
            </DemoProvider>
          </WalletProvider>
        </LiveDeploymentProvider>
      </body>
    </html>
  );
}
