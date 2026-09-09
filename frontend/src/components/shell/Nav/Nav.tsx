import { CarAINavControl } from "@/components/ai/CarAINavControl";
import { getDefaultVehicleSlug } from "@/lib/api/vehicles";
import { NavClient } from "./NavClient";

const AI_ASSISTANT_ENABLED = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";

/** Resolves the Configurator link's target server-side (Spec 13, AC-1) before handing off
 * to the interactive client half — the rest of the nav renders immediately regardless of
 * how long the vehicle-list fetch takes (Spec 13 §5's "Loading" UI state), since this is an
 * async Server Component rather than something blocking the whole layout on a client
 * fetch. */
export async function Nav() {
  const defaultVehicleSlug = await getDefaultVehicleSlug();
  const configureHref = defaultVehicleSlug ? `/configure/${defaultVehicleSlug}` : "/models";

  return (
    <NavClient
      configureHref={configureHref}
      rightSlot={AI_ASSISTANT_ENABLED ? <CarAINavControl defaultVehicleSlug={defaultVehicleSlug} /> : undefined}
    />
  );
}
