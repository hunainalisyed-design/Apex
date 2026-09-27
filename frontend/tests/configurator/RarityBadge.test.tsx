import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleDetailDto } from "../../src/types/catalog";
import type { ComboRarityDto } from "../../src/types/comboRarity";
import type { SavedConfigurationDto } from "../../src/types/configuration";

const getComboRarityMock = vi.fn();
vi.mock("../../src/lib/api/comboRarity", () => ({
  getComboRarity: (...args: unknown[]) => getComboRarityMock(...args),
}));

const { RarityBadge } = await import("../../src/components/configurator/RarityBadge/RarityBadge");
const { useComboRarityStore } = await import("../../src/state/comboRarityStore");
const { useConfigurationStore } = await import("../../src/state/configurationStore");

const vehicle = { slug: "apex-gt", name: "Apex GT" } as unknown as VehicleDetailDto;
const INITIAL_RARITY = useComboRarityStore.getState();

const SELECTIONS = { PAINT: "paint-blue", WHEELS: "wheels-sport" } as unknown as SavedConfigurationDto["singleSelections"];

function rarity(overrides: Partial<ComboRarityDto> = {}): ComboRarityDto {
  return {
    sampleSize: 240,
    computedAt: "2026-09-26T12:00:00.000Z",
    rareCombos: [{ paintId: "paint-blue", wheelsId: "wheels-sport", percentage: 3.5 }],
    firstOfKind: false,
    ...overrides,
  };
}

function select(singleSelections: SavedConfigurationDto["singleSelections"], saved: SavedConfigurationDto | null = null) {
  useConfigurationStore.setState({
    singleSelections,
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
    environmentId: null,
    savedConfiguration: saved,
  });
}

function savedBuild(publicId: string): SavedConfigurationDto {
  return {
    publicId,
    vehicleSlug: "apex-gt",
    singleSelections: SELECTIONS,
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
    environmentId: null,
  } as unknown as SavedConfigurationDto;
}

describe("RarityBadge (Spec 32)", () => {
  beforeEach(() => {
    getComboRarityMock.mockReset();
    useComboRarityStore.setState(INITIAL_RARITY, true);
    select(SELECTIONS);
  });

  it("shows the accurate percentage for a rare paint + wheels pair (AC-2)", async () => {
    getComboRarityMock.mockResolvedValue(rarity());
    render(<RarityBadge vehicle={vehicle} />);

    const badge = await screen.findByTestId("rarity-badge");
    expect(badge).toHaveTextContent("Only 3.5% of Apex GT builds choose this paint and wheel combination");
    expect(badge).toHaveAttribute("title", "Based on 240 saved builds");
    expect(getComboRarityMock).toHaveBeenCalledWith("apex-gt", null);
  });

  it("always shows one decimal place, even for a whole percentage", async () => {
    getComboRarityMock.mockResolvedValue(rarity({ rareCombos: [{ paintId: "paint-blue", wheelsId: "wheels-sport", percentage: 3 }] }));
    render(<RarityBadge vehicle={vehicle} />);
    expect(await screen.findByTestId("rarity-badge")).toHaveTextContent("Only 3.0% of Apex GT builds");
  });

  it("shows nothing when the pair isn't rare, or the sample is too small (AC-3)", async () => {
    getComboRarityMock.mockResolvedValue(rarity({ rareCombos: [] }));
    const { container } = render(<RarityBadge vehicle={vehicle} />);
    await waitFor(() => expect(getComboRarityMock).toHaveBeenCalled());
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when the data couldn't be loaded", async () => {
    getComboRarityMock.mockResolvedValue(null);
    const { container } = render(<RarityBadge vehicle={vehicle} />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it("follows paint/wheels changes live, without refetching", async () => {
    getComboRarityMock.mockResolvedValue(rarity());
    render(<RarityBadge vehicle={vehicle} />);
    await screen.findByTestId("rarity-badge");

    act(() => select({ ...SELECTIONS, WHEELS: "wheels-base" } as SavedConfigurationDto["singleSelections"]));
    expect(screen.queryByTestId("rarity-badge")).not.toBeInTheDocument();

    act(() => select(SELECTIONS));
    expect(screen.getByTestId("rarity-badge")).toBeInTheDocument();
    expect(getComboRarityMock).toHaveBeenCalledTimes(1);
  });

  it("shows the first-of-kind achievement for the loaded saved build (AC-5)", async () => {
    select(SELECTIONS, savedBuild("APEX-FRST-0001"));
    getComboRarityMock.mockResolvedValue(rarity({ firstOfKind: true }));
    render(<RarityBadge vehicle={vehicle} />);

    expect(await screen.findByTestId("first-of-kind-badge")).toHaveTextContent(
      "First build ever with this paint and wheel combination",
    );
    expect(getComboRarityMock).toHaveBeenCalledWith("apex-gt", "APEX-FRST-0001");
  });

  it("drops the first-of-kind achievement once the build is changed — that's a different build", async () => {
    select(SELECTIONS, savedBuild("APEX-FRST-0001"));
    getComboRarityMock.mockResolvedValue(rarity({ firstOfKind: true, rareCombos: [] }));
    render(<RarityBadge vehicle={vehicle} />);
    await screen.findByTestId("first-of-kind-badge");

    act(() => useConfigurationStore.setState({ singleSelections: { ...SELECTIONS, PAINT: "paint-red" } as SavedConfigurationDto["singleSelections"] }));
    expect(screen.queryByTestId("first-of-kind-badge")).not.toBeInTheDocument();
  });

  it("never shows one vehicle's data on another", async () => {
    getComboRarityMock.mockResolvedValue(rarity());
    const { rerender } = render(<RarityBadge vehicle={vehicle} />);
    await screen.findByTestId("rarity-badge");

    getComboRarityMock.mockReturnValue(new Promise(() => {}));
    rerender(<RarityBadge vehicle={{ ...vehicle, slug: "apex-rs", name: "Apex RS" }} />);
    expect(screen.queryByTestId("rarity-badge")).not.toBeInTheDocument();
  });
});
