import type {
  HushmarkHistoryState,
  NavigationEntry,
  NavigationView,
} from "./types";

export type HistoryStateLookup =
  | { kind: "foreign" }
  | { kind: "active" }
  | { kind: "entry"; entry: NavigationEntry };

// Hushmark's own Back/Forward list. It mirrors the WebView history entries it
// creates, so the caller remains responsible for pushState/replaceState.
export class NavigationHistory {
  private readonly entries = new Map<number, NavigationEntry>();
  private order: number[] = [];
  private activeIndex = -1;
  private activeId: number | null = null;
  private sessionId = 0;
  private nextEntryId = 1;

  get activeEntryId(): number | null {
    return this.activeId;
  }

  get activeEntry(): NavigationEntry | null {
    return this.activeId === null ? null : this.entries.get(this.activeId) ?? null;
  }

  get canGoBack(): boolean {
    return this.activeIndex > 0;
  }

  get canGoForward(): boolean {
    return this.activeIndex < this.order.length - 1;
  }

  // Starts a new navigation session whose only entry is the given view.
  reset(view: NavigationView): NavigationEntry {
    this.sessionId += 1;
    this.entries.clear();
    this.order = [];
    return this.append(view);
  }

  // Adds a view after the active entry, discarding any Forward entries.
  push(view: NavigationView): NavigationEntry {
    for (const staleEntryId of this.order.slice(this.activeIndex + 1)) {
      this.entries.delete(staleEntryId);
    }
    this.order = this.order.slice(0, this.activeIndex + 1);
    return this.append(view);
  }

  lookup(state: unknown): HistoryStateLookup {
    const parsed = parseHistoryState(state);
    if (!parsed || parsed.sessionId !== this.sessionId) {
      return { kind: "foreign" };
    }

    if (parsed.entryId === this.activeId) {
      return { kind: "active" };
    }

    const entry = this.entries.get(parsed.entryId);
    if (!entry || !this.order.includes(parsed.entryId)) {
      return { kind: "foreign" };
    }

    return { kind: "entry", entry };
  }

  activate(entry: NavigationEntry): void {
    const index = this.order.indexOf(entry.id);
    if (index === -1) {
      return;
    }

    this.activeId = entry.id;
    this.activeIndex = index;
  }

  stateFor(entryId: number): HushmarkHistoryState {
    return {
      kind: "hushmark-navigation",
      sessionId: this.sessionId,
      entryId,
    };
  }

  private append(view: NavigationView): NavigationEntry {
    const entry: NavigationEntry = {
      id: this.nextEntryId,
      view,
      scrollY: 0,
      readingPosition: null,
    };
    this.nextEntryId += 1;

    this.entries.set(entry.id, entry);
    this.order.push(entry.id);
    this.activeId = entry.id;
    this.activeIndex = this.order.length - 1;
    return entry;
  }
}

export function parseHistoryState(state: unknown): HushmarkHistoryState | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const candidate = state as Partial<HushmarkHistoryState>;
  if (
    candidate.kind !== "hushmark-navigation" ||
    typeof candidate.sessionId !== "number" ||
    typeof candidate.entryId !== "number"
  ) {
    return null;
  }

  return {
    kind: candidate.kind,
    sessionId: candidate.sessionId,
    entryId: candidate.entryId,
  };
}
