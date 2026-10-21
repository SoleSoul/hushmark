import { describe, expect, it } from "vitest";
import { isAppShortcut, SHORTCUTS } from "./shortcuts";

function keydown(
  key: string,
  modifiers: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">
  > = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  } as KeyboardEvent;
}

describe("isAppShortcut", () => {
  it("uses Control on Windows and Linux and Command on macOS", () => {
    expect(isAppShortcut(keydown("o", { ctrlKey: true }), SHORTCUTS.open, "windows")).toBe(true);
    expect(isAppShortcut(keydown("o", { metaKey: true }), SHORTCUTS.open, "windows")).toBe(false);
    expect(isAppShortcut(keydown("o", { metaKey: true }), SHORTCUTS.open, "macos")).toBe(true);
    expect(isAppShortcut(keydown("o", { ctrlKey: true }), SHORTCUTS.open, "macos")).toBe(false);
  });

  it("ignores letter case but rejects extra modifiers", () => {
    expect(isAppShortcut(keydown("P", { ctrlKey: true }), SHORTCUTS.print, "linux")).toBe(true);
    expect(
      isAppShortcut(keydown("p", { ctrlKey: true, shiftKey: true }), SHORTCUTS.print, "linux"),
    ).toBe(false);
    expect(
      isAppShortcut(keydown("p", { ctrlKey: true, altKey: true }), SHORTCUTS.print, "linux"),
    ).toBe(false);
  });

  it("accepts zoom in with or without Shift", () => {
    expect(isAppShortcut(keydown("=", { ctrlKey: true }), SHORTCUTS.zoomIn, "windows")).toBe(true);
    expect(
      isAppShortcut(keydown("+", { ctrlKey: true, shiftKey: true }), SHORTCUTS.zoomIn, "windows"),
    ).toBe(true);
  });

  it("requires Shift for the macOS Help shortcut", () => {
    expect(
      isAppShortcut(keydown("h", { metaKey: true, shiftKey: true }), SHORTCUTS.home, "macos"),
    ).toBe(true);
    expect(isAppShortcut(keydown("h", { metaKey: true }), SHORTCUTS.home, "macos")).toBe(false);
  });

  it("supports keyboard and dedicated browser keys for Back", () => {
    expect(isAppShortcut(keydown("ArrowLeft", { altKey: true }), SHORTCUTS.back, "linux")).toBe(true);
    expect(isAppShortcut(keydown("BrowserBack"), SHORTCUTS.back, "linux")).toBe(true);
    expect(isAppShortcut(keydown("ArrowLeft"), SHORTCUTS.back, "linux")).toBe(false);
  });
});
