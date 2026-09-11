export interface NavLink {
  href: string;
  label: string;
}

/** The nav's Home/Models/Configurator/About/Compare links (Spec 13 AC-1, Spec 18 AC-7) —
 * Configurator's href is dynamic (the default vehicle's slug, or a /models fallback when
 * it couldn't be resolved), everything else is fixed. */
export function buildNavLinks(configureHref: string): NavLink[] {
  return [
    { href: "/", label: "Home" },
    { href: "/models", label: "Models" },
    { href: configureHref, label: "Configurator" },
    { href: "/about", label: "About" },
    { href: "/compare", label: "Compare" },
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
