import { describe, expect, it } from "vitest";
import { NavigationHistory, parseHistoryState } from "./navigationHistory";
import type { NavigationView } from "./types";

function documentView(name: string): NavigationView {
  return {
    kind: "document",
    document: {
      path: `/docs/${name}.md`,
      navigationRoot: "/docs",
      fileName: `${name}.md`,
      html: "<p></p>",
      error: null,
    },
    fragment: null,
  };
}

function goTo(history: NavigationHistory, entryId: number): void {
  const lookup = history.lookup(history.stateFor(entryId));
  if (lookup.kind !== "entry") {
    throw new Error(`entry ${entryId} is not reachable`);
  }
  history.activate(lookup.entry);
}

describe("NavigationHistory", () => {
  it("starts empty", () => {
    const history = new NavigationHistory();

    expect(history.activeEntry).toBeNull();
    expect(history.activeEntryId).toBeNull();
    expect(history.canGoBack).toBe(false);
    expect(history.canGoForward).toBe(false);
  });

  it("tracks Back and Forward availability as entries are pushed and visited", () => {
    const history = new NavigationHistory();
    const first = history.reset(documentView("first"));
    const second = history.push(documentView("second"));

    expect(history.activeEntry).toBe(second);
    expect(history.canGoBack).toBe(true);
    expect(history.canGoForward).toBe(false);

    goTo(history, first.id);

    expect(history.activeEntry).toBe(first);
    expect(history.canGoBack).toBe(false);
    expect(history.canGoForward).toBe(true);
  });

  it("discards Forward entries when pushing from the middle of history", () => {
    const history = new NavigationHistory();
    history.reset(documentView("first"));
    const second = history.push(documentView("second"));
    const third = history.push(documentView("third"));

    goTo(history, second.id);
    const home = history.push({ kind: "home" });

    expect(history.activeEntry).toBe(home);
    expect(history.canGoForward).toBe(false);
    expect(history.lookup(history.stateFor(third.id))).toEqual({ kind: "foreign" });
  });

  it("starts each entry without a saved position", () => {
    const history = new NavigationHistory();
    const entry = history.reset({ kind: "home" });

    expect(entry.scrollY).toBe(0);
    expect(entry.readingPosition).toBeNull();
  });

  it("assigns unique entry ids across sessions", () => {
    const history = new NavigationHistory();
    const first = history.reset(documentView("first"));
    const second = history.reset(documentView("second"));

    expect(second.id).not.toBe(first.id);
  });

  it("recognizes the active entry", () => {
    const history = new NavigationHistory();
    const entry = history.reset(documentView("first"));

    expect(history.lookup(history.stateFor(entry.id))).toEqual({ kind: "active" });
  });

  it("rejects history states from a previous session", () => {
    const history = new NavigationHistory();
    const first = history.reset(documentView("first"));
    history.push(documentView("second"));
    const staleState = history.stateFor(first.id);

    history.reset(documentView("third"));

    expect(history.lookup(staleState)).toEqual({ kind: "foreign" });
    expect(history.canGoBack).toBe(false);
  });

  it("rejects history states that Hushmark did not create", () => {
    const history = new NavigationHistory();
    history.reset(documentView("first"));

    expect(history.lookup(null)).toEqual({ kind: "foreign" });
    expect(history.lookup("hushmark")).toEqual({ kind: "foreign" });
    expect(history.lookup({ kind: "other", sessionId: 1, entryId: 1 })).toEqual({
      kind: "foreign",
    });
    expect(history.lookup(history.stateFor(999))).toEqual({ kind: "foreign" });
  });
});

describe("parseHistoryState", () => {
  it("keeps only the Hushmark navigation fields", () => {
    expect(
      parseHistoryState({
        kind: "hushmark-navigation",
        sessionId: 2,
        entryId: 5,
        extra: "ignored",
      }),
    ).toEqual({ kind: "hushmark-navigation", sessionId: 2, entryId: 5 });
  });

  it("rejects malformed states", () => {
    expect(parseHistoryState(undefined)).toBeNull();
    expect(parseHistoryState(42)).toBeNull();
    expect(
      parseHistoryState({ kind: "hushmark-navigation", sessionId: "2", entryId: 5 }),
    ).toBeNull();
    expect(parseHistoryState({ kind: "hushmark-navigation", sessionId: 2 })).toBeNull();
  });
});
