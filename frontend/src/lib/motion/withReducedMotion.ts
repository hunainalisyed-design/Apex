/**
 * Dispatches between an animated and instant value based on prefers-reduced-motion
 * (Spec 12, AC-5). A plain function, not a hook: call sites already have `reducedMotion`
 * in scope from useReducedMotion() (Spec 1), and a "with"-prefixed function calling a hook
 * internally would trip react-hooks/rules-of-hooks. One canonical dispatch instead of each
 * animated call site repeating its own `reducedMotion ? instant : animate` ternary.
 */
export function withReducedMotion<T>(reducedMotion: boolean, animate: T, instant: T): T {
  return reducedMotion ? instant : animate;
}
