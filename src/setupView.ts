import { invoke } from "@tauri-apps/api/core";
import { createTextElement } from "./dom";
import { PRODUCT } from "./product";
import type { SetupActionId, SetupCommand, SetupMessage, SetupStatus } from "./types";

export const WINDOWS_SETUP_TITLE = "Hushmark Setup";

const WINDOWS_SETUP_COPY = {
  installRowLabel: "Install Hushmark",
  installedRowLabel: "Installed copy",
  updateRowLabel: "Update Hushmark",
  downgradeRowLabel: "Downgrade Hushmark",
  reinstallRowLabel: "Reinstall Hushmark",
  openWithRowLabel: "Show Hushmark in Open With",
  openWithRowDescription: "Offer Hushmark for .md and .markdown files.",
  contextMenuRowLabel: "Add right-click menu entry",
  contextMenuRowDescription: "Add 'Open with Hushmark' to Markdown file context menus.",
  removeInstalledCopyButtonLabel: "Remove installed copy",
  removeIntegrationButtonLabel: "Remove Hushmark integration",
} as const;

function installRowLabel(status: SetupStatus): string {
  switch (status.installAction) {
    case "current":
      return WINDOWS_SETUP_COPY.installedRowLabel;
    case "update":
      return WINDOWS_SETUP_COPY.updateRowLabel;
    case "downgrade":
      return WINDOWS_SETUP_COPY.downgradeRowLabel;
    case "reinstall":
      return WINDOWS_SETUP_COPY.reinstallRowLabel;
    default:
      return WINDOWS_SETUP_COPY.installRowLabel;
  }
}

function installRowDescription(status: SetupStatus): string {
  const installedVersion = status.installedVersion ?? "an unknown version";

  switch (status.installAction) {
    case "current":
      return status.runningInstalledCopy
        ? "This is the copy in your local Programs folder."
        : `Version ${status.version} is installed in your local Programs folder.`;
    case "update":
    case "downgrade":
      return `Replace installed version ${installedVersion} with version ${status.version}.`;
    case "reinstall":
      return "Replace the installed build with this copy.";
    default:
      return "Keep Hushmark in your local Programs folder.";
  }
}

function installRowStateText(status: SetupStatus): string {
  switch (status.installAction) {
    case "current":
      return `Version ${status.version}`;
    case "update":
      return "Update available";
    case "downgrade":
      return "Newer version installed";
    case "reinstall":
      return "Different build installed";
    default:
      return "Not installed";
  }
}

