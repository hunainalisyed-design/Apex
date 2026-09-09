"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { CompareNavItem } from "./CompareNavItem";
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
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const links = buildNavLinks(configureHref);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  return (
    <nav aria-label="Primary" className="glass-panel sticky top-0 z-40 flex items-center justify-between gap-4 px-6 py-4">
      <Link href="/" className="focus-ring rounded text-sm font-bold uppercase tracking-[0.3em]">
        Apex
      </Link>

      <ul className="hidden items-center gap-6 lg:flex">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              aria-current={isActiveLink(pathname, link.href) ? "page" : undefined}
              className="focus-ring rounded text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white aria-[current=page]:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li>
          <CompareNavItem />
        </li>
      </ul>

      <div className="flex items-center gap-3">
        {rightSlot}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-lg lg:hidden"
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
