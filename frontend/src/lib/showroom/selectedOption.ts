import type { CustomizationOptionDto, VehicleDetailDto } from "@/types/catalog";
import type { SingleSelectCategory } from "@/types/pricing";

/** Resolves the currently-selected option for a single-select category, falling back to
 * the vehicle's isDefault option if the given id isn't found (e.g. before hydration). */
export function findSelectedOption(
  vehicle: VehicleDetailDto,
  category: SingleSelectCategory,
  optionId: string | undefined,
): CustomizationOptionDto | undefined {
  const options = vehicle.options[category] ?? [];
  return options.find((o) => o.id === optionId) ?? options.find((o) => o.isDefault);
}
