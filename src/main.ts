import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles.css";

type LoadedDocument = {
  path: string | null;
  fileName: string | null;
  html: string | null;
  error: string | null;
};

const appElement = document.querySelector<HTMLElement>("#app");

if (!appElement) {
  throw new Error("Missing #app root element.");
}

const app = appElement;

function titleFor(documentView: LoadedDocument): string {
  if (documentView.error) {
    return documentView.fileName
      ? `Error: ${documentView.fileName} - Markdown Reader`
      : "Error - Markdown Reader";
  }

  return documentView.fileName
    ? `${documentView.fileName} - Markdown Reader`
    : "Markdown Reader";
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

async function openDroppedFile(path: string): Promise<void> {
  renderState("loading", "Opening Markdown file...");

  try {
    const documentView = await invoke<LoadedDocument>("load_dropped_document", {
      path,
    });
    renderDocument(documentView);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    document.title = "Error - Markdown Reader";
    renderState("error", "Could not open the Markdown file.", message);
  }
}

async function registerDragAndDrop(): Promise<void> {
  await getCurrentWindow().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") {
      return;
    }

    const [path] = event.payload.paths;

    if (path) {
      void openDroppedFile(path);
    }
  });
}

async function start(): Promise<void> {
  void registerDragAndDrop().catch((error) => {
    console.error("failed to register drag-and-drop handler", error);
  });

  try {
    const documentView = await invoke<LoadedDocument>("load_initial_document");
    renderDocument(documentView);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    document.title = "Error - Markdown Reader";
    renderState("error", "Could not start Markdown Reader.", message);
  }
}

void start();

