import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createTextElement } from "./dom";
import {
  applyDocumentViewPreferences,
  captureDocumentReadingPosition,
  DEFAULT_DOCUMENT_VIEW,
  DOCUMENT_ZOOM_STEP,
  resetDocumentZoom,
  restoreDocumentReadingPosition,
  toggledDocumentLayout,
  zoomedDocumentView,
} from "./documentView";
import type { DocumentViewPreferences } from "./documentView";
import { createHomeView } from "./homeView";
import { PRODUCT } from "./product";
import { renderSetup, WINDOWS_SETUP_TITLE } from "./setupView";
import { isControlShortcut, SHORTCUTS } from "./shortcuts";
import "./styles.css";
import type {
  HushmarkHistoryState,
  DocumentReadingPosition,
  LinkAction,
  LinkedDocument,
  LoadedDocument,
  NavigationEntry,
  NavigationView,
  PlatformCapabilities,
  SetupStatus,
  StartupView,
} from "./types";

type AppMode = "reader" | "setup";

const appElement = document.querySelector<HTMLElement>("#app");

if (!appElement) {
  throw new Error("Missing #app root element.");
}

const app = appElement;
const currentWindow = getCurrentWindow();
const navigationEntries = new Map<number, NavigationEntry>();
let currentDocument: LoadedDocument | null = null;
let currentMode: AppMode = "reader";
let platformCapabilities: PlatformCapabilities = { setup: false };
let filePickerOpen = false;
let activeNavigationEntryId: number | null = null;
let activeNavigationIndex = -1;
let navigationOrder: number[] = [];
let navigationSessionId = 0;
let nextNavigationEntryId = 1;
let documentViewPreferences: DocumentViewPreferences = {
  ...DEFAULT_DOCUMENT_VIEW,
};
let wheelZoomAccumulator = 0;

document.addEventListener("contextmenu", preventInternalContextMenu, {
  capture: true,
});
document.addEventListener("keydown", handleNavigationKeydown, {
  capture: true,
});
document.addEventListener("wheel", handleDocumentWheel, {
  capture: true,
  passive: false,
});
window.addEventListener("popstate", handleHistoryPopState);

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

function preventInternalContextMenu(event: MouseEvent): void {
  event.preventDefault();
}

function titleFor(documentView: LoadedDocument): string {
  if (documentView.error) {
    return documentView.fileName
      ? `Error: ${documentView.fileName} - ${PRODUCT.displayName}`
      : `Error - ${PRODUCT.displayName}`;
  }

  return documentView.fileName
    ? `${documentView.fileName} - ${PRODUCT.displayName}`
    : PRODUCT.displayName;
}

function renderState(
  kind: "empty" | "error" | "loading",
  heading: string,
  detail?: string,
): HTMLElement {
  const section = document.createElement("section");
  section.className = `state state--${kind}`;

  const content = document.createElement("div");
  content.className = "state__content";

  const title = document.createElement("h1");
  title.textContent = heading;
  content.append(title);

  if (detail) {
    const paragraph = document.createElement("p");
    paragraph.textContent = detail;
    content.append(paragraph);
  }

  section.append(content);
  app.replaceChildren(section);

  return section;
}

function renderDocument(
  documentView: LoadedDocument,
  options: {
    fragment?: string | null;
    readingPosition?: DocumentReadingPosition | null;
    scrollY?: number | null;
  } = {},
): void {
  currentMode = "reader";
  currentDocument = documentView;
  document.title = titleFor(documentView);

  if (documentView.error) {
    renderState("error", "This file could not be opened.", documentView.error);
    return;
  }

  if (!documentView.path && !documentView.html) {
    renderHome();
    return;
  }

  const article = document.createElement("article");
  article.className = "document";

  // The HTML is rendered and sanitized by Rust before it reaches the UI.
  article.innerHTML = documentView.html ?? "";
  article.addEventListener("click", handleDocumentLinkClick);

  app.replaceChildren(article);

  if (options.readingPosition) {
    restoreReadingPositionAfterRender(article, options.readingPosition);
  } else if (options.fragment) {
    scrollToFragmentAfterRender(options.fragment);
  } else if (options.scrollY !== undefined && options.scrollY !== null) {
    restoreScrollAfterRender(options.scrollY);
  }
}

function renderHome(scrollY = 0): void {
  currentMode = "reader";
  currentDocument = null;
  document.title = PRODUCT.displayName;

  const section = createHomeView();
  app.replaceChildren(section);
  if (platformCapabilities.setup) {
    void renderEmptySetupAffordance(section);
  }

  restoreScrollAfterRender(scrollY);
}

