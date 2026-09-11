"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, type RefObject } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { withReducedMotion } from "@/lib/motion/withReducedMotion";
import { isActiveLink, type NavLink } from "./navLinks";

export interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  links: NavLink[];
  pathname: string;
  /** Focus returns here on Escape (Spec 13, AC-5) — the hamburger button that opened it. */
  toggleRef: RefObject<HTMLButtonElement | null>;
}

/** The collapsed-viewport (below `lg`) nav panel (Spec 13, AC-3). Conditionally mounted via
 * AnimatePresence, not CSS-hidden, so it never pays any layout/focus-trap cost while
 * closed. Escape closes it and returns focus to the toggle button; Tab cycles only within
 * it while open — both via the shared useFocusTrap hook (also used by CaptureBuild's modal,
 * Spec 11). */
export function MobileMenu({ isOpen, onClose, links, pathname, toggleRef }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useFocusTrap(panelRef, isOpen, onClose, { returnFocusTo: toggleRef });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="glass-panel absolute inset-x-0 top-full z-50 flex flex-col gap-1 p-4 lg:hidden"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: withReducedMotion(reducedMotion, 0.25, 0) }}
        >
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={onClose}
              aria-current={isActiveLink(pathname, link.href) ? "page" : undefined}
              className="focus-ring rounded-lg px-3 py-3 text-sm font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 aria-[current=page]:text-white"
            >
              {link.label}
            </Link>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
