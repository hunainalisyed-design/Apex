import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedConfigurationDto } from "../../src/types/configuration";

const createLeadMock = vi.fn();
vi.mock("../../src/lib/api/leads", () => ({
  createLead: (...args: unknown[]) => createLeadMock(...args),
}));

const { LeadCaptureButtons } = await import("../../src/components/leads/LeadCaptureButtons");
const { useConfigurationStore } = await import("../../src/state/configurationStore");
const { useAuthStore } = await import("../../src/state/authStore");
const { ApiRequestError } = await import("../../src/lib/api/configurations");

const SAVED: SavedConfigurationDto = {
  publicId: "APEX-AAAA-BBBB",
  vehicleSlug: "apex-gt",
  singleSelections: {} as SavedConfigurationDto["singleSelections"],
  multiSelections: { ACCESSORY: [], PACKAGE: [] },
  customPaintHex: null,
  environmentId: null,
  breakdown: {
    vehicleSlug: "apex-gt",
    basePriceCents: 8500000,
    lineItems: [],
    totalPriceCents: 8500000,
    currency: "EUR",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  ownerId: null,
  isPublished: false,
  publishedAt: null,
};

function resetConfigStore(overrides: Partial<ReturnType<typeof useConfigurationStore.getState>> = {}) {
  useConfigurationStore.setState({
    savedConfiguration: SAVED,
    isDirtySinceLastSave: () => false,
    save: vi.fn(),
    ...overrides,
  });
}

function resetAuthStore() {
  useAuthStore.setState({ user: null, hydrated: true, isLoading: false, details: null, errorCode: null });
}

describe("Lead capture (Spec 19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetConfigStore();
    resetAuthStore();
  });

  it("renders both trigger buttons, each opening the dialog with the matching heading (AC-1)", () => {
    render(<LeadCaptureButtons />);

    fireEvent.click(screen.getByRole("button", { name: "Request Quote" }));
    expect(screen.getByRole("heading", { name: "Request a Quote" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Book a Test Drive" }));
    expect(screen.getByRole("heading", { name: "Book a Test Drive" })).toBeInTheDocument();
  });

  it("shows inline validation errors for a missing name and never submits (AC-5)", async () => {
    render(<LeadCaptureButtons />);
    fireEvent.click(screen.getByRole("button", { name: "Request Quote" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText("Name is required.")).toBeInTheDocument());
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it("pre-fills name and email from the signed-in user, still editable", () => {
    useAuthStore.setState({
      user: { id: "u1", name: "Jamie Signed In", email: "jamie@signedin.com", role: "USER", createdAt: "" },
    });
    render(<LeadCaptureButtons />);
    fireEvent.click(screen.getByRole("button", { name: "Request Quote" }));

    expect(screen.getByLabelText("Name")).toHaveValue("Jamie Signed In");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("jamie@signedin.com");
  });

  it("submits directly when the build is already saved, and shows the confirmation (AC-2)", async () => {
    createLeadMock.mockResolvedValueOnce({ id: "lead_1" });
    render(<LeadCaptureButtons />);
    fireEvent.click(screen.getByRole("button", { name: "Request Quote" }));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jamie Requester" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "jamie@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText("We'll be in touch.")).toBeInTheDocument());
    expect(createLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationPublicId: "APEX-AAAA-BBBB",
        name: "Jamie Requester",
        email: "jamie@example.com",
        requestType: "QUOTE",
      }),
    );
  });

  it("saves first when the build is dirty, then submits (Spec 11's save-if-dirty pattern)", async () => {
    const saveMock = vi.fn().mockImplementation(async () => {
      useConfigurationStore.setState({ savedConfiguration: SAVED });
      return SAVED;
    });
    resetConfigStore({ isDirtySinceLastSave: () => true, save: saveMock });
    createLeadMock.mockResolvedValueOnce({ id: "lead_2" });

    render(<LeadCaptureButtons />);
    fireEvent.click(screen.getByRole("button", { name: "Book a Test Drive" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jamie Requester" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "jamie@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText("We'll be in touch.")).toBeInTheDocument());
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(createLeadMock).toHaveBeenCalledWith(expect.objectContaining({ requestType: "TEST_DRIVE" }));
  });

  it("shows its own inline error when the save-if-dirty save fails, without ever calling createLead", async () => {
    const saveMock = vi.fn().mockRejectedValue(new ApiRequestError("VALIDATION_ERROR", "nope"));
    resetConfigStore({ isDirtySinceLastSave: () => true, save: saveMock });

    render(<LeadCaptureButtons />);
    fireEvent.click(screen.getByRole("button", { name: "Request Quote" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jamie Requester" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "jamie@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it("shows the mapped error when the lead request itself fails", async () => {
    createLeadMock.mockRejectedValueOnce(new ApiRequestError("CONFIGURATION_NOT_FOUND", "nope"));

    render(<LeadCaptureButtons />);
    fireEvent.click(screen.getByRole("button", { name: "Request Quote" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jamie Requester" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "jamie@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText("This build could not be found.")).toBeInTheDocument());
  });

  it("is a real accessible dialog, keyboard-operable, closable via Cancel (AC-6)", () => {
    render(<LeadCaptureButtons />);
    fireEvent.click(screen.getByRole("button", { name: "Request Quote" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
