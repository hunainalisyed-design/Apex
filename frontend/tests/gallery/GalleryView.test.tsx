import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GalleryEntryDto, GalleryPageDto } from "../../src/types/gallery";

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
const toggleLikeMock = vi.fn();
vi.mock("../../src/lib/api/gallery", () => ({
  fetchGallery: (...args: unknown[]) => fetchGalleryMock(...args),
  toggleLike: (...args: unknown[]) => toggleLikeMock(...args),
  galleryImageSrc: (path: string) => `http://api.test${path}`,
}));

const { GalleryView } = await import("../../src/components/gallery/GalleryView");
const { ToastProvider } = await import("../../src/components/shell/ToastProvider");
const { useAuthStore } = await import("../../src/state/authStore");
const { useGalleryStore } = await import("../../src/state/galleryStore");

const USER = { id: "user-1", name: "Ada", email: "ada@example.com", role: "USER" as const, createdAt: "2026-01-01T00:00:00.000Z" };
const INITIAL_GALLERY = useGalleryStore.getState();

function makeEntry(overrides: Partial<GalleryEntryDto> = {}): GalleryEntryDto {
  return {
    publicId: "APEX-AAAA-BBBB",
    vehicleSlug: "apex-gt",
    vehicleName: "Apex GT",
    captureImageUrl: "/api/gallery/APEX-AAAA-BBBB/image/0123456789abcdef.png",
    totalPriceCents: 8_500_000,
    currency: "EUR",
    likeCount: 2,
    weeklyLikeCount: 1,
    likedByMe: false,
    publishedAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  };
}

function pageOf(entries: GalleryEntryDto[], hasMore = false, page = 1): GalleryPageDto {
  return { entries, page, pageSize: 24, hasMore };
}

function renderGallery() {
  return render(
    <ToastProvider>
      <GalleryView configureHref="/configure/apex-gt" />
    </ToastProvider>,
  );
}

