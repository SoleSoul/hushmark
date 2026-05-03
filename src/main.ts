import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PRODUCT } from "./product";
import "./styles.css";

type LoadedDocument = {
  path: string | null;
  fileName: string | null;
  html: string | null;
  error: string | null;
};

type SetupMessage = {
  kind: "success" | "warning" | "error";
  text: string;
  details: string | null;
};

type SetupStatus = {
  appName: string;
  version: string;
  installedVersion: string | null;
  developer: string;
  releaseExeName: string;
  installedExeName: string;
  progId: string;
  installPath: string;
  currentExePath: string;
  installed: boolean;
  installedMatchesCurrent: boolean;
  appPathRegistered: boolean;
  applicationRegistered: boolean;
  fileHandlersRegistered: boolean;
  openWithMdRegistered: boolean;
  openWithMarkdownRegistered: boolean;
  contextMenuRegistered: boolean;
  contextMenuMdRegistered: boolean;
  contextMenuMarkdownRegistered: boolean;
  defaultAppsUri: string;
  message: SetupMessage | null;
};

type SetupActionId = "install" | "openWith" | "contextMenu" | "defaultApps" | "removeAll";

type SetupCommand =
  | "toggle_install"
  | "toggle_open_with_support"
  | "toggle_context_menu"
  | "open_default_apps_settings"
  | "remove_all_integration";

type StartupView = {
  mode: "reader" | "setup";
  document: LoadedDocument | null;
  setup: SetupStatus | null;
};

const appElement = document.querySelector<HTMLElement>("#app");

if (!appElement) {
  throw new Error("Missing #app root element.");
}

const app = appElement;
const currentWindow = getCurrentWindow();

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
): void {
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
}

function renderDocument(documentView: LoadedDocument): void {
  document.title = titleFor(documentView);

  if (documentView.error) {
    renderState("error", "This file could not be opened.", documentView.error);
    return;
  }

  if (!documentView.path && !documentView.html) {
    renderState("empty", PRODUCT.displayName, "Open a Markdown file to read.");
    return;
  }

  const article = document.createElement("article");
  article.className = "document";

  // The HTML is rendered and sanitized by Rust before it reaches the UI.
  article.innerHTML = documentView.html ?? "";

  app.replaceChildren(article);
}

function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  return element;
}

function boolText(value: boolean): string {
  return value ? "Yes" : "No";
}

function createDetailRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "setup-detail-row";
  row.append(createTextElement("dt", label), createTextElement("dd", value));
  return row;
}

function installRowLabel(status: SetupStatus): string {
  return status.installed && !status.installedMatchesCurrent
    ? PRODUCT.updateRowLabel
    : PRODUCT.installRowLabel;
}

function installRowStateText(status: SetupStatus): string {
  if (status.installedMatchesCurrent) {
    return "Installed";
  }

  return status.installed ? "Update available" : "Not installed";
}

function createIntegrationRow(
  id: SetupActionId,
  label: string,
  description: string,
  checked: boolean,
  stateLabel: string | null,
  command: SetupCommand,
  status: SetupStatus,
  workingAction: SetupActionId | null,
): HTMLButtonElement {
  const row = document.createElement("button");
  row.type = "button";
  row.className = `integration-row${checked ? " integration-row--checked" : ""}${
    workingAction === id ? " integration-row--working" : ""
  }`;
  row.disabled = workingAction !== null;
  row.setAttribute("aria-pressed", String(checked));
  row.addEventListener("click", () => {
    void runSetupAction(command, status, id);
  });

  const check = createTextElement("span", checked ? "✓" : "", "integration-row__check");
  check.setAttribute("aria-hidden", "true");

  const copy = document.createElement("span");
  copy.className = "integration-row__copy";
  copy.append(
    createTextElement("span", label, "integration-row__label"),
    createTextElement("span", description, "integration-row__description"),
  );

  const stateText =
    workingAction === id ? "Working..." : stateLabel ?? (checked ? "Enabled" : "Not enabled");
  const state = createTextElement("span", stateText, "integration-row__state");

  row.append(check, copy, state);
  return row;
}

function createSecondaryButton(
  label: string,
  command: SetupCommand,
  status: SetupStatus,
  id: SetupActionId,
  workingAction: SetupActionId | null,
  destructive = false,
): HTMLButtonElement {
  const button = createTextElement(
    "button",
    workingAction === id ? "Working..." : label,
    destructive ? "button button--danger" : "button button--secondary",
  );
  button.type = "button";
  button.disabled = workingAction !== null;
  button.addEventListener("click", () => {
    void runSetupAction(command, status, id);
  });
  return button;
}

function createMessage(message: SetupMessage): HTMLParagraphElement {
  const element = createTextElement("p", message.text, `setup-message setup-message--${message.kind}`);
  return element;
}

