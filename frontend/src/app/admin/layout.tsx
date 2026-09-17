import type { Metadata } from "next";
import { AdminGate } from "./AdminGate";

/** Spec 23, AC-1/AC-3: internal tooling, never indexed or listed in sitemap.xml (see
 * robots.ts's matching disallow) — independent of AC-1 of Spec 21's own access gate above. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
