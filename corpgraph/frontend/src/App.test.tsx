import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import cytoscape, { type CytoscapeOptions } from "cytoscape";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";

const graph = vi.hoisted(() => ({
  destroy: vi.fn(),
  on: vi.fn(),
  fit: vi.fn(),
  resize: vi.fn(),
  png: vi.fn(() => "data:image/png;base64,test"),
}));
vi.mock("cytoscape", () => ({ default: vi.fn(() => graph) }));

const companyDefaults = {
  jurisdiction: null,
  registration_num: null,
  sources: [],
  aliases: [],
  entity_type: null,
  status: null,
  incorporation_date: null,
  cik: null,
  lei: null,
  website: null,
  industry: null,
  headquarters: null,
  employee_count: null,
  revenue_usd: null,
  description: null,
  deduplication_confidence: null,
  risk_flags: [],
  filing_references: [],
};
const parent = {
  ...companyDefaults,
  entity_id: "demo_atlas_meridian_root",
  name: "Atlas Parent",
  entity_type: "Public Company",
  industry: "Technology",
  revenue_usd: 8_500_000_000,
  sources: ["demo_seed"],
  risk_flags: ["CROSS_BORDER_STRUCTURE"],
};
const child = {
  ...companyDefaults,
  entity_id: "child",
  name: "Atlas Child",
  jurisdiction: "US-DE",
  registration_num: "123",
  entity_type: "Subsidiary",
  sources: ["demo_seed"],
  risk_flags: ["MINORITY_OWNERSHIP"],
};
const parentNode = {
  id: parent.entity_id,
  label: parent.name,
  category: "Company",
  entity_type: parent.entity_type,
  jurisdiction: parent.jurisdiction,
  industry: parent.industry,
  title: null,
  board_seats: 0,
  confidence: 0.99,
  risk_flags: parent.risk_flags,
  attributes: { ...parent, registration_number: parent.registration_num },
};
const childNode = {
  id: child.entity_id,
  label: child.name,
  category: "Subsidiary",
  entity_type: child.entity_type,
  jurisdiction: child.jurisdiction,
  industry: child.industry,
  title: null,
  board_seats: 0,
  confidence: 0.95,
  risk_flags: child.risk_flags,
  attributes: { ...child, registration_number: child.registration_num },
};
const officerNode = {
  id: "person-1",
  label: "Maya Chen",
  category: "Person",
  entity_type: "Person",
  jurisdiction: null,
  industry: null,
  title: "Board Chair",
  board_seats: 3,
  confidence: null,
  risk_flags: ["INTERLOCKING_DIRECTOR"],
  attributes: { sources: ["demo_seed"] },
};
const ownership = {
  id: "one",
  source: parent.entity_id,
  target: child.entity_id,
  type: "HAS_SUBSIDIARY",
  label: "Has Subsidiary",
  ownership_percentage: 75,
  confidence: 0.97,
  officer_title: null,
  effective_from: "2021-01-01",
  effective_to: null,
  is_current: true,
  risk_flags: [],
  filing_reference: "DEMO-EX21",
  properties: {},
};
const directorship = {
  ...ownership,
  id: "two",
  source: officerNode.id,
  target: parent.entity_id,
  type: "DIRECTOR_OF",
  label: "Director Of",
  ownership_percentage: null,
  officer_title: "Board Chair",
};
const network = {
  center: parent,
  related: [],
  nodes: [parentNode, childNode, officerNode],
  links: [ownership, directorship],
  summary: {
    companies: 2,
    people: 1,
    subsidiaries: 1,
    jurisdictions: 1,
    flagged_nodes: 3,
    interlocking_directors: 1,
    average_confidence: 0.97,
  },
  depth: 2,
  total_nodes: 3,
  total_relationships: 2,
};

