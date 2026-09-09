"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCarAiChatStore } from "@/state/carAiChatStore";

export interface CarAINavControlProps {
  /** The default vehicle's slug, resolved server-side by Nav.tsx (Spec 13) — the fallback
   * target when the nav control is clicked from a page that isn't already a showroom. */
  defaultVehicleSlug: string | null;
}

const CONFIGURE_ROUTE_PATTERN = /^\/configure\/([^/]+)/;

/**
 * The nav's AI Assistant entry point (Spec 15, AC-2) — reachable from any page, per SRS
 * §22's placement as a persistent nav item. Navigates into the current vehicle's showroom
 * if already there, or the default vehicle's otherwise, and opens the chat automatically.
 * Setting isOpen happens synchronously in onClick, before/independent of the route
 * transition — carAiChatStore is a plain module-level Zustand store (not React-Context-
 * scoped), so it survives the client-side navigation the <Link> triggers (only a full page
 * reload would reset it, which client-side navigation specifically is not). Renders nothing
 * when no vehicle slug is resolvable at all — there's no sensible fallback destination for
 * an assistant that's always vehicle-scoped (unlike the plain Configurator link, which falls
 * back to /models).
 */
export function CarAINavControl({ defaultVehicleSlug }: CarAINavControlProps) {
  const pathname = usePathname();
  const setOpen = useCarAiChatStore((s) => s.setOpen);

  const currentVehicleSlug = pathname.match(CONFIGURE_ROUTE_PATTERN)?.[1] ?? null;
  const targetSlug = currentVehicleSlug ?? defaultVehicleSlug;

  if (!targetSlug) return null;

  return (
    <Link
      href={`/configure/${targetSlug}`}
      onClick={() => setOpen(true)}
      className="focus-ring rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      Ask CarAI
    </Link>
  );
}
