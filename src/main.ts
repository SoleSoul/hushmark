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
import {
  prepareDocumentArticle,
  restoreRequestedDocumentPosition,
  restoreScrollAfterRender,
} from "./documentPresentation";
import type { DocumentPositionRequest } from "./documentPresentation";
import { createHomeView } from "./homeView";
import { reportLaunchCheck } from "./launchCheck";
import { classifyDocumentLink, findFragmentTarget } from "./links";
import { NavigationHistory } from "./navigationHistory";
import {
  createPlatformShell,
  defaultPlatformShell,
} from "./platformShell";
import type { PlatformShell } from "./platformShell";
import { PRODUCT } from "./product";
import { renderSetup, WINDOWS_SETUP_TITLE } from "./setupView";
import { isAppShortcut, SHORTCUTS } from "./shortcuts";
import "./styles.css";
import type {
  LinkedDocument,
  LoadedDocument,
  NavigationEntry,
  NavigationView,
  PlatformCapabilities,
  SetupStatus,
  StartupView,
} from "./types";
import { normalizedWheelDelta, WheelZoomGesture } from "./wheelZoom";
import { documentWindowTitle, ERROR_WINDOW_TITLE } from "./windowTitle";

type AppMode = "reader" | "setup";

const appElement = document.querySelector<HTMLElement>("#app");

if (!appElement) {
  throw new Error("Missing #app root element.");
}

const app = appElement;
const currentWindow = getCurrentWindow();
const navigation = new NavigationHistory();
const wheelZoom = new WheelZoomGesture();
let currentDocument: LoadedDocument | null = null;
let currentMode: AppMode = "reader";
let currentPlatform = "unknown";
let platformCapabilities: PlatformCapabilities = { setup: false };
let filePickerOpen = false;
let documentViewPreferences: DocumentViewPreferences = {
  ...DEFAULT_DOCUMENT_VIEW,
};
let documentRenderId = 0;
let platformOpenQueue = Promise.resolve();
let platformShell: PlatformShell = defaultPlatformShell;

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

function setReaderWindowTitle(title: string): void {
  document.title = title;
  void currentWindow.setTitle(title).catch((error) => {
    console.warn("failed to set reader window title", error);
  });
}

function renderState(
  kind: "empty" | "error" | "loading",
  heading: string,
  detail?: string,
): HTMLElement {
  documentRenderId += 1;
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
  syncPlatformShellState();

  return section;
}

function renderDocument(
  documentView: LoadedDocument,
  position: DocumentPositionRequest = {},
): void {
  currentMode = "reader";
  currentDocument = documentView;
  setReaderWindowTitle(documentWindowTitle(documentView, currentPlatform));

  if (documentView.error) {
    renderState("error", "This file could not be opened.", documentView.error);
    return;
  }

  if (!documentView.path && !documentView.html) {
    renderHome();
    return;
  }

  renderState("loading", "Opening Markdown file...");

  const renderId = documentRenderId;
  const { article, ready } = prepareDocumentArticle(documentView.html ?? "");
  article.addEventListener("click", handleDocumentLinkClick);

  const commit = (): void => {
    if (renderId !== documentRenderId) {
      return;
    }

    app.replaceChildren(article);
    restoreRequestedDocumentPosition(article, position);
    syncPlatformShellState();
  };

  if (!ready) {
    commit();
    return;
  }

  void ready.then(commit, (error) => {
    console.warn("failed to finish preparing the document", error);
    commit();
  });
}

function renderHome(scrollY = 0): void {
  currentMode = "reader";
  currentDocument = null;
  documentRenderId += 1;
  setReaderWindowTitle(PRODUCT.displayName);

  const section = createHomeView(currentPlatform);
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
  setReaderWindowTitle(WINDOWS_SETUP_TITLE);
  renderSetup(app, status, { onBackToHome: returnToHomeFromSetup });
}

function returnToHomeFromSetup(): void {
  currentMode = "reader";
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
  const view: NavigationView =
    !documentView.path && !documentView.html && !documentView.error
      ? { kind: "home" }
      : { kind: "document", document: documentView, fragment: null };
  const entry = navigation.reset(view);

  window.history.replaceState(navigation.stateFor(entry.id), "");
  renderNavigationEntry(entry);
}

function pushDocumentNavigation(
  documentView: LoadedDocument,
  fragment: string | null,
): void {
  pushNavigationView({ kind: "document", document: documentView, fragment });
}

function pushHomeNavigation(): void {
  const activeEntry = navigation.activeEntry;

  if (activeEntry?.view.kind === "home") {
    renderNavigationEntry(activeEntry, { scrollY: 0 });
    return;
  }

  saveActiveReadingPosition();
  pushNavigationView({ kind: "home" });
}

