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
  installed: boolean;
  runningInstalledCopy: boolean;
  installedMatchesCurrent: boolean;
  installAction: "install" | "current" | "update" | "downgrade" | "reinstall";
  hasRegisteredIntegration: boolean;
  fileHandlersRegistered: boolean;
  contextMenuRegistered: boolean;
  message: SetupMessage | null;
};

export type SetupActionId = "install" | "openWith" | "contextMenu" | "removeAll";

export type SetupCommand =
  | "toggle_install"
  | "toggle_open_with_support"
  | "toggle_context_menu"
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

export type PlatformCapabilities = {
  setup: boolean;
};

export type StartupView = {
  platform: string;
  document: LoadedDocument | null;
  capabilities: PlatformCapabilities;
};

export type NavigationView =
  | { kind: "home" }
  | {
      kind: "document";
      document: LoadedDocument;
      fragment: string | null;
    };

export type NavigationEntry = {
  id: number;
  view: NavigationView;
  scrollY: number;
};

export type HushmarkHistoryState = {
  kind: "hushmark-navigation";
  sessionId: number;
  entryId: number;
};
