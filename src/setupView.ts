import { invoke } from "@tauri-apps/api/core";
import { createTextElement } from "./dom";
import { PRODUCT } from "./product";
import { isAppShortcut, SHORTCUTS } from "./shortcuts";
import type { SetupActionId, SetupCommand, SetupMessage, SetupStatus } from "./types";

export const WINDOWS_SETUP_TITLE = "Hushmark Setup";

type SetupViewOptions = {
  onBackToHome: () => void;
  workingAction?: SetupActionId | null;
  confirmingAction?: SetupActionId | null;
};

const WINDOWS_SETUP_COPY = {
  installRowLabel: "Install Hushmark",
  installedRowLabel: "Installed copy",
  updateRowLabel: "Update Hushmark",
  downgradeRowLabel: "Downgrade Hushmark",
  reinstallRowLabel: "Reinstall Hushmark",
  openWithRowLabel: "Show Hushmark in Open With",
  openWithRowDescription: "Make Hushmark available in Open With for Markdown files.",
  contextMenuRowLabel: "Add to the right-click menu",
  contextMenuRowDescription:
    "Show 'Open with Hushmark' when you right-click a Markdown file.",
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
      return "Install Hushmark in your local Programs folder.";
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
  onBackToHome: () => void,
): HTMLButtonElement {
  const row = document.createElement("button");
  row.type = "button";
  row.className = `integration-row${checked ? " integration-row--checked" : ""}${
    workingAction === id ? " integration-row--working" : ""
  }`;
  row.disabled = workingAction !== null;
  row.setAttribute("aria-pressed", String(checked));
  row.addEventListener("click", () => {
    void runSetupAction(app, command, status, id, onBackToHome);
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
  onBackToHome: () => void,
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
    void runSetupAction(app, command, status, id, onBackToHome);
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
  options: SetupViewOptions,
): void {
  const {
    onBackToHome,
    workingAction = null,
    confirmingAction = null,
  } = options;
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
    onBackToHome,
  );
  installRow.setAttribute("aria-expanded", String(confirmingAction === "install"));
  rows.append(installRow);

  if (confirmingAction === "install") {
    rows.append(createSelfUninstallConfirmation(app, status, onBackToHome));
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
      onBackToHome,
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
      onBackToHome,
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
        onBackToHome,
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

  const back = createTextElement("button", "Back", "view-corner-action");
  back.type = "button";
  back.disabled = workingAction !== null;
  back.addEventListener("click", onBackToHome);

  section.append(panel, back);
  app.replaceChildren(section);
}

function createSelfUninstallConfirmation(
  app: HTMLElement,
  status: SetupStatus,
  onBackToHome: () => void,
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
    renderSetup(app, status, { onBackToHome });
  });
  const uninstall = createTextElement("button", "Uninstall", "button button--danger");
  uninstall.type = "button";
  uninstall.addEventListener("click", () => {
    void executeSetupAction(
      app,
      "toggle_install",
      status,
      "install",
      onBackToHome,
    );
  });
  actions.append(cancel, uninstall);
  confirmation.append(heading, explanation, actions);
  confirmation.addEventListener("keydown", (event) => {
    if (isAppShortcut(event, SHORTCUTS.cancel, "windows")) {
      event.preventDefault();
      renderSetup(app, status, { onBackToHome });
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
  onBackToHome: () => void,
): Promise<void> {
  if (requiresSelfUninstallConfirmation(command, previousStatus)) {
    renderSetup(app, previousStatus, {
      onBackToHome,
      confirmingAction: workingAction,
    });
    return;
  }

  await executeSetupAction(
    app,
    command,
    previousStatus,
    workingAction,
    onBackToHome,
  );
}

async function executeSetupAction(
  app: HTMLElement,
  command: SetupCommand,
  previousStatus: SetupStatus,
  workingAction: SetupActionId,
  onBackToHome: () => void,
): Promise<void> {
  renderSetup(app, previousStatus, { onBackToHome, workingAction });

  try {
    const status = await invoke<SetupStatus>(command);
    if (!isSetupRendered(app)) {
      return;
    }
    renderSetup(app, status, { onBackToHome });
  } catch (error) {
    if (!isSetupRendered(app)) {
      return;
    }
    const details = error instanceof Error ? error.message : String(error);
    await renderSetupError(
      app,
      previousStatus,
      "That change could not be completed.",
      details,
      onBackToHome,
    );
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

function isSetupRendered(app: HTMLElement): boolean {
  return app.querySelector(":scope > .setup") !== null;
}

async function renderSetupError(
  app: HTMLElement,
  previousStatus: SetupStatus,
  text: string,
  details: string,
  onBackToHome: () => void,
): Promise<void> {
  const message: SetupMessage = { kind: "error", text, details };

  try {
    const status = await invoke<SetupStatus>("get_setup_status");
    if (isSetupRendered(app)) {
      renderSetup(app, { ...status, message }, { onBackToHome });
    }
  } catch {
    if (isSetupRendered(app)) {
      renderSetup(app, { ...previousStatus, message }, { onBackToHome });
    }
  }
}
