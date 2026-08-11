import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  PlatformShell,
  PlatformShellHandlers,
} from "./platformShell";

type MacosMenuCommand =
  | "macos-back"
  | "macos-forward"
  | "macos-home"
  | "macos-help"
  | "macos-page"
  | "macos-full-width"
  | "macos-zoom-in"
  | "macos-zoom-out"
  | "macos-actual-size";

const MENU_EVENT = "hushmark://macos-menu";
const OPEN_DOCUMENT_EVENT = "hushmark://macos-open-document";

export async function createMacosShell(
  handlers: PlatformShellHandlers,
): Promise<PlatformShell> {
  let menuStateQueue = Promise.resolve();

  await Promise.all([
    listen<MacosMenuCommand>(MENU_EVENT, (event) => {
      handleMenuCommand(event.payload, handlers);
    }),
    listen<string>(OPEN_DOCUMENT_EVENT, (event) => {
      handlers.openDocumentPath(event.payload);
    }),
  ]);

  return {
    takePendingOpenDocuments: () =>
      invoke<string[]>("macos_frontend_ready"),
    printDocument: () => invoke("print_macos_document"),
    updateState: (state) => {
      const update = menuStateQueue.then(() =>
        invoke<void>("update_macos_menu_state", { state }),
      );
      menuStateQueue = update.catch(() => undefined);
      return update;
    },
  };
}

function handleMenuCommand(
  command: MacosMenuCommand,
  handlers: PlatformShellHandlers,
): void {
  switch (command) {
    case "macos-back":
      handlers.goBack();
      break;
    case "macos-forward":
      handlers.goForward();
      break;
    case "macos-home":
    case "macos-help":
      handlers.showHome();
      break;
    case "macos-page":
      handlers.setLayout("page");
      break;
    case "macos-full-width":
      handlers.setLayout("full-width");
      break;
    case "macos-zoom-in":
      handlers.zoomIn();
      break;
    case "macos-zoom-out":
      handlers.zoomOut();
      break;
    case "macos-actual-size":
      handlers.resetZoom();
      break;
  }
}
