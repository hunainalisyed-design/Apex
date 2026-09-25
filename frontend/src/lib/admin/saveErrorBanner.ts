/**
 * The form-level banner text for a failed admin save. Field errors the dialog renders inline
 * (via FormField's `errors`) are pointed at rather than repeated; any detail for a field the
 * dialog has no inline slot for (e.g. an option's `isDefault` checkbox) is shown here in full,
 * so no server message is ever silently dropped. Without details, the code-based message.
 */
export function saveErrorBanner(
  saveError: string | null,
  details: Record<string, string[]> | null,
  inlineFields: readonly string[],
): string | null {
  if (!details) return saveError;
  const unshown = Object.entries(details)
    .filter(([field]) => !inlineFields.includes(field))
    .flatMap(([, messages]) => messages);
  return unshown.length > 0 ? unshown.join(" ") : "Fix the highlighted fields below.";
}
