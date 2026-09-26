export type NavLinkId = "home" | "models" | "configurator" | "gallery" | "about" | "compare";

export interface NavLink {
  id: NavLinkId;
  href: string;
}

/** The nav's Home/Models/Configurator/Gallery/About/Compare links (Spec 13 AC-1, Spec 18 AC-7, Spec 31) —
 * Configurator's href is dynamic (the default vehicle's slug, or a /models fallback when
 * it couldn't be resolved), everything else is fixed. Labels are translated by id at render
 * time (`nav.links.<id>` in messages/, Spec 26). */
export function buildNavLinks(configureHref: string): NavLink[] {
  return [
    { id: "home", href: "/" },
    { id: "models", href: "/models" },
    { id: "configurator", href: configureHref },
    { id: "gallery", href: "/gallery" },
    { id: "about", href: "/about" },
    { id: "compare", href: "/compare" },
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
