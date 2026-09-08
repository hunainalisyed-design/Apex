/** Visually hidden until focused; the very first focusable element on every page
 * (Spec 12, AC-6). Activating it jumps a keyboard user past the navigation/hero chrome
 * straight to the route's own #main-content landmark. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only-until-focus focus-ring fixed left-4 top-4 z-[100] rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
    >
      Skip to main content
    </a>
  );
}
