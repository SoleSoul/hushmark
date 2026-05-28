export type LoadedDocument = {
  path: string | null;
  navigationRoot: string | null;
  fileName: string | null;
  html: string | null;
  error: string | null;
};

export type SetupMessage = {
  kind: "success" | "warning" | "error";
  text: string;
  details: string | null;
};

export type SetupStatus = {
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

export type SetupActionId = "install" | "openWith" | "contextMenu" | "defaultApps" | "removeAll";

export type SetupCommand =
  | "toggle_install"
  | "toggle_open_with_support"
  | "toggle_context_menu"
  | "open_default_apps_settings"
  | "remove_all_integration";

export type LinkAction =
  | { kind: "internal"; fragment: string }
  | { kind: "external"; url: string }
  | { kind: "document"; href: string }
  | { kind: "unsupported" };

export type LinkedDocument = {
  document: LoadedDocument;
  fragment: string | null;
};

export type StartupView = {
  mode: "reader" | "setup";
  document: LoadedDocument | null;
  setup: SetupStatus | null;
};

export type DocumentNavigationEntry = {
  id: number;
  document: LoadedDocument;
  fragment: string | null;
  scrollY: number;
};

export type HushmarkHistoryState = {
  kind: "hushmark-document";
  sessionId: number;
  entryId: number;
};