function pushNavigationView(view: NavigationView): void {
  const entry = navigation.push(view);
  window.history.pushState(navigation.stateFor(entry.id), "");
  renderNavigationEntry(entry);
}

function renderNavigationEntry(
  entry: NavigationEntry,
  options: { scrollY?: number | null } = {},
): void {
  if (entry.view.kind === "home") {
    renderHome(options.scrollY ?? entry.scrollY);
    syncPlatformShellState();
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
  syncPlatformShellState();
}

function saveActiveReadingPosition(): void {
  const entry = navigation.activeEntry;
  if (!entry) {
    return;
  }

  if (entry.view.kind === "home") {
    entry.scrollY = window.scrollY;
    return;
  }

  const article = currentArticle();
  if (article) {
    entry.readingPosition = captureDocumentReadingPosition(article);
  }
}

function handleHistoryPopState(event: PopStateEvent): void {
  const lookup = navigation.lookup(event.state);

  if (lookup.kind === "foreign") {
    keepCurrentHistoryEntry();
    return;
  }

  if (lookup.kind === "active") {
    return;
  }

  saveActiveReadingPosition();
  navigation.activate(lookup.entry);
  renderNavigationEntry(lookup.entry);
}

function keepCurrentHistoryEntry(): void {
  const activeEntryId = navigation.activeEntryId;
  if (activeEntryId !== null) {
    window.history.pushState(navigation.stateFor(activeEntryId), "");
  }
}

function goBack(): void {
  if (navigation.canGoBack) {
    window.history.back();
  }
}

function goForward(): void {
  if (navigation.canGoForward) {
    window.history.forward();
  }
}

function handleNavigationKeydown(event: KeyboardEvent): void {
  if (isAppShortcut(event, SHORTCUTS.zoomIn, currentPlatform)) {
    event.preventDefault();
    if (!event.repeat) {
      changeDocumentZoom(DOCUMENT_ZOOM_STEP);
    }
    return;
  }

  if (isAppShortcut(event, SHORTCUTS.zoomOut, currentPlatform)) {
    event.preventDefault();
    if (!event.repeat) {
      changeDocumentZoom(-DOCUMENT_ZOOM_STEP);
    }
    return;
  }

  if (isAppShortcut(event, SHORTCUTS.resetZoom, currentPlatform)) {
    event.preventDefault();
    if (!event.repeat && hasOpenDocument()) {
      updateDocumentView(resetDocumentZoom(documentViewPreferences));
    }
    return;
  }

  if (isAppShortcut(event, SHORTCUTS.toggleLayout, currentPlatform)) {
    event.preventDefault();
    if (!event.repeat && hasOpenDocument()) {
      updateDocumentView(toggledDocumentLayout(documentViewPreferences));
    }
    return;
  }

  if (isAppShortcut(event, SHORTCUTS.home, currentPlatform)) {
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

  if (isAppShortcut(event, SHORTCUTS.print, currentPlatform)) {
    event.preventDefault();
    if (hasOpenDocument() && !event.repeat) {
      printCurrentDocument();
    }
    return;
  }

  if (
    currentPlatform !== "macos" &&
    isAppShortcut(event, SHORTCUTS.open, currentPlatform)
  ) {
    event.preventDefault();
    if (currentMode === "reader") {
      void openDocumentFromPicker();
    }
    return;
  }

  const navigationDirection = navigationDirectionForEvent(event);
  if (!navigationDirection) {
    return;
  }

  if (navigation.activeEntryId === null) {
    return;
  }

  event.preventDefault();

  if (navigationDirection === "back") {
    goBack();
  } else {
    goForward();
  }
}

function handleDocumentWheel(event: WheelEvent): void {
  if (!event.ctrlKey || event.altKey || event.metaKey) {
    wheelZoom.reset();
    return;
  }

  event.preventDefault();
  if (!hasOpenDocument() || event.deltaY === 0) {
    wheelZoom.reset();
    return;
  }

  const direction = wheelZoom.add(normalizedWheelDelta(event));
  if (direction !== 0) {
    changeDocumentZoom(direction * DOCUMENT_ZOOM_STEP);
  }
}

function changeDocumentZoom(delta: number): void {
  if (!hasOpenDocument()) {
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

  const article = currentArticle();
  const readingPosition = article
    ? captureDocumentReadingPosition(article)
    : null;
  const activeEntry = navigation.activeEntry;
  if (readingPosition && activeEntry?.view.kind === "document") {
    activeEntry.readingPosition = readingPosition;
  }

  documentViewPreferences = nextPreferences;
  applyDocumentViewPreferences(document.documentElement, documentViewPreferences);

  if (article && readingPosition) {
    restoreDocumentReadingPosition(article, readingPosition);
  }

  syncPlatformShellState();
}

function currentArticle(): HTMLElement | null {
  return app.querySelector<HTMLElement>(":scope > .document");
}

// True when a successfully loaded document is displayed in the reader, which is
// when printing, zoom, and layout commands apply.
function hasOpenDocument(): boolean {
  return (
    currentMode === "reader" &&
    Boolean(currentDocument?.path) &&
    !currentDocument?.error &&
    currentArticle() !== null
  );
}

function navigationDirectionForEvent(event: KeyboardEvent): "back" | "forward" | null {
  if (isAppShortcut(event, SHORTCUTS.back, currentPlatform)) {
    return "back";
  }

  if (isAppShortcut(event, SHORTCUTS.forward, currentPlatform)) {
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
    setReaderWindowTitle(ERROR_WINDOW_TITLE);
    renderState("error", heading, detail);
    return;
  }

  const content = article.querySelector<HTMLElement>(
    ":scope > .document__content",
  );
  if (!content) {
    return;
  }

  content.querySelector(".document-message")?.remove();

  const message = document.createElement("aside");
  message.className = "document-message";
  message.setAttribute("role", "status");
  message.append(createTextElement("h2", heading), createTextElement("p", detail));
  content.prepend(message);
  message.scrollIntoView({ block: "nearest" });
}

async function openTopLevelDocument(path: string): Promise<void> {
  const openedFromHome = navigation.activeEntry?.view.kind === "home";
  saveActiveReadingPosition();
  renderState("loading", "Opening Markdown file...");

  try {
    const documentView = await invoke<LoadedDocument>("load_dropped_document", {
      path,
    });
    currentMode = "reader";
    if (openedFromHome && navigation.activeEntry?.view.kind === "home") {
      pushDocumentNavigation(documentView, null);
    } else {
      resetNavigation(documentView);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setReaderWindowTitle(ERROR_WINDOW_TITLE);
    renderState("error", "This file could not be opened.", message);
  }
}

function queuePlatformOpenDocument(path: string): void {
  platformOpenQueue = platformOpenQueue
    .then(() => openTopLevelDocument(path))
    .catch((error) => {
      console.error("failed to handle an operating-system open-document event", error);
    });
}

function setDocumentLayout(layout: "page" | "full-width"): void {
  if (!hasOpenDocument() || documentViewPreferences.layout === layout) {
    syncPlatformShellState();
    return;
  }

  updateDocumentView({ ...documentViewPreferences, layout });
}

function printCurrentDocument(): void {
  if (!hasOpenDocument()) {
    return;
  }

  void platformShell.printDocument().catch((error) => {
    console.warn("failed to open the print dialog", error);
  });
}

function syncPlatformShellState(): void {
  void platformShell.updateState({
    canGoBack: navigation.canGoBack,
    canGoForward: navigation.canGoForward,
    canPrintDocument: hasOpenDocument(),
    hasDocument: hasOpenDocument(),
    layout: documentViewPreferences.layout,
  }).catch((error) => {
    console.warn("failed to update platform menu state", error);
  });
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
    currentPlatform = startupView.platform;
    document.documentElement.dataset.platform = startupView.platform;
    platformCapabilities = startupView.capabilities;
    applyDocumentViewPreferences(document.documentElement, documentViewPreferences);
    currentMode = "reader";

    try {
      platformShell = await createPlatformShell(currentPlatform, {
        openDocumentPath: queuePlatformOpenDocument,
        goBack,
        goForward,
        showHome: pushHomeNavigation,
        setLayout: setDocumentLayout,
        zoomIn: () => changeDocumentZoom(DOCUMENT_ZOOM_STEP),
        zoomOut: () => changeDocumentZoom(-DOCUMENT_ZOOM_STEP),
        resetZoom: () => {
          if (hasOpenDocument()) {
            updateDocumentView(resetDocumentZoom(documentViewPreferences));
          }
        },
      });
    } catch (error) {
      console.warn("failed to initialize the platform shell", error);
      platformShell = defaultPlatformShell;
    }

    if (!startupView.document) {
      throw new Error("Initial document state was not returned.");
    }

    resetNavigation(startupView.document);

    try {
      const pendingPaths = await platformShell.takePendingOpenDocuments();
      for (const path of pendingPaths) {
        await openTopLevelDocument(path);
      }
    } catch (error) {
      console.warn("failed to receive pending open-document events", error);
    }

    if (startupView.launchCheck) {
      void reportLaunchCheck(app);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setReaderWindowTitle(ERROR_WINDOW_TITLE);
    renderState("error", `Could not start ${PRODUCT.displayName}.`, message);
  } finally {
    await revealWindow();
  }
}

void start();
