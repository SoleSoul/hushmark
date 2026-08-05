export type ShortcutDefinition = {
  key: string;
  displayKeys: readonly string[];
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
    !event.shiftKey &&
    event.key.toLowerCase() === shortcut.key.toLowerCase()
  );
}
