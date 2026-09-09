export interface CompareNavItemProps {
  className?: string;
}

/** Compare (Phase 2, Spec 18) doesn't exist yet — Spec 13 AC-2 requires the nav still show
 * its place in the information architecture, visibly disabled with a "Coming soon"
 * affordance, rather than a broken link or a silent omission. A <span role="link"
 * aria-disabled> rather than an actual <a>, since anchors can't be truly disabled and a
 * functional-looking link that does nothing on activation would be worse than this. */
export function CompareNavItem({ className = "" }: CompareNavItemProps) {
  return (
    <span
      role="link"
      aria-disabled="true"
      title="Coming soon"
      className={`inline-flex cursor-not-allowed items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/30 ${className}`}
    >
      Compare
      <span
        aria-hidden="true"
        className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-white/50"
      >
        Soon
      </span>
    </span>
  );
}
