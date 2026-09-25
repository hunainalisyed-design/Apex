import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { AppErrorBoundary } from "@/components/shell/AppErrorBoundary";
import { AuthHydrator } from "@/components/shell/AuthHydrator";
import { Footer } from "@/components/shell/Footer";
import { Nav } from "@/components/shell/Nav/Nav";
import { SkipLink } from "@/components/shell/SkipLink";
import { ToastProvider } from "@/components/shell/ToastProvider";
import { CookieConsentBanner } from "@/components/consent/CookieConsentBanner";
import { SITE_URL } from "@/lib/seo/siteUrl";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const DEFAULT_DESCRIPTION =
  "A cinematic 3D vehicle configurator: customize, price, and share your build in real time.";

// Spec 23, AC-1: a site-wide default here, overridden per-route by each page's own
// generateMetadata (most notably /configure/[slug], which points openGraph.images at the
// dynamic per-build OG image route instead of this default).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "APEX — Virtual Car Configurator", template: "%s | APEX" },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    siteName: "APEX",
    title: "APEX — Virtual Car Configurator",
    description: DEFAULT_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "APEX — Virtual Car Configurator",
    description: DEFAULT_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Spec 26: makes translations available to client components (it inherits the
            locale and messages from src/i18n/request.ts when rendered on the server). */}
        <NextIntlClientProvider>
          <SkipLink />
          <AuthHydrator />
          <Nav />
          <CookieConsentBanner />
          <AppErrorBoundary>
            <ToastProvider>{children}</ToastProvider>
          </AppErrorBoundary>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
