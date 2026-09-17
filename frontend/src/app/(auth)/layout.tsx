import type { Metadata } from "next";
import { AuthLayoutClient } from "./AuthLayoutClient";

/** Spec 23, AC-1/AC-3: sign-in/sign-up/password-reset pages carry no product-search value
 * and shouldn't be indexed or listed in sitemap.xml (see robots.ts's matching disallow). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayoutClient>{children}</AuthLayoutClient>;
}
