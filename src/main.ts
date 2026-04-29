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

type SetupStatus = {
  appName: string;
  version: string;
  releaseExeName: string;
  installedExeName: string;
  progId: string;
  installPath: string;
  currentExePath: string;
  installed: boolean;
  installedMatchesCurrent: boolean;
  appPathRegistered: boolean;
  fileHandlersRegistered: boolean;
  contextMenuRegistered: boolean;
  defaultAppsUri: string;
  message: string | null;
};

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
    renderState("error", "Could not open the Markdown file.", documentView.error);
    return;
  }

  if (!documentView.path && !documentView.html) {
    renderState("empty", "Open a Markdown file to read.");
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

function statusText(value: boolean): string {
  return value ? "Yes" : "No";
}

function createStatusRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "setup__row";
  row.append(createTextElement("dt", label), createTextElement("dd", value));
  return row;
}

function renderSetup(status: SetupStatus): void {
  document.title = PRODUCT.setupTitle;

  const section = document.createElement("section");
  section.className = "setup";

  const panel = document.createElement("div");
  panel.className = "setup__panel";

  const heading = createTextElement("h1", status.appName);
  const intro = createTextElement(
    "p",
    `Install ${status.appName} for the current user and register it as an Open with option for Markdown files.`,
    "setup__intro",
  );

  const details = document.createElement("dl");
  details.className = "setup__details";
  details.append(
    createStatusRow("Version", status.version),
    createStatusRow("Release binary", status.releaseExeName),
    createStatusRow("Installed executable", status.installedExeName),
    createStatusRow("ProgID", status.progId),
    createStatusRow("Install path", status.installPath),
    createStatusRow("Current executable", status.currentExePath),
    createStatusRow("Installed", statusText(status.installed)),
    createStatusRow("Installed copy is current", statusText(status.installedMatchesCurrent)),
    createStatusRow("App path registered", statusText(status.appPathRegistered)),
    createStatusRow("Markdown handlers registered", statusText(status.fileHandlersRegistered)),
    createStatusRow("Right-click entry registered", statusText(status.contextMenuRegistered)),
  );

  const defaultAppsNote = createTextElement(
    "p",
    `${status.appName} will not take over ${PRODUCT.markdownExtensions} defaults automatically. After installing, choose ${status.appName} in Windows Default Apps if you want it as the default handler.`,
    "setup__note",
  );

  const actions = document.createElement("div");
  actions.className = "setup__actions";

  const installButton = createTextElement("button", PRODUCT.installButtonLabel);
  installButton.type = "button";
  installButton.addEventListener("click", () => {
    void runSetupAction(installButton, "install_or_update", status);
  });

  const removeButton = createTextElement("button", PRODUCT.removeButtonLabel);
  removeButton.type = "button";
  removeButton.addEventListener("click", () => {
    void runSetupAction(removeButton, "remove_integration", status);
  });

  const defaultAppsButton = createTextElement("button", PRODUCT.defaultAppsButtonLabel);
  defaultAppsButton.type = "button";
  defaultAppsButton.addEventListener("click", () => {
    void openDefaultApps(status);
  });

  actions.append(installButton, removeButton, defaultAppsButton);

  panel.append(heading, intro, details, defaultAppsNote, actions);

  if (status.message) {
    panel.append(createTextElement("p", status.message, "setup__message"));
  }

  section.append(panel);
  app.replaceChildren(section);
}

async function runSetupAction(
  button: HTMLButtonElement,
  command: "install_or_update" | "remove_integration",
  previousStatus: SetupStatus,
): Promise<void> {
  button.disabled = true;

  try {
    const status = await invoke<SetupStatus>(command);
    renderSetup(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderSetup({ ...previousStatus, message });
  }
}

async function openDefaultApps(status: SetupStatus): Promise<void> {
  try {
    await invoke("open_default_apps_settings");
    renderSetup({
      ...status,
      message: `Windows Default Apps settings opened. Search for ${PRODUCT.markdownExtensions} and choose ${status.appName} if you want it as the default.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderSetup({ ...status, message });
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
    renderState("error", "Could not open the Markdown file.", message);
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

