import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GalleryEntryDto } from "../../src/types/gallery";

class MockApiRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

vi.mock("../../src/lib/api/configurations", () => ({ ApiRequestError: MockApiRequestError }));

const fetchGalleryMock = vi.fn();
vi.mock("../../src/lib/api/gallery", () => ({
  fetchGallery: (...args: unknown[]) => fetchGalleryMock(...args),
  galleryImageSrc: (path: string) => `http://api.test${path}`,
}));

const unpublishGalleryEntryMock = vi.fn();
vi.mock("../../src/lib/api/admin", () => ({
  unpublishGalleryEntry: (...args: unknown[]) => unpublishGalleryEntryMock(...args),
}));

const { GalleryModeration } = await import("../../src/components/admin/GalleryModeration");
const { useAdminGalleryStore } = await import("../../src/state/adminGalleryStore");
const INITIAL = useAdminGalleryStore.getState();

const ENTRY: GalleryEntryDto = {
  publicId: "APEX-AAAA-BBBB",
  vehicleSlug: "apex-gt",
  vehicleName: "Apex GT",
  captureImageUrl: "/api/gallery/APEX-AAAA-BBBB/image/0123456789abcdef.png",
  totalPriceCents: 8_500_000,
  currency: "EUR",
  likeCount: 1,
  weeklyLikeCount: 1,
  likedByMe: false,
  publishedAt: "2026-09-20T10:00:00.000Z",
};

describe("GalleryModeration (Spec 31, Risk #1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminGalleryStore.setState(INITIAL, true);
  });

  it("lists published builds newest first and takes one down", async () => {
    fetchGalleryMock.mockResolvedValue({ entries: [ENTRY], page: 1, pageSize: 24, hasMore: false });
    unpublishGalleryEntryMock.mockResolvedValue({ publicId: ENTRY.publicId, isPublished: false, publishedAt: null });
    render(<GalleryModeration />);

    const button = await screen.findByRole("button", { name: "Unpublish Apex GT build APEX-AAAA-BBBB" });
    expect(fetchGalleryMock).toHaveBeenCalledWith("recent", 1);
    expect(screen.getByText(/1 like$/)).toBeInTheDocument();

    fireEvent.click(button);
    expect(await screen.findByText("Nothing is published right now.")).toBeInTheDocument();
    expect(unpublishGalleryEntryMock).toHaveBeenCalledWith("APEX-AAAA-BBBB");
  });

  it("keeps the row and shows the error when the takedown fails", async () => {
    fetchGalleryMock.mockResolvedValue({ entries: [ENTRY], page: 1, pageSize: 24, hasMore: false });
    unpublishGalleryEntryMock.mockRejectedValue(new MockApiRequestError("CONFIGURATION_NOT_FOUND", "raw"));
    render(<GalleryModeration />);

    fireEvent.click(await screen.findByRole("button", { name: /Unpublish Apex GT/ }));
    expect(await screen.findByText("This build could not be found.")).toBeInTheDocument();
    expect(screen.getByText("Apex GT")).toBeInTheDocument();
  });

  it("shows a load error with Retry", async () => {
    fetchGalleryMock.mockRejectedValueOnce(new MockApiRequestError("RATE_LIMITED", "raw"));
    fetchGalleryMock.mockResolvedValueOnce({ entries: [], page: 1, pageSize: 24, hasMore: false });
    render(<GalleryModeration />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Nothing is published right now.")).toBeInTheDocument());
  });
});
