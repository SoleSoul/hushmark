import type { DocumentViewPreferences } from "./documentView";

export type PlatformShellState = {
  canGoBack: boolean;
  canGoForward: boolean;
  canPrintDocument: boolean;
  hasDocument: boolean;
  layout: DocumentViewPreferences["layout"];
};

export type PlatformShellHandlers = {
  openDocumentPath: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  showHome: () => void;
  setLayout: (layout: DocumentViewPreferences["layout"]) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
};

export type PlatformShell = {
  takePendingOpenDocuments: () => Promise<string[]>;
  printDocument: () => Promise<void>;
  updateState: (state: PlatformShellState) => Promise<void>;
};

export const defaultPlatformShell: PlatformShell = {
  takePendingOpenDocuments: async () => [],
  printDocument: async () => {
    window.print();
  },
  updateState: async () => undefined,
};

export async function createPlatformShell(
  platform: string,
  handlers: PlatformShellHandlers,
): Promise<PlatformShell> {
  if (platform !== "macos") {
    return defaultPlatformShell;
  }

  const { createMacosShell } = await import("./macos");
  return createMacosShell(handlers);
}