async function renderEmptySetupAffordance(section: HTMLElement): Promise<void> {
  let status: SetupStatus;

  try {
    status = await invoke<SetupStatus>("get_setup_status");
  } catch (error) {
    console.warn("failed to get setup status", error);
    return;
  }

  if (!section.isConnected || currentMode !== "reader" || currentDocument?.path) {
    return;
  }

  const label = emptySetupActionLabel(status);
  const className = `view-corner-action${label === "Setup" ? " view-corner-action--quiet" : ""}`;
  const button = createTextElement("button", label, className);
  button.type = "button";
  button.addEventListener("click", () => {
    openSetupFromEmptyState(status);
  });

  section.append(button);
}

function emptySetupActionLabel(status: SetupStatus): string {
  switch (status.installAction) {
    case "install":
      return "Install";
    case "update":
      return "Update";
    case "downgrade":
      return "Downgrade";
    case "reinstall":
      return "Reinstall";
    default:
      return "Setup";
  }
}

function openSetupFromEmptyState(status: SetupStatus): void {
  currentMode = "setup";
  document.title = WINDOWS_SETUP_TITLE;
  void currentWindow.setTitle(WINDOWS_SETUP_TITLE).catch((error) => {
    console.warn("failed to set setup window title", error);
  });
  renderSetup(app, status, { onBackToHome: returnToHomeFromSetup });
}

function returnToHomeFromSetup(): void {
  currentMode = "reader";
  void currentWindow.setTitle(PRODUCT.displayName).catch((error) => {
    console.warn("failed to restore window title", error);
  });
  pushHomeNavigation();
}

function handleDocumentLinkClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link) {
    return;
  }

  const action = classifyDocumentLink(link.getAttribute("href"));
  if (action.kind === "internal") {
    event.preventDefault();
    pushSameDocumentFragmentNavigation(action.fragment);
    return;
  }

  event.preventDefault();

  if (action.kind === "external") {
    void openExternalLink(action.url);
  } else if (action.kind === "document") {
    void openLinkedDocument(action.href);
  }
}

