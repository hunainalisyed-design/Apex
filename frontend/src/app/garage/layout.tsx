import type { Metadata } from "next";

/** Spec 23, AC-1/AC-3: a signed-in user's own saved builds — never indexed or listed in
 * sitemap.xml (see robots.ts's matching disallow). garage/page.tsx is a Client Component
 * (its own auth-redirect guard), so this thin Server Component layout is the only place in
 * this route segment that can export `metadata`. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function GarageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