function createDetails(status: SetupStatus): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "setup-details";

  const summary = createTextElement("summary", "Details");
  const rows = document.createElement("dl");
  rows.className = "setup-details__rows";
  const detailRows = [
    createDetailRow("App", status.appName),
    createDetailRow("Version", status.version),
    createDetailRow("Developer", status.developer),
  ];

  if (status.installedVersion) {
    detailRows.push(createDetailRow("Installed version", status.installedVersion));
  }

  detailRows.push(
    createDetailRow("Release binary", status.releaseExeName),
    createDetailRow("Installed executable", status.installedExeName),
    createDetailRow("Current executable", status.currentExePath),
    createDetailRow("ProgID", status.progId),
    createDetailRow("Installed copy exists", boolText(status.installed)),
    createDetailRow("Installed copy current", boolText(status.installedMatchesCurrent)),
    createDetailRow("App Paths status", boolText(status.appPathRegistered)),
    createDetailRow("Application registration", boolText(status.applicationRegistered)),
    createDetailRow("Open With .md", boolText(status.openWithMdRegistered)),
    createDetailRow("Open With .markdown", boolText(status.openWithMarkdownRegistered)),
    createDetailRow("Right-click .md", boolText(status.contextMenuMdRegistered)),
    createDetailRow("Right-click .markdown", boolText(status.contextMenuMarkdownRegistered)),
    createDetailRow("Install path", status.installPath),
  );
  rows.append(...detailRows);

  if (status.message?.details) {
    rows.append(createDetailRow("Last message details", status.message.details));
  }

  details.append(summary, rows);
  return details;
}

function renderSetup(status: SetupStatus, workingAction: SetupActionId | null = null): void {
  document.title = PRODUCT.setupTitle;

  const section = document.createElement("section");
  section.className = "setup";

  const panel = document.createElement("div");
  panel.className = "setup__panel";

  const heading = createTextElement("h1", status.appName);
  const intro = createTextElement(
    "p",
    "Choose how Hushmark integrates with Markdown files on this Windows account.",
    "setup__intro",
  );

  const rows = document.createElement("div");
  rows.className = "integration-rows";
  rows.append(
    createIntegrationRow(
      "install",
      installRowLabel(status),
      PRODUCT.installRowDescription,
      status.installedMatchesCurrent,
      installRowStateText(status),
      "toggle_install",
      status,
      workingAction,
    ),
    createIntegrationRow(
      "openWith",
      PRODUCT.openWithRowLabel,
      PRODUCT.openWithRowDescription,
      status.fileHandlersRegistered,
      null,
      "toggle_open_with_support",
      status,
      workingAction,
    ),
    createIntegrationRow(
      "contextMenu",
      PRODUCT.contextMenuRowLabel,
      PRODUCT.contextMenuRowDescription,
      status.contextMenuRegistered,
      null,
      "toggle_context_menu",
      status,
      workingAction,
    ),
  );

  const defaultAppsNote = createTextElement(
    "p",
    `${status.appName} will not take over ${PRODUCT.markdownExtensions} defaults automatically. Choose it in Windows Default Apps if you want it as the default handler.`,
    "setup__note",
  );

  const actions = document.createElement("div");
  actions.className = "setup-actions";
  actions.append(
    createSecondaryButton(
      PRODUCT.chooseDefaultButtonLabel,
      "open_default_apps_settings",
      status,
      "defaultApps",
      workingAction,
    ),
    createSecondaryButton(
      PRODUCT.removeAllButtonLabel,
      "remove_all_integration",
      status,
      "removeAll",
      workingAction,
      true,
    ),
  );

  panel.append(heading, intro, rows, defaultAppsNote, actions);

  if (workingAction) {
    panel.append(createTextElement("p", "Working...", "setup-message setup-message--working"));
  } else if (status.message) {
    panel.append(createMessage(status.message));
  }

  panel.append(createDetails(status));

  section.append(panel);
  app.replaceChildren(section);
}

async function runSetupAction(
  command: SetupCommand,
  previousStatus: SetupStatus,
  workingAction: SetupActionId,
): Promise<void> {
  renderSetup(previousStatus, workingAction);

  try {
    const status = await invoke<SetupStatus>(command);
    renderSetup(status);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    await renderSetupError(previousStatus, "That change could not be completed.", details);
  }
}

async function renderSetupError(
  previousStatus: SetupStatus,
  text: string,
  details: string,
): Promise<void> {
  const message: SetupMessage = { kind: "error", text, details };

  try {
    const status = await invoke<SetupStatus>("get_setup_status");
    renderSetup({ ...status, message });
  } catch {
    renderSetup({ ...previousStatus, message });
  }
}

async function openDroppedFile(path: string): Promise<void> {
  renderState("loading", "Opening Markdown file...");

  try {
    const documentView = await invoke<LoadedDocument>("load_dropped_document", {
      path,
    });
    renderDocument(documentView);
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
      void openDroppedFile(path);
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

    if (startupView.mode === "setup") {
      if (!startupView.setup) {
        throw new Error("Setup status was not returned.");
      }

      renderSetup(startupView.setup);
    } else {
      if (!startupView.document) {
        throw new Error("Initial document state was not returned.");
      }

      renderDocument(startupView.document);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    document.title = `Error - ${PRODUCT.displayName}`;
    renderState("error", `Could not start ${PRODUCT.displayName}.`, message);
  } finally {
    await revealWindow();
  }
}

void start();