describe("GalleryView (Spec 31)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGalleryStore.setState(INITIAL_GALLERY, true);
    useAuthStore.setState({ user: null, hydrated: true });
  });

  it("shows skeleton cards while loading", () => {
    fetchGalleryMock.mockReturnValue(new Promise(() => {}));
    renderGallery();
    expect(screen.getAllByTestId("gallery-skeleton").length).toBeGreaterThan(0);
  });

  it("waits for auth to hydrate before loading, so likedByMe reflects the viewer", async () => {
    useAuthStore.setState({ user: null, hydrated: false });
    fetchGalleryMock.mockResolvedValue(pageOf([]));
    renderGallery();
    expect(fetchGalleryMock).not.toHaveBeenCalled();

    useAuthStore.setState({ user: USER, hydrated: true });
    await waitFor(() => expect(fetchGalleryMock).toHaveBeenCalledWith("recent", 1));
  });

  it("lists published builds with image, vehicle name and like count (AC-2)", async () => {
    fetchGalleryMock.mockResolvedValue(pageOf([makeEntry()]));
    renderGallery();

    const card = await screen.findByTestId("gallery-card");
    expect(within(card).getByRole("img", { name: "Apex GT build" })).toHaveAttribute(
      "src",
      "http://api.test/api/gallery/APEX-AAAA-BBBB/image/0123456789abcdef.png",
    );
    expect(within(card).getByRole("heading", { name: "Apex GT" })).toBeInTheDocument();
    expect(within(card).getByTestId("like-count")).toHaveTextContent("2 likes");
    expect(within(card).getByRole("link", { name: "View Build" })).toHaveAttribute(
      "href",
      "/configure/apex-gt?build=APEX-AAAA-BBBB",
    );
  });

  it("empty: invites the visitor to be the first, linking into the configurator", async () => {
    fetchGalleryMock.mockResolvedValue(pageOf([]));
    renderGallery();

    expect(await screen.findByText("No builds published yet — be the first!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Configuring" })).toHaveAttribute("href", "/configure/apex-gt");
  });

  it("error: shows the mapped message and retries", async () => {
    fetchGalleryMock.mockRejectedValueOnce(new MockApiRequestError("RATE_LIMITED", "x"));
    fetchGalleryMock.mockResolvedValueOnce(pageOf([makeEntry()]));
    renderGallery();

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("gallery-card")).toBeInTheDocument();
  });

  it("switches to Most Popular This Week (AC-2)", async () => {
    fetchGalleryMock.mockResolvedValue(pageOf([makeEntry()]));
    renderGallery();
    await screen.findByTestId("gallery-card");

    fireEvent.click(screen.getByRole("button", { name: "Most Popular This Week" }));
    await waitFor(() => expect(fetchGalleryMock).toHaveBeenLastCalledWith("popular", 1));
    expect(screen.getByRole("button", { name: "Most Popular This Week" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a slow response for the old sort never replaces the new sort's results", async () => {
    let resolveRecent: (page: GalleryPageDto) => void = () => {};
    fetchGalleryMock.mockReturnValueOnce(new Promise((resolve) => (resolveRecent = resolve)));
    fetchGalleryMock.mockResolvedValueOnce(pageOf([makeEntry({ publicId: "APEX-POPU-LAR1", vehicleName: "Popular" })]));
    renderGallery();

    fireEvent.click(screen.getByRole("button", { name: "Most Popular This Week" }));
    await screen.findByRole("heading", { name: "Popular" });
    resolveRecent(pageOf([makeEntry({ vehicleName: "Stale" })]));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("heading", { name: "Stale" })).not.toBeInTheDocument();
  });

  it("Load More appends the next page, skipping duplicates", async () => {
    fetchGalleryMock.mockResolvedValueOnce(pageOf([makeEntry()], true));
    fetchGalleryMock.mockResolvedValueOnce(
      pageOf([makeEntry(), makeEntry({ publicId: "APEX-CCCC-DDDD", vehicleName: "Apex EV" })], false, 2),
    );
    renderGallery();
    await screen.findByTestId("gallery-card");

    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    await screen.findByRole("heading", { name: "Apex EV" });
    expect(fetchGalleryMock).toHaveBeenLastCalledWith("recent", 2);
    expect(screen.getAllByTestId("gallery-card")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Load More" })).not.toBeInTheDocument();
  });

  it("a signed-out visitor who clicks Like is prompted to sign in (AC-4)", async () => {
    fetchGalleryMock.mockResolvedValue(pageOf([makeEntry()]));
    renderGallery();
    fireEvent.click(await screen.findByRole("button", { name: "Like this Apex GT build" }));

    const dialog = screen.getByRole("dialog", { name: "Sign in to like builds" });
    expect(within(dialog).getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/login?returnTo=/gallery");
    expect(toggleLikeMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Not Now" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a signed-in like is optimistic, then settles on the server's count (AC-3)", async () => {
    useAuthStore.setState({ user: USER, hydrated: true });
    fetchGalleryMock.mockResolvedValue(pageOf([makeEntry()]));
    let resolveLike: (value: { liked: boolean; likeCount: number }) => void = () => {};
    toggleLikeMock.mockReturnValue(new Promise((resolve) => (resolveLike = resolve)));
    renderGallery();

    const like = await screen.findByRole("button", { name: "Like this Apex GT build" });
    fireEvent.click(like);
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("like-count")).toHaveTextContent("3 likes");

    resolveLike({ liked: true, likeCount: 5 });
    await waitFor(() => expect(screen.getByTestId("like-count")).toHaveTextContent("5 likes"));
    expect(toggleLikeMock).toHaveBeenCalledWith("APEX-AAAA-BBBB");
  });

  it("a failed like is reverted and announced", async () => {
    useAuthStore.setState({ user: USER, hydrated: true });
    fetchGalleryMock.mockResolvedValue(pageOf([makeEntry({ likedByMe: true, likeCount: 1 })]));
    toggleLikeMock.mockRejectedValue(new MockApiRequestError("RATE_LIMITED", "x"));
    renderGallery();

    const like = await screen.findByRole("button", { name: "Like this Apex GT build" });
    expect(screen.getByTestId("like-count")).toHaveTextContent("1 like");
    fireEvent.click(like);

    expect(await screen.findByText("Couldn’t update your like — try again")).toBeInTheDocument();
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("like-count")).toHaveTextContent("1 like");
  });

  it("shows nothing the publisher typed or who they are (AC-5)", async () => {
    fetchGalleryMock.mockResolvedValue(pageOf([makeEntry()]));
    renderGallery();
    const card = await screen.findByTestId("gallery-card");
    expect(card).not.toHaveTextContent(USER.name);
    expect(card).not.toHaveTextContent(USER.email);
  });
});
