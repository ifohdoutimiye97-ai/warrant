"use client";

import { BrowserProvider, JsonRpcSigner } from "ethers";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_CHAIN_ID,
  NETWORKS,
  X_LAYER_MAINNET,
} from "@/config/networks";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isOKExWallet?: boolean;
  isOkxWallet?: boolean;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    okxwallet?: { ethereum?: Eip1193Provider };
  }
}

type WalletStatus = "disconnected" | "connecting" | "connected";

type WalletContextValue = {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  hasProvider: boolean;
  isCorrectNetwork: boolean;
  targetChainId: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  getSigner: () => Promise<JsonRpcSigner | null>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function pickInjectedProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.okxwallet?.ethereum) return window.okxwallet.ethereum;
  if (window.ethereum) return window.ethereum;
  return undefined;
}

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

function parseChainId(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "string") {
    const parsed = raw.startsWith("0x") ? parseInt(raw, 16) : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const providerRef = useRef<BrowserProvider | null>(null);

  const targetChainId = DEFAULT_CHAIN_ID;

  const ensureProvider = useCallback(() => {
    const injected = pickInjectedProvider();
    if (!injected) return null;
    if (!providerRef.current) {
      providerRef.current = new BrowserProvider(injected);
    }
    return { injected, provider: providerRef.current };
  }, []);

  const refreshChainId = useCallback(async () => {
    const handles = ensureProvider();
    if (!handles) return;
    try {
      const network = await handles.provider.getNetwork();
      setChainId(Number(network.chainId));
    } catch {
      // ignore; listeners will recover on the next chainChanged event
    }
  }, [ensureProvider]);

  const refreshAccounts = useCallback(async () => {
    const handles = ensureProvider();
    if (!handles) return;
    try {
      const accounts = (await handles.injected.request({ method: "eth_accounts" })) as string[] | undefined;
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setStatus("connected");
        await refreshChainId();
      } else {
        setAddress(null);
        setStatus("disconnected");
      }
    } catch {
      // ignore
    }
  }, [ensureProvider, refreshChainId]);

  // Initial detection + event listeners
  useEffect(() => {
    const handles = ensureProvider();
    if (!handles) {
      setHasProvider(false);
      return;
    }
    setHasProvider(true);
    refreshAccounts();

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0];
      if (Array.isArray(accounts) && accounts.length > 0 && typeof accounts[0] === "string") {
        setAddress(accounts[0]);
        setStatus("connected");
      } else {
        setAddress(null);
        setStatus("disconnected");
      }
    };
    const handleChainChanged = (...args: unknown[]) => {
      const next = parseChainId(args[0]);
      setChainId(next);
      // Re-create BrowserProvider so ethers internal network cache is clean
      providerRef.current = null;
      ensureProvider();
    };
    const handleDisconnect = () => {
      setAddress(null);
      setStatus("disconnected");
    };

    handles.injected.on?.("accountsChanged", handleAccountsChanged);
    handles.injected.on?.("chainChanged", handleChainChanged);
    handles.injected.on?.("disconnect", handleDisconnect);

    return () => {
      handles.injected.removeListener?.("accountsChanged", handleAccountsChanged);
      handles.injected.removeListener?.("chainChanged", handleChainChanged);
      handles.injected.removeListener?.("disconnect", handleDisconnect);
    };
  }, [ensureProvider, refreshAccounts]);

  const connect = useCallback(async () => {
    const handles = ensureProvider();
    if (!handles) {
      // No injected wallet → point the user at OKX Web3 Wallet install page.
      if (typeof window !== "undefined") {
        window.open("https://www.okx.com/web3", "_blank", "noopener,noreferrer");
      }
      return;
    }
    setStatus("connecting");
    try {
      const accounts = (await handles.injected.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        await refreshChainId();
        setStatus("connected");
      } else {
        setStatus("disconnected");
      }
    } catch (error) {
      console.error("[Warrant] wallet connect failed", error);
      setStatus("disconnected");
    }
  }, [ensureProvider, refreshChainId]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setStatus("disconnected");
  }, []);

  const switchNetwork = useCallback(async () => {
    const handles = ensureProvider();
    if (!handles) return;
    const target = NETWORKS[targetChainId] ?? X_LAYER_MAINNET;
    try {
      await handles.injected.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHexChainId(target.chainId) }],
      });
    } catch (error) {
      const code = (error as { code?: number } | null)?.code;
      if (code === 4902) {
        // Chain not added to the wallet yet. Propose adding it.
        try {
          await handles.injected.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: toHexChainId(target.chainId),
                chainName: target.name,
                rpcUrls: [target.rpc],
                blockExplorerUrls: [target.blockExplorer],
                nativeCurrency: target.nativeCurrency,
              },
            ],
          });
        } catch (addError) {
          console.error("[Warrant] wallet_addEthereumChain failed", addError);
        }
      } else {
        console.error("[Warrant] wallet_switchEthereumChain failed", error);
      }
    }
  }, [ensureProvider, targetChainId]);

  const getSigner = useCallback(async () => {
    const handles = ensureProvider();
    if (!handles) return null;
    try {
      return await handles.provider.getSigner();
    } catch (error) {
      console.error("[Warrant] getSigner failed", error);
      return null;
    }
  }, [ensureProvider]);

  const isCorrectNetwork = chainId === targetChainId;

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address,
      chainId,
      hasProvider,
      isCorrectNetwork,
      targetChainId,
      connect,
      disconnect,
      switchNetwork,
      getSigner,
    }),
    [
      address,
      chainId,
      connect,
      disconnect,
      getSigner,
      hasProvider,
      isCorrectNetwork,
      status,
      switchNetwork,
      targetChainId,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}

export function shortenAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
