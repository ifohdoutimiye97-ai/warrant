import Link from "next/link";
import { WarrantLogo } from "@/components/warrant-logo";

type BrandMarkProps = {
  href?: string;
  showText?: boolean;
  /** Unique suffix so header/footer logos don't alias gradient ids */
  instance?: string;
};

export function BrandMark({ href = "/", showText = true, instance = "header" }: BrandMarkProps) {
  return (
    <Link className="brand" href={href} aria-label="Warrant">
      <span className="brand-mark" aria-hidden="true">
        <WarrantLogo size={36} instance={instance} />
      </span>
      {showText ? (
        <span className="brand-text">
          <strong>Warrant</strong>
          <span>Proof-gated liquidity agents</span>
        </span>
      ) : null}
    </Link>
  );
}