let fetchMock: ReturnType<typeof vi.fn>;
let resize: () => void;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe(): void {}
      disconnect(): void {}
    },
  );
  fetchMock = vi.fn(async (path: string) => ({
    ok: true,
    json: async () =>
      path === "/api/stats"
        ? { companies: 510, people: 60, relationships: 740 }
        : path.startsWith("/api/search")
          ? [child]
          : network,
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    () => undefined,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function eventHandler(
  selector: "node" | "edge",
): (event: { target: { id: () => string } }) => void {
  return graph.on.mock.calls.find((call) => call[1] === selector)![2];
}

it("turns a search result into a rich, filterable investigation", async () => {
  render(<App />);
  expect(await screen.findByText("570 entities · 740 links")).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: /Export JSON/ })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("Company, registration or alias"), {
    target: { value: "Atlas" },
  });
  fireEvent.click(await screen.findByRole("button", { name: /Atlas Child/ }));
  expect(
    await screen.findByRole("heading", { name: "Atlas Parent" }),
  ).toBeTruthy();
  expect(screen.getByText("97.0%")).toBeTruthy();
  const options = vi
    .mocked(cytoscape)
    .mock.calls.at(-1)![0] as unknown as CytoscapeOptions;
  const elements = options.elements;
  expect(elements).toEqual(
    expect.arrayContaining([
      {
        data: {
          id: "edge:one",
          source: parent.entity_id,
          target: child.entity_id,
          label: "75%",
          type: "HAS_SUBSIDIARY",
        },
      },
    ]),
  );
  const dynamic = options as unknown as {
    layout: { nodeRepulsion: () => number; idealEdgeLength: () => number };
    style: Array<{ style: Record<string, unknown> }>;
  };
  expect(dynamic.layout.nodeRepulsion()).toBe(6200);
  expect(dynamic.layout.idealEdgeLength()).toBe(105);
  const color = dynamic.style[0].style["background-color"] as (element: {
    data: (key: string) => string;
  }) => string;
  expect(color({ data: () => "Person" })).toBe("#f5b942");
  act(() => resize());
  expect(graph.resize).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Fit view" }));
  fireEvent.click(screen.getByRole("button", { name: /Risk only/ }));
  fireEvent.change(screen.getByLabelText("Depth"), { target: { value: "3" } });
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("depth=3")),
    ).toBe(true),
  );
  fireEvent.change(screen.getByLabelText("Relationship"), {
    target: { value: "DIRECTOR_OF" },
  });
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("relationship_type=DIRECTOR_OF"),
      ),
    ).toBe(true),
  );
});

it("inspects nodes and relationships and exports both formats", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open investigation" }));
  expect(
    await screen.findByRole("heading", { name: "Atlas Parent" }),
  ).toBeTruthy();
  act(() => eventHandler("node")({ target: { id: () => officerNode.id } }));
  expect(screen.getByRole("heading", { name: "Maya Chen" })).toBeTruthy();
  expect(screen.getByText("Board Chair")).toBeTruthy();
  act(() => eventHandler("edge")({ target: { id: () => "edge:one" } }));
  expect(screen.getByRole("heading", { name: "Has Subsidiary" })).toBeTruthy();
  expect(screen.getByText("DEMO-EX21")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Export JSON/ }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  fireEvent.click(screen.getByRole("button", { name: /Export PNG/ }));
  expect(graph.png).toHaveBeenCalled();
  act(() => eventHandler("node")({ target: { id: () => childNode.id } }));
  fireEvent.click(
    screen.getByRole("button", { name: "Re-center investigation" }),
  );
});

it("handles missing graph selections and empty optional data", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Load Atlas Meridian/ }));
  await screen.findByRole("heading", { name: "Atlas Parent" });
  act(() => eventHandler("node")({ target: { id: () => "missing" } }));
  expect(screen.getByText(/Select a graph node/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Company, registration or alias"), {
    target: { value: "" },
  });
  expect(screen.getByText("Enter at least two characters.")).toBeTruthy();
});

it.each(["stats", "search", "network"])(
  "reports %s HTTP failures",
  async (stage) => {
    fetchMock.mockImplementation(async (path: string) => ({
      ok: !(stage === "stats"
        ? path === "/api/stats"
        : stage === "search"
          ? path.startsWith("/api/search")
          : path.includes("/relationships")),
      status: 503,
      json: async () =>
        path === "/api/stats"
          ? { companies: 510, people: 60, relationships: 740 }
          : {},
    }));
    render(<App />);
    if (stage === "search")
      fireEvent.change(
        screen.getByLabelText("Company, registration or alias"),
        { target: { value: "fail" } },
      );
    if (stage === "network")
      fireEvent.click(
        screen.getByRole("button", { name: "Open investigation" }),
      );
    expect((await screen.findByRole("alert")).textContent).toContain("503");
  },
);

it("cancels outstanding requests when the view closes", async () => {
  fetchMock.mockImplementation(
    (_path: string, options: RequestInit) =>
      new Promise((_resolve, reject) =>
        options.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      ),
  );
  const view = render(<App />);
  fireEvent.change(screen.getByLabelText("Company, registration or alias"), {
    target: { value: "pending" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open investigation" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await act(async () => view.unmount());
});
