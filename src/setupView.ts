import { invoke } from "@tauri-apps/api/core";
import { createTextElement } from "./dom";
import { PRODUCT } from "./product";
import type { SetupActionId, SetupCommand, SetupMessage, SetupStatus } from "./types";

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
  app: HTMLElement,
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
    void runSetupAction(app, command, status, id);
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
  app: HTMLElement,
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
    void runSetupAction(app, command, status, id);
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

function createUnsupportedDetails(status: SetupStatus): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "setup-details";

  const summary = createTextElement("summary", "Details");
  const rows = document.createElement("dl");
  rows.className = "setup-details__rows";
  rows.append(
    createDetailRow("App", status.appName),
    createDetailRow("Version", status.version),
    createDetailRow("Platform", status.platform),
    createDetailRow("Current executable", status.currentExePath),
  );

  if (status.message?.details) {
    rows.append(createDetailRow("Details", status.message.details));
  }

  details.append(summary, rows);
  return details;
}

export function renderSetup(
  app: HTMLElement,
  status: SetupStatus,
  workingAction: SetupActionId | null = null,
): void {
  document.title = PRODUCT.setupTitle;

  const section = document.createElement("section");
  section.className = "setup";

  const panel = document.createElement("div");
  panel.className = "setup__panel";

  const heading = createTextElement("h1", status.appName);

  if (!status.setupSupported) {
    const intro = createTextElement(
      "p",
      status.message?.text ?? "Setup integration is currently only available on Windows.",
      "setup__intro",
    );

    panel.append(heading, intro, createUnsupportedDetails(status));
    section.append(panel);
    app.replaceChildren(section);
    return;
  }

  const intro = createTextElement(
    "p",
    "Choose how Hushmark integrates with Markdown files on this Windows account.",
    "setup__intro",
  );

  const rows = document.createElement("div");
  rows.className = "integration-rows";
  rows.append(
    createIntegrationRow(
      app,
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
      app,
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
      app,
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
      app,
      PRODUCT.chooseDefaultButtonLabel,
      "open_default_apps_settings",
      status,
      "defaultApps",
      workingAction,
    ),
    createSecondaryButton(
      app,
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
  app: HTMLElement,
  command: SetupCommand,
  previousStatus: SetupStatus,
  workingAction: SetupActionId,
): Promise<void> {
  renderSetup(app, previousStatus, workingAction);

  try {
    const status = await invoke<SetupStatus>(command);
    renderSetup(app, status);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    await renderSetupError(app, previousStatus, "That change could not be completed.", details);
  }
}

async function renderSetupError(
  app: HTMLElement,
  previousStatus: SetupStatus,
  text: string,
  details: string,
): Promise<void> {
  const message: SetupMessage = { kind: "error", text, details };

  try {
    const status = await invoke<SetupStatus>("get_setup_status");
    renderSetup(app, { ...status, message });
  } catch {
    renderSetup(app, { ...previousStatus, message });
  }
}
