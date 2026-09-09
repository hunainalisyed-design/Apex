export interface NavLink {
  href: string;
  label: string;
}

/** The nav's Home/Models/Configurator/About links (Spec 13, AC-1) — Configurator's href is
 * dynamic (the default vehicle's slug, or a /models fallback when it couldn't be resolved),
 * everything else is fixed. Compare (AC-2) is rendered separately since it's a disabled
 * placeholder, not a real navigable link. */
export function buildNavLinks(configureHref: string): NavLink[] {
  return [
    { href: "/", label: "Home" },
    { href: "/models", label: "Models" },
    { href: configureHref, label: "Configurator" },
    { href: "/about", label: "About" },
  ];
}

/** Whether a nav link corresponds to the current route, for aria-current="page" (Spec 13,
 * AC-7). Every link matches by exact pathname except Configurator, which must match any
 * /configure/{slug} route — not just the specific default-vehicle slug it links to — since
 * a user configuring a non-default vehicle is still "in" the Configurator section. */
export function isActiveLink(pathname: string, href: string): boolean {
  if (href.startsWith("/configure/")) {
    return pathname.startsWith("/configure/");
  }
  return pathname === href;
}