function classifyDocumentLink(href: string | null): LinkAction {
  const value = href?.trim();
  if (!value) {
    return { kind: "unsupported" };
  }

  if (value.startsWith("#")) {
    return { kind: "internal", fragment: value };
  }

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  const scheme = schemeMatch?.[1]?.toLowerCase();

  if (
    (scheme === "http" || scheme === "https") &&
    /^https?:\/\/[^/?#].+/i.test(value)
  ) {
    return { kind: "external", url: value };
  }

  if (scheme === "mailto" && value.length > "mailto:".length) {
    return { kind: "external", url: value };
  }

  if (!scheme && isRelativeMarkdownHref(value)) {
    return { kind: "document", href: value };
  }

  return { kind: "unsupported" };
}

function isRelativeMarkdownHref(href: string): boolean {
  const [pathPart] = href.split("#", 1);
  if (!pathPart || pathPart.startsWith("/") || pathPart.startsWith("\\")) {
    return false;
  }

  try {
    const decodedPath = decodeURIComponent(pathPart);
    return (
      decodedPath.length > 0 &&
      !decodedPath.startsWith("/") &&
      !decodedPath.startsWith("\\") &&
      !/[\u0000-\u001f\u007f]/.test(decodedPath) &&
      /\.(md|markdown)$/i.test(decodedPath)
    );
  } catch {
    return false;
  }
}

async function openExternalLink(url: string): Promise<void> {
  try {
    await invoke("open_external_link", { url });
  } catch (error) {
    console.warn("failed to open external link", error);
  }
}

async function openLinkedDocument(href: string): Promise<void> {
  const currentPath = currentDocument?.path;
  const navigationRoot = currentDocument?.navigationRoot;

  if (!currentPath || !navigationRoot) {
    return;
  }

  saveActiveReadingPosition();

  try {
    const linkedDocument = await invoke<LinkedDocument>("load_linked_document", {
      currentPath,
      navigationRoot,
      href,
    });

    if (linkedDocument.document.error) {
      showDocumentMessage(
        "This linked file could not be opened.",
        linkedDocument.document.error,
      );
      return;
    }

    pushDocumentNavigation(linkedDocument.document, linkedDocument.fragment);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showDocumentMessage("This linked file could not be opened.", message);
  }
}

function pushSameDocumentFragmentNavigation(fragment: string): void {
  const documentView = currentDocument;

  if (!documentView || documentView.error || !documentView.html) {
    return;
  }

  if (!findFragmentTarget(fragment)) {
    return;
  }

  saveActiveReadingPosition();
  pushDocumentNavigation(documentView, fragment);
}

function resetNavigation(documentView: LoadedDocument): void {
  navigationSessionId += 1;
  navigationEntries.clear();
  navigationOrder = [];

  const view: NavigationView =
    !documentView.path && !documentView.html && !documentView.error
      ? { kind: "home" }
      : { kind: "document", document: documentView, fragment: null };
  const entry = createNavigationEntry(view, 0);
  navigationEntries.set(entry.id, entry);
  navigationOrder.push(entry.id);
  activeNavigationEntryId = entry.id;
  activeNavigationIndex = 0;

  window.history.replaceState(historyStateFor(entry.id), "");
  renderNavigationEntry(entry);
}

function pushDocumentNavigation(
  documentView: LoadedDocument,
  fragment: string | null,
): void {
  pushNavigationView({ kind: "document", document: documentView, fragment });
}

function pushHomeNavigation(): void {
  const activeEntry = getActiveNavigationEntry();

  if (activeEntry?.view.kind === "home") {
    renderNavigationEntry(activeEntry, { scrollY: 0 });
    return;
  }

  saveActiveReadingPosition();
  pushNavigationView({ kind: "home" });
}

function getActiveNavigationEntry(): NavigationEntry | null {
  return activeNavigationEntryId === null
    ? null
    : navigationEntries.get(activeNavigationEntryId) ?? null;
}

function pushNavigationView(view: NavigationView): void {
  if (activeNavigationIndex < navigationOrder.length - 1) {
    for (const staleEntryId of navigationOrder.slice(activeNavigationIndex + 1)) {
      navigationEntries.delete(staleEntryId);
    }
    navigationOrder = navigationOrder.slice(0, activeNavigationIndex + 1);
  }

  const entry = createNavigationEntry(view, 0);
  navigationEntries.set(entry.id, entry);
  navigationOrder.push(entry.id);
  activeNavigationEntryId = entry.id;
  activeNavigationIndex = navigationOrder.length - 1;

  window.history.pushState(historyStateFor(entry.id), "");
  renderNavigationEntry(entry);
}

function createNavigationEntry(
  view: NavigationView,
  scrollY: number,
): NavigationEntry {
  const id = nextNavigationEntryId;
  nextNavigationEntryId += 1;

  return {
    id,
    view,
    scrollY,
    readingPosition: null,
  };
}

function renderNavigationEntry(
  entry: NavigationEntry,
  options: { scrollY?: number | null } = {},
): void {
  if (entry.view.kind === "home") {
    renderHome(options.scrollY ?? entry.scrollY);
    return;
  }

  const { document: documentView, fragment } = entry.view;
  const readingPosition = entry.readingPosition;
  renderDocument(documentView, {
    fragment: readingPosition ? null : fragment,
    readingPosition,
    scrollY:
      readingPosition || fragment ? null : (options.scrollY ?? entry.scrollY),
  });
}

function historyStateFor(entryId: number): HushmarkHistoryState {
  return {
    kind: "hushmark-navigation",
    sessionId: navigationSessionId,
    entryId,
  };
}

function saveActiveReadingPosition(): void {
  const entry = getActiveNavigationEntry();
  if (!entry) {
    return;
  }

  if (entry.view.kind === "home") {
    entry.scrollY = window.scrollY;
    return;
  }

  const article = app.querySelector<HTMLElement>(":scope > .document");
  if (article) {
    entry.readingPosition = captureDocumentReadingPosition(article);
  }
}

function handleHistoryPopState(event: PopStateEvent): void {
  const state = parseHistoryState(event.state);

  if (!state || state.sessionId !== navigationSessionId) {
    keepCurrentHistoryEntry();
    return;
  }

  if (state.entryId === activeNavigationEntryId) {
    return;
  }

  const entry = navigationEntries.get(state.entryId);
  const entryIndex = navigationOrder.indexOf(state.entryId);
  if (!entry || entryIndex === -1) {
    keepCurrentHistoryEntry();
    return;
  }

  saveActiveReadingPosition();
  activeNavigationEntryId = state.entryId;
  activeNavigationIndex = entryIndex;
  renderNavigationEntry(entry);
}

function keepCurrentHistoryEntry(): void {
  if (activeNavigationEntryId !== null) {
    window.history.pushState(historyStateFor(activeNavigationEntryId), "");
  }
}

function parseHistoryState(state: unknown): HushmarkHistoryState | null {
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

function handleNavigationKeydown(event: KeyboardEvent): void {
  if (isControlShortcut(event, SHORTCUTS.zoomIn)) {
    event.preventDefault();
    if (!event.repeat) {
      changeDocumentZoom(DOCUMENT_ZOOM_STEP);
    }
    return;
  }

  if (isControlShortcut(event, SHORTCUTS.zoomOut)) {
    event.preventDefault();
    if (!event.repeat) {
      changeDocumentZoom(-DOCUMENT_ZOOM_STEP);
    }
    return;
  }

  if (isControlShortcut(event, SHORTCUTS.resetZoom)) {
    event.preventDefault();
    if (!event.repeat && canAdjustDocumentView()) {
      updateDocumentView(resetDocumentZoom(documentViewPreferences));
    }
    return;
  }

  if (isControlShortcut(event, SHORTCUTS.toggleLayout)) {
    event.preventDefault();
    if (!event.repeat && canAdjustDocumentView()) {
      updateDocumentView(toggledDocumentLayout(documentViewPreferences));
    }
    return;
  }

  if (isControlShortcut(event, SHORTCUTS.home)) {
    event.preventDefault();
    if (!event.repeat) {
      if (currentMode === "setup") {
        returnToHomeFromSetup();
      } else {
        pushHomeNavigation();
      }
    }
    return;
  }

  if (isControlShortcut(event, SHORTCUTS.print)) {
    event.preventDefault();
    if (canPrintCurrentDocument() && !event.repeat) {
      window.print();
    }
    return;
  }

  if (isControlShortcut(event, SHORTCUTS.open)) {
    event.preventDefault();
    if (currentMode === "reader") {
      void openDocumentFromPicker();
    }
    return;
  }

  const navigationDirection = navigationDirectionForEvent(event);
  if (!navigationDirection || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  if (activeNavigationEntryId === null) {
    return;
  }

  event.preventDefault();

  if (navigationDirection === "back" && activeNavigationIndex > 0) {
    window.history.back();
  } else if (
    navigationDirection === "forward" &&
    activeNavigationIndex < navigationOrder.length - 1
  ) {
    window.history.forward();
  }
}

function handleDocumentWheel(event: WheelEvent): void {
  if (!event.ctrlKey || event.altKey || event.metaKey) {
    wheelZoomAccumulator = 0;
    return;
  }

  event.preventDefault();
  if (!canAdjustDocumentView() || event.deltaY === 0) {
    wheelZoomAccumulator = 0;
    return;
  }

  const delta = normalizedWheelDelta(event);
  if (Math.sign(delta) !== Math.sign(wheelZoomAccumulator)) {
    wheelZoomAccumulator = 0;
  }
  wheelZoomAccumulator += delta;

  if (Math.abs(wheelZoomAccumulator) < 50) {
    return;
  }

  changeDocumentZoom(
    wheelZoomAccumulator < 0 ? DOCUMENT_ZOOM_STEP : -DOCUMENT_ZOOM_STEP,
  );
  wheelZoomAccumulator = 0;
}

function normalizedWheelDelta(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * window.innerHeight;
  }
  return event.deltaY;
}

function changeDocumentZoom(delta: number): void {
  if (!canAdjustDocumentView()) {
    return;
  }
  updateDocumentView(zoomedDocumentView(documentViewPreferences, delta));
}

function updateDocumentView(nextPreferences: DocumentViewPreferences): void {
  if (
    nextPreferences.zoom === documentViewPreferences.zoom &&
    nextPreferences.layout === documentViewPreferences.layout
  ) {
    return;
  }

  const article = app.querySelector<HTMLElement>(":scope > .document");
  const readingPosition = article
    ? captureDocumentReadingPosition(article)
    : null;
  const activeEntry = getActiveNavigationEntry();
  if (readingPosition && activeEntry?.view.kind === "document") {
    activeEntry.readingPosition = readingPosition;
  }

  documentViewPreferences = nextPreferences;
  applyDocumentViewPreferences(document.documentElement, documentViewPreferences);

  if (article && readingPosition) {
    restoreDocumentReadingPosition(article, readingPosition);
  }
}

function canPrintCurrentDocument(): boolean {
  return (
    currentMode === "reader" &&
    Boolean(currentDocument?.path) &&
    !currentDocument?.error &&
    app.querySelector(":scope > .document") !== null
  );
}

function canAdjustDocumentView(): boolean {
  return (
    currentMode === "reader" &&
    Boolean(currentDocument?.path) &&
    !currentDocument?.error &&
    app.querySelector(":scope > .document") !== null
  );
}

function navigationDirectionForEvent(event: KeyboardEvent): "back" | "forward" | null {
  if (
    (event.altKey && event.key === SHORTCUTS.back.key) ||
    event.key === SHORTCUTS.back.alternateKey
  ) {
    return "back";
  }

  if (
    (event.altKey && event.key === SHORTCUTS.forward.key) ||
    event.key === SHORTCUTS.forward.alternateKey
  ) {
    return "forward";
  }

  return null;
}

async function openDocumentFromPicker(): Promise<void> {
  if (filePickerOpen) {
    return;
  }

  filePickerOpen = true;

  let selectedPath: string | null | string[];
  try {
    selectedPath = await openDialog({
      multiple: false,
      filters: [
        {
          name: "Markdown files",
          extensions: ["md", "markdown"],
        },
      ],
    });
  } catch (error) {
    console.warn("failed to open file picker", error);
    return;
  } finally {
    filePickerOpen = false;
  }

  if (typeof selectedPath !== "string") {
    return;
  }

  await openTopLevelDocument(selectedPath);
}

function showDocumentMessage(heading: string, detail: string): void {
  const article = app.querySelector<HTMLElement>(".document");

  if (!article) {
    document.title = `Error - ${PRODUCT.displayName}`;
    renderState("error", heading, detail);
    return;
  }

  article.querySelector(".document-message")?.remove();

  const message = document.createElement("aside");
  message.className = "document-message";
  message.setAttribute("role", "status");
  message.append(createTextElement("h2", heading), createTextElement("p", detail));
  article.prepend(message);
  message.scrollIntoView({ block: "nearest" });
}

function scrollToFragmentAfterRender(fragment: string): void {
  window.requestAnimationFrame(() => {
    const target = findFragmentTarget(fragment);
    if (target) {
      target.scrollIntoView();
    }
  });
}

function restoreScrollAfterRender(scrollY: number): void {
  window.requestAnimationFrame(() => {
    window.scrollTo(0, scrollY);
  });
}

function restoreReadingPositionAfterRender(
  article: HTMLElement,
  position: DocumentReadingPosition,
): void {
  window.requestAnimationFrame(() => {
    if (article.isConnected) {
      restoreDocumentReadingPosition(article, position);
    }
  });
}

function fragmentIdCandidates(fragment: string): string[] {
  const cleanFragment = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const candidates = [cleanFragment];

  try {
    const decoded = decodeURIComponent(cleanFragment);
    if (!candidates.includes(decoded)) {
      candidates.unshift(decoded);
    }
  } catch {
    // Use the original fragment when percent-decoding fails.
  }

  return candidates.filter((candidate) => candidate.length > 0);
}

function findFragmentTarget(fragment: string): HTMLElement | null {
  for (const id of fragmentIdCandidates(fragment)) {
    const target = document.getElementById(id);
    if (target) {
      return target;
    }
  }

  return null;
}

async function openTopLevelDocument(path: string): Promise<void> {
  const openedFromHome = getActiveNavigationEntry()?.view.kind === "home";
  saveActiveReadingPosition();
  renderState("loading", "Opening Markdown file...");

  try {
    const documentView = await invoke<LoadedDocument>("load_dropped_document", {
      path,
    });
    currentMode = "reader";
    if (openedFromHome && getActiveNavigationEntry()?.view.kind === "home") {
      pushDocumentNavigation(documentView, null);
    } else {
      resetNavigation(documentView);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    document.title = `Error - ${PRODUCT.displayName}`;
    renderState("error", "This file could not be opened.", message);
  }
}

async function registerDragAndDrop(): Promise<void> {
  await currentWindow.onDragDropEvent((event) => {
    if (event.payload.type !== "drop") {
      return;
    }

    const [path] = event.payload.paths;

    if (path) {
      void openTopLevelDocument(path);
    }
  });
}

async function revealWindow(): Promise<void> {
  await currentWindow.show();
}

async function start(): Promise<void> {
  void registerDragAndDrop().catch((error) => {
    console.error("failed to register drag-and-drop handler", error);
  });

  try {
    const startupView = await invoke<StartupView>("load_initial_view");
    document.documentElement.dataset.platform = startupView.platform;
    platformCapabilities = startupView.capabilities;
    applyDocumentViewPreferences(document.documentElement, documentViewPreferences);
    currentMode = "reader";

    if (!startupView.document) {
      throw new Error("Initial document state was not returned.");
    }

    resetNavigation(startupView.document);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    document.title = `Error - ${PRODUCT.displayName}`;
    renderState("error", `Could not start ${PRODUCT.displayName}.`, message);
  } finally {
    await revealWindow();
  }
}

void start();
