"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { MobileMenu } from "./MobileMenu";
import { buildNavLinks, isActiveLink } from "./navLinks";

export interface NavClientProps {
  /** `/configure/{defaultVehicleSlug}`, or `/models` when no default vehicle could be
   * resolved (Spec 13, AC-1 and §5's documented error UI state). */
  configureHref: string;
  /** Extension point for Phase 2's AI-assistant/account controls (Spec 13, AC-4) — unused
   * today, deliberately not built ahead of the specs that will fill it. */
  rightSlot?: ReactNode;
}

/** Persistent nav bar (Spec 13, AC-1 through AC-7) — the client half of Nav.tsx, which
 * resolves the Configurator link's target server-side and passes it down here. Owns the
 * mobile hamburger toggle (collapses below `lg`, this codebase's one existing structural
 * breakpoint — see ShowroomLayout.tsx) and aria-current, both of which need client-side
 * state/the current pathname. */
export function NavClient({ configureHref, rightSlot }: NavClientProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const links = buildNavLinks(configureHref);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  return (
    <nav
      aria-label={t("label")}
      className="glass-panel sticky top-0 z-40 flex items-center justify-between gap-4 border-x-0 border-t-0 px-6 py-4 lg:px-10"
    >
      <Link href="/" className="focus-ring rounded text-sm font-bold uppercase tracking-[0.35em] transition hover:text-white/80">
        {t("brand")}
      </Link>

      <ul className="hidden items-center gap-8 lg:flex">
        {links.map((link) => (
          <li key={link.id}>
            <Link
              href={link.href}
              aria-current={isActiveLink(pathname, link.href) ? "page" : undefined}
              className="focus-ring group relative rounded py-1 text-xs font-semibold uppercase tracking-wide text-white/60 transition hover:text-white aria-[current=page]:text-white"
            >
              {t(`links.${link.id}`)}
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-all duration-300 group-hover:w-full group-aria-[current=page]:w-full"
              />
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        {/* Visual affordance only — no search functionality wired up yet. */}
        <button
          type="button"
          aria-label={t("search")}
          className="focus-ring hidden h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white lg:flex"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" strokeLinecap="round" />
          </svg>
        </button>
        {rightSlot}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={isOpen ? t("closeMenu") : t("openMenu")}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-lg transition hover:bg-white/10 lg:hidden"
        >
          {/* No aria-hidden needed here — the button's own aria-label above already fully
              determines its accessible name, so this glyph is purely decorative already. A
              stray aria-hidden="true" span would also collide with e2e selectors elsewhere
              in the app that key off that exact attribute (e.g. landing.spec.ts's hero-area
              locator). */}
          {isOpen ? "✕" : "☰"}
        </button>
      </div>

      <MobileMenu isOpen={isOpen} onClose={closeMenu} links={links} pathname={pathname} toggleRef={toggleRef} />
    </nav>
  );
}
