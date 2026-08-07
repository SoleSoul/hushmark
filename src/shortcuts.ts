export type ShortcutDefinition = {
  key: string;
  alternateKey?: string;
  allowShift?: boolean;
  displayKeys: readonly string[];
  ariaLabel?: string;
};

export const SHORTCUTS = {
  open: { key: "o", displayKeys: ["Ctrl", "O"] },
  print: { key: "p", displayKeys: ["Ctrl", "P"] },
  home: { key: "h", displayKeys: ["Ctrl", "H"] },
  back: {
    key: "ArrowLeft",
    alternateKey: "BrowserBack",
    displayKeys: ["Alt", "Left"],
  },
  forward: {
    key: "ArrowRight",
    alternateKey: "BrowserForward",
    displayKeys: ["Alt", "Right"],
  },
  zoomIn: {
    key: "=",
    alternateKey: "+",
    allowShift: true,
    displayKeys: ["Ctrl", "+ / ="],
    ariaLabel: "Control plus Plus or Equals",
  },
  zoomOut: { key: "-", displayKeys: ["Ctrl", "-"] },
  resetZoom: { key: "0", displayKeys: ["Ctrl", "0"] },
  toggleLayout: { key: "l", displayKeys: ["Ctrl", "L"] },
  cancel: { key: "Escape", displayKeys: ["Esc"] },
} as const;

export function isControlShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition,
): boolean {
  return (
    event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    (!event.shiftKey || shortcut.allowShift === true) &&
    (event.key.toLowerCase() === shortcut.key.toLowerCase() ||
      event.key.toLowerCase() === shortcut.alternateKey?.toLowerCase())
  );
}