function showSeparateRemovalAction(status: SetupStatus): boolean {
  return (
    (status.installed && !status.installedMatchesCurrent) ||
    (!status.installed && status.hasRegisteredIntegration)
  );
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

  const check = createTextElement("span", checked ? "\u2713" : "", "integration-row__check");
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

function createMessage(message: SetupMessage): HTMLDivElement {
  const element = document.createElement("div");
  element.className = `setup-message setup-message--${message.kind}`;
  element.append(createTextElement("p", message.text));

  if (message.kind !== "success" && message.details) {
    element.append(createTextElement("pre", message.details, "setup-message__details"));
  }

  return element;
}

export function renderSetup(
  app: HTMLElement,
  status: SetupStatus,
  workingAction: SetupActionId | null = null,
  confirmingAction: SetupActionId | null = null,
): void {
  document.title = WINDOWS_SETUP_TITLE;

  const section = document.createElement("section");
  section.className = "setup";

  const panel = document.createElement("div");
  panel.className = "setup__panel";

  const heading = createTextElement("h1", "Setup");

  const source = createTextElement(
    "p",
    status.runningInstalledCopy
      ? `${status.appName} ${status.version}, running from the installed copy.`
      : `${status.appName} ${status.version}, running as a standalone copy.`,
    "setup__source",
  );
  const intro = createTextElement(
    "p",
    "Choose how Hushmark opens Markdown files on this Windows account.",
    "setup__intro",
  );

  const rows = document.createElement("div");
  rows.className = "integration-rows";
  const installRow = createIntegrationRow(
    app,
    "install",
    installRowLabel(status),
    installRowDescription(status),
    status.installedMatchesCurrent,
    installRowStateText(status),
    "toggle_install",
    status,
    workingAction,
  );
  installRow.setAttribute("aria-expanded", String(confirmingAction === "install"));
  rows.append(installRow);

  if (confirmingAction === "install") {
    rows.append(createSelfUninstallConfirmation(app, status));
  }

  rows.append(
    createIntegrationRow(
      app,
      "openWith",
      WINDOWS_SETUP_COPY.openWithRowLabel,
      WINDOWS_SETUP_COPY.openWithRowDescription,
      status.fileHandlersRegistered,
      status.fileHandlersRegistered ? "Shown" : "Not shown",
      "toggle_open_with_support",
      status,
      workingAction,
    ),
    createIntegrationRow(
      app,
      "contextMenu",
      WINDOWS_SETUP_COPY.contextMenuRowLabel,
      WINDOWS_SETUP_COPY.contextMenuRowDescription,
      status.contextMenuRegistered,
      status.contextMenuRegistered ? "Added" : "Not added",
      "toggle_context_menu",
      status,
      workingAction,
    ),
  );

  const actions = document.createElement("div");
  actions.className = "setup-actions";
  if (showSeparateRemovalAction(status)) {
    actions.append(
      createSecondaryButton(
        app,
        status.installed
          ? WINDOWS_SETUP_COPY.removeInstalledCopyButtonLabel
          : WINDOWS_SETUP_COPY.removeIntegrationButtonLabel,
        "remove_all_integration",
        status,
        "removeAll",
        workingAction,
        true,
      ),
    );
  }

  panel.append(heading, source, intro, rows);

  if (actions.childElementCount > 0) {
    panel.append(actions);
  }

  if (workingAction) {
    panel.append(createTextElement("p", "Working...", "setup-message setup-message--working"));
  } else if (status.message) {
    panel.append(createMessage(status.message));
  }

  section.append(panel);
  app.replaceChildren(section);
}

function createSelfUninstallConfirmation(
  app: HTMLElement,
  status: SetupStatus,
): HTMLElement {
  const confirmation = document.createElement("section");
  confirmation.className = "setup-confirmation";
  confirmation.setAttribute("role", "group");
  confirmation.setAttribute("aria-labelledby", "setup-confirmation-title");

  const heading = createTextElement(
    "h2",
    "Uninstall this copy?",
    "setup-confirmation__title",
  );
  heading.id = "setup-confirmation-title";
  const explanation = createTextElement(
    "p",
    "This is the installed copy. Hushmark will remove its Windows integration and executable, then close.",
  );

  const actions = document.createElement("div");
  actions.className = "setup-confirmation__actions";
  const cancel = createTextElement("button", "Cancel", "button button--secondary");
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    renderSetup(app, status);
  });
  const uninstall = createTextElement("button", "Uninstall", "button button--danger");
  uninstall.type = "button";
  uninstall.addEventListener("click", () => {
    void executeSetupAction(app, "toggle_install", status, "install");
  });
  actions.append(cancel, uninstall);
  confirmation.append(heading, explanation, actions);
  confirmation.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      renderSetup(app, status);
    }
  });
  window.requestAnimationFrame(() => cancel.focus());

  return confirmation;
}

async function runSetupAction(
  app: HTMLElement,
  command: SetupCommand,
  previousStatus: SetupStatus,
  workingAction: SetupActionId,
): Promise<void> {
  if (requiresSelfUninstallConfirmation(command, previousStatus)) {
    renderSetup(app, previousStatus, null, workingAction);
    return;
  }

  await executeSetupAction(app, command, previousStatus, workingAction);
}

async function executeSetupAction(
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

function requiresSelfUninstallConfirmation(
  command: SetupCommand,
  status: SetupStatus,
): boolean {
  if (!status.runningInstalledCopy) {
    return false;
  }

  return command === "remove_all_integration" ||
    (command === "toggle_install" && status.installedMatchesCurrent);
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
