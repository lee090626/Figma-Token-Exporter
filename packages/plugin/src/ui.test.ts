import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExports } from "./exportVariables.js";

const html = readFileSync(new URL("./ui.html", import.meta.url), "utf8");
const code = readFileSync(new URL("./code.ts", import.meta.url), "utf8");
const uiMessageStart = code.indexOf("type UiMessage");
const uiMessageUnion = code.slice(uiMessageStart, code.indexOf("\n\n", uiMessageStart));

describe("plugin ↔ UI message contract", () => {
  it("UI handles every message type code.ts posts", () => {
    const posted = new Set([...code.replace(uiMessageUnion, "").matchAll(/type: "([a-z-]+)"/g)].map((match) => match[1]));
    expect(posted.size).toBeGreaterThan(0);
    for (const type of posted) expect(html.includes(`message.type === "${type}"`), `ui.html does not handle "${type}"`).toBe(true);
  });

  it("code.ts accepts every message type the UI posts", () => {
    const accepted = new Set([...uiMessageUnion.matchAll(/type: "([a-z-]+)"/g)].map((match) => match[1]));
    const sent = new Set([...html.matchAll(/pluginMessage: \{ type: "([a-z-]+)"/g)].map((match) => match[1]));
    expect(sent.size).toBeGreaterThan(0);
    for (const type of sent) expect(accepted, `code.ts UiMessage lacks "${type}"`).toContain(type);
  });
});

type PluginMessage = { type: string; requestId?: number; [key: string]: unknown };

const doms: JSDOM[] = [];

// Loads ui.html as Figma would host it; parent.postMessage is stubbed so UI → plugin messages are recorded, not looped back.
function openUi() {
  const sent: PluginMessage[] = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "parent", { value: { postMessage: (data: { pluginMessage: PluginMessage }) => sent.push(data.pluginMessage) } });
    }
  });
  doms.push(dom);
  const { window } = dom;
  const $ = (id: string) => {
    const element = window.document.getElementById(id);
    if (!element) throw new Error(`#${id} not found`);
    return element;
  };
  const receive = (pluginMessage: PluginMessage) => window.dispatchEvent(new window.MessageEvent("message", { data: { pluginMessage } }));
  const lastSent = (type: string) => sent.filter((message) => message.type === type).at(-1);
  return { window, $, sent, receive, lastSent };
}

const exportsMessage = (requestId: number | undefined) => ({
  type: "exports",
  requestId,
  baselineSavedAt: null,
  ...createExports(
    [{ id: "c", name: "Brand", modes: [{ modeId: "light", name: "Light" }] }],
    [{ id: "v", name: "spacing/base", description: "", variableCollectionId: "c", resolvedType: "FLOAT", valuesByMode: { light: 8 } }]
  )
});

afterEach(() => {
  vi.useRealTimers();
  for (const dom of doms.splice(0)) dom.window.close();
});

describe("plugin UI", () => {
  it("starts loading, asks for data, then shows exported tokens", () => {
    const ui = openUi();
    expect(ui.$("loading").hidden).toBe(false);
    const ready = ui.lastSent("ui-ready");
    expect(ready).toBeDefined();

    ui.receive(exportsMessage(ready?.requestId));

    expect(ui.$("loading").hidden).toBe(true);
    expect(ui.$("error").hidden).toBe(true);
    expect(ui.$("tokenCount").textContent).toBe("1");
    expect(ui.$("view-tokens").hidden).toBe(false);
  });

  it("shows an export error and retries through refresh", () => {
    const ui = openUi();
    ui.receive({ type: "error", requestId: ui.lastSent("ui-ready")?.requestId, message: "boom" });
    expect(ui.$("error").hidden).toBe(false);
    expect(ui.$("errorText").textContent).toBe("오류: boom");

    ui.$("retry").click();
    const refresh = ui.lastSent("refresh");
    expect(refresh?.requestId).toBeGreaterThan(0);
    expect(ui.$("loading").hidden).toBe(false);

    ui.receive(exportsMessage(refresh?.requestId));
    expect(ui.$("error").hidden).toBe(true);
    expect(ui.$("tokenCount").textContent).toBe("1");
  });

  it("drops replies to a superseded request", () => {
    const ui = openUi();
    const stale = ui.lastSent("ui-ready")?.requestId;
    ui.$("refresh").click();
    ui.receive({ type: "error", requestId: stale, message: "old" });
    expect(ui.$("error").hidden).toBe(true);
  });

  it("selection: analyzing, then none or unsupported from manifest-none", () => {
    vi.useFakeTimers();
    const ui = openUi();
    ui.receive({ type: "selection-changed" });
    vi.advanceTimersByTime(300);
    const read = ui.lastSent("read-selection");
    expect(read).toBeDefined();
    expect(ui.$("selectionEmptyTitle").textContent).toBe("선택한 항목을 분석하고 있어요");

    ui.receive({ type: "manifest-none", requestId: read?.requestId, selected: 1 });
    expect(ui.$("selectionEmptyTitle").textContent).toBe("분석할 수 없는 항목이에요");

    ui.receive({ type: "manifest-none", requestId: read?.requestId, selected: 0 });
    expect(ui.$("selectionEmptyTitle").textContent).toBe("선택한 항목이 없어요");
  });
});

describe("components view", () => {
  const manifest = { kind: "componentSets", filename: "component-sets.json", file: "{}\n", count: 2, variableCount: 5 };

  it("shows page components on open without a selection", () => {
    const ui = openUi();
    expect(ui.$("componentsEmptyTitle").textContent).toBe("컴포넌트를 분석하고 있어요");
    ui.receive({ type: "page-components", requestId: ui.lastSent("ui-ready")?.requestId, page: "Page 1", manifests: [manifest] });

    expect(ui.$("componentsEmpty").hidden).toBe(true);
    expect(ui.$("componentsDownloads").textContent).toBe("2개 Component Set · 5개 Variable 다운로드");
    expect(ui.$("componentsCount").textContent).toBe("2");
  });

  it("re-reads on page change and shows the empty and error states", () => {
    const ui = openUi();
    ui.receive({ type: "page-changed" });
    const read = ui.lastSent("read-components");
    expect(read?.requestId).toBeGreaterThan(0);

    ui.receive({ type: "page-components", requestId: read?.requestId, page: "Icons", manifests: [] });
    expect(ui.$("componentsEmptyTitle").textContent).toBe("이 페이지에 컴포넌트가 없어요");
    expect(ui.$("componentsEmptyText").textContent).toContain("\"Icons\" 페이지에");

    ui.receive({ type: "page-components-error", requestId: read?.requestId, message: "boom" });
    expect(ui.$("componentsEmptyTitle").textContent).toBe("컴포넌트를 분석하지 못했어요");
    expect(ui.$("componentsErrors").textContent).toContain("컴포넌트 분석 결과를 만들지 못했습니다");
  });

  it("ignores components replies for an older page", () => {
    const ui = openUi();
    const stale = ui.lastSent("ui-ready")?.requestId;
    ui.receive({ type: "page-changed" });
    ui.receive({ type: "page-components", requestId: stale, page: "Old", manifests: [manifest] });
    expect(ui.$("componentsDownloads").children.length).toBe(0);
  });
});
