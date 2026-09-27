import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "@/types/catalog";
import type { LiveChange, LiveSelectionState } from "@/types/liveSession";

/**
 * The changes that turn `prev` into `next`, as live-session messages (Spec 33). Used to send
 * whatever the local user just did in the configurator — every panel, CarAI and Reset all go
 * through the one configuration store, so diffing it covers them all without touching each.
 * Accessories/packages become toggles (the server applies them to its own state, so two
 * people's additions both stick); a custom color follows its paint selection.
 */
export function diffSelections(prev: LiveSelectionState, next: LiveSelectionState): LiveChange[] {
  const changes: LiveChange[] = [];
  for (const category of SINGLE_SELECT_CATEGORIES) {
    const optionId = next.singleSelections[category];
    if (optionId && optionId !== prev.singleSelections[category]) changes.push({ kind: "select", category, optionId });
  }
  for (const category of MULTI_SELECT_CATEGORIES) {
    const before = new Set(prev.multiSelections[category] ?? []);
    const after = new Set(next.multiSelections[category] ?? []);
    for (const optionId of after) if (!before.has(optionId)) changes.push({ kind: "toggle", category, optionId });
    for (const optionId of before) if (!after.has(optionId)) changes.push({ kind: "toggle", category, optionId });
  }
  // Picking a paint clears the custom color on both sides already; only a new color needs sending.
  if (next.customPaintHex && next.customPaintHex !== prev.customPaintHex) changes.push({ kind: "customPaint", hex: next.customPaintHex });
  if (next.environmentId !== prev.environmentId) changes.push({ kind: "environment", environmentId: next.environmentId });
  return changes;
}
