import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleDetailDto } from "../../src/types/catalog";

class MockApiRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
vi.mock("../../src/lib/api/configurations", () => ({ ApiRequestError: MockApiRequestError }));

const createLiveSessionMock = vi.fn();
vi.mock("../../src/lib/api/liveSessions", () => ({
  createLiveSession: (...args: unknown[]) => createLiveSessionMock(...args),
  liveSessionSocketUrl: (id: string) => `ws://api.test/ws/live-sessions/${id}`,
  LIVE_COLLAB_ENABLED: true,
}));

const { LiveSessionPanel } = await import("../../src/components/showroom/LiveSession/LiveSessionPanel");
const { StartLiveSession } = await import("../../src/components/showroom/LiveSession/StartLiveSession");
const { ToastProvider } = await import("../../src/components/shell/ToastProvider");
const { useLiveSessionStore } = await import("../../src/state/liveSessionStore");
const { useConfigurationStore } = await import("../../src/state/configurationStore");

const vehicle = { slug: "apex-gt", name: "Apex GT" } as unknown as VehicleDetailDto;
const SESSION = "SESSION1234567890";
const INITIAL = useLiveSessionStore.getState();

function renderPanel() {
  return render(
    <ToastProvider>
      <LiveSessionPanel vehicle={vehicle} sessionId={SESSION} />
    </ToastProvider>,
  );
}

describe("LiveSessionPanel (Spec 33)", () => {
  const connect = vi.fn();
  const leave = vi.fn();

  beforeEach(() => {
    connect.mockReset();
    leave.mockReset();
    useLiveSessionStore.setState({ ...INITIAL, connect, leave }, true);
    localStorage.clear();
    sessionStorage.clear();
  });

  it("someone arriving by link picks a name and joins (AC-2, AC-8)", () => {
    renderPanel();
    expect(connect).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "  Sam " } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(connect).toHaveBeenCalledWith(SESSION, "Sam");
    expect(localStorage.getItem("apex-live-name")).toBe("Sam");
  });

  it("joining with no name is fine — they're a Guest", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(connect).toHaveBeenCalledWith(SESSION, "Guest");
  });

  it("whoever started or joined in this tab rejoins without the join card", () => {
    sessionStorage.setItem(`apex-live-joined:${SESSION}`, "1");
    localStorage.setItem("apex-live-name", "Alex");
    renderPanel();
    expect(connect).toHaveBeenCalledWith(SESSION, "Alex");
    expect(screen.queryByRole("button", { name: "Join" })).not.toBeInTheDocument();
  });

  it("shows Joining… then who's here, with colors and (you) (AC-2)", () => {
    useLiveSessionStore.setState({ status: "connecting", sessionId: SESSION });
    renderPanel();
    expect(screen.getByTestId("live-status")).toHaveTextContent("Joining session…");

    act(() =>
      useLiveSessionStore.setState({
        status: "connected",
        participantId: "me",
        participants: [
          { id: "me", displayName: "Alex", color: "#60a5fa" },
          { id: "sam", displayName: "Sam", color: "#f472b6" },
        ],
      }),
    );
    const list = screen.getByTestId("live-participants");
    expect(list).toHaveTextContent("Alex(you)");
    expect(list).toHaveTextContent("Sam");
    expect(screen.getByTestId("live-status")).toHaveTextContent("");
  });

  it("shows Reconnecting… after a network drop", () => {
    useLiveSessionStore.setState({ status: "reconnecting", sessionId: SESSION });
    renderPanel();
    expect(screen.getByTestId("live-status")).toHaveTextContent("Reconnecting…");
  });

  it("announces the partner's changes (Spec 33 Risk #3)", async () => {
    useLiveSessionStore.setState({ status: "connected", sessionId: SESSION, participantId: "me" });
    renderPanel();
    act(() =>
      useLiveSessionStore.setState({
        lastRemoteChange: { participantId: "sam", displayName: "Sam", change: { kind: "select", category: "WHEELS", optionId: "w" }, seq: 1 },
      }),
    );
    expect(await screen.findByText("Sam changed the Wheels")).toBeInTheDocument();
  });

  it("links to the partner's saved build (AC-5)", () => {
    useLiveSessionStore.setState({ status: "connected", sessionId: SESSION, lastSaved: { displayName: "Sam", publicId: "APEX-SAVE-0001" } });
    renderPanel();
    expect(screen.getByTestId("live-saved")).toHaveTextContent("Sam saved this build");
    expect(screen.getByRole("link", { name: "Open saved build" })).toHaveAttribute("href", "/configure/apex-gt?build=APEX-SAVE-0001");
  });

  it.each([
    ["expired", "This live session closed after 30 minutes without activity."],
    ["notFound", "This live session has ended or the link is wrong."],
    ["full", "This live session is full."],
    ["replaced", "This session is open in another tab."],
  ])("explains an ended session (%s) and offers a new one", (endReason, text) => {
    useLiveSessionStore.setState({ status: "ended", endReason: endReason as never, sessionId: SESSION });
    renderPanel();
    expect(screen.getByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: "Start Live Session" })).toBeInTheDocument();
  });

  it("Leave disconnects, and Rejoin reconnects", () => {
    useLiveSessionStore.setState({ status: "connected", sessionId: SESSION });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(leave).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Rejoin" }));
    expect(connect).toHaveBeenCalledWith(SESSION, "Guest");
  });

  it("copies the invite link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    useLiveSessionStore.setState({ status: "connected", sessionId: SESSION });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Copy Invite Link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    expect(await screen.findByText("Invite link copied")).toBeInTheDocument();
  });
});

describe("StartLiveSession (Spec 33, AC-1)", () => {
  const assign = vi.fn();

  beforeEach(() => {
    createLiveSessionMock.mockReset();
    assign.mockReset();
    vi.stubGlobal("location", { ...window.location, assign });
    sessionStorage.clear();
    useConfigurationStore.setState({
      singleSelections: { PAINT: "p", WHEELS: "w" } as never,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
      customPaintHex: null,
      environmentId: null,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts a session from the current build and moves onto its link", async () => {
    createLiveSessionMock.mockResolvedValue({ sessionId: SESSION, vehicleSlug: "apex-gt", participantCount: 0 });
    render(<StartLiveSession vehicle={vehicle} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Live Session" }));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Live Session" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(`/configure/apex-gt/live/${SESSION}`));
    expect(createLiveSessionMock).toHaveBeenCalledWith({
      vehicleSlug: "apex-gt",
      singleSelections: { PAINT: "p", WHEELS: "w" },
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
      customPaintHex: null,
      environmentId: null,
    });
    expect(sessionStorage.getItem(`apex-live-joined:${SESSION}`)).toBe("1");
  });

  it.each([
    ["LIVE_SESSIONS_FULL", "Too many live sessions are running. Try again later."],
    ["LIVE_COLLAB_DISABLED", "Live sessions are turned off right now."],
    ["RATE_LIMITED", "Too many requests. Please wait a moment and try again."],
  ])("says why it couldn't start (%s), and stays put", async (code, message) => {
    createLiveSessionMock.mockRejectedValue(new MockApiRequestError(code, "raw server text"));
    render(<StartLiveSession vehicle={vehicle} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Live Session" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Live Session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(assign).not.toHaveBeenCalled();
  });

  it("a network failure gets the generic retry message", async () => {
    createLiveSessionMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<StartLiveSession vehicle={vehicle} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Live Session" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Live Session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t start a live session — try again.");
  });
});
