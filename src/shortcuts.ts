type ShortcutDisplayKeys = readonly [string, ...string[]];
type ShortcutModifier = "none" | "control" | "alt" | "command";
type ShortcutShift = "forbidden" | "required" | "allowed";

type ShortcutChord = {
  keys: readonly [string, ...string[]];
  modifier: ShortcutModifier;
  shift?: ShortcutShift;
};

type PlatformShortcut = {
  chords: readonly [ShortcutChord, ...ShortcutChord[]];
  displayKeys: ShortcutDisplayKeys;
  ariaLabel?: string;
};

export type ShortcutDefinition = {
  default: PlatformShortcut;
  macos: PlatformShortcut;
};

export const SHORTCUTS = {
  open: {
    default: {
      chords: [{ keys: ["o"], modifier: "control" }],
      displayKeys: ["Ctrl", "O"],
    },
    macos: {
      chords: [{ keys: ["o"], modifier: "command" }],
      displayKeys: ["⌘O"],
    },
  },
  print: {
    default: {
      chords: [{ keys: ["p"], modifier: "control" }],
      displayKeys: ["Ctrl", "P"],
    },
    macos: {
      chords: [{ keys: ["p"], modifier: "command" }],
      displayKeys: ["⌘P"],
    },
  },
  home: {
    default: {
      chords: [{ keys: ["h"], modifier: "control" }],
      displayKeys: ["Ctrl", "H"],
    },
    macos: {
      chords: [
        {
          keys: ["h", "?"],
          modifier: "command",
          shift: "required",
        },
      ],
      displayKeys: ["⇧⌘H / ⌘?"],
      ariaLabel: "Shift Command H or Command Question Mark",
    },
  },
  back: {
    default: {
      chords: [
        { keys: ["ArrowLeft"], modifier: "alt" },
        { keys: ["BrowserBack"], modifier: "none" },
      ],
      displayKeys: ["Alt", "Left"],
    },
    macos: {
      chords: [{ keys: ["["], modifier: "command" }],
      displayKeys: ["⌘["],
    },
  },
  forward: {
    default: {
      chords: [
        { keys: ["ArrowRight"], modifier: "alt" },
        { keys: ["BrowserForward"], modifier: "none" },
      ],
      displayKeys: ["Alt", "Right"],
    },
    macos: {
      chords: [{ keys: ["]"], modifier: "command" }],
      displayKeys: ["⌘]"],
    },
  },
  zoomIn: {
    default: {
      chords: [
        {
          keys: ["=", "+"],
          modifier: "control",
          shift: "allowed",
        },
      ],
      displayKeys: ["Ctrl", "+ / ="],
      ariaLabel: "Control plus Plus or Equals",
    },
    macos: {
      chords: [
        {
          keys: ["=", "+"],
          modifier: "command",
          shift: "allowed",
        },
      ],
      displayKeys: ["⌘+"],
      ariaLabel: "Command Plus",
    },
  },
  zoomOut: {
    default: {
      chords: [{ keys: ["-"], modifier: "control" }],
      displayKeys: ["Ctrl", "-"],
    },
    macos: {
      chords: [{ keys: ["-"], modifier: "command" }],
      displayKeys: ["⌘−"],
    },
  },
  resetZoom: {
    default: {
      chords: [{ keys: ["0"], modifier: "control" }],
      displayKeys: ["Ctrl", "0"],
    },
    macos: {
      chords: [{ keys: ["0"], modifier: "command" }],
      displayKeys: ["⌘0"],
    },
  },
  toggleLayout: {
    default: {
      chords: [{ keys: ["l"], modifier: "control" }],
      displayKeys: ["Ctrl", "L"],
    },
    macos: {
      chords: [{ keys: ["l"], modifier: "command" }],
      displayKeys: ["⌘L"],
      ariaLabel: "Command L",
    },
  },
  cancel: {
    default: {
      chords: [{ keys: ["Escape"], modifier: "none" }],
      displayKeys: ["Esc"],
    },
    macos: {
      chords: [{ keys: ["Escape"], modifier: "none" }],
      displayKeys: ["Esc"],
    },
  },
} as const satisfies Record<string, ShortcutDefinition>;

export function displayKeysForShortcut(
  shortcut: ShortcutDefinition,
  platform: string,
): ShortcutDisplayKeys {
  return shortcutForPlatform(shortcut, platform).displayKeys;
}

export function ariaLabelForShortcut(
  shortcut: ShortcutDefinition,
  platform: string,
): string | undefined {
  return shortcutForPlatform(shortcut, platform).ariaLabel;
}

export function isAppShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition,
  platform: string,
): boolean {
  return shortcutForPlatform(shortcut, platform).chords.some((chord) =>
    matchesChord(event, chord),
  );
}

function shortcutForPlatform(
  shortcut: ShortcutDefinition,
  platform: string,
): PlatformShortcut {
  return platform === "macos" ? shortcut.macos : shortcut.default;
}

function matchesChord(event: KeyboardEvent, chord: ShortcutChord): boolean {
  const eventKey = event.key.toLowerCase();
  const keyMatches = chord.keys.some(
    (key) => eventKey === key.toLowerCase(),
  );
  const shift = chord.shift ?? "forbidden";
  const shiftMatches =
    shift === "allowed" ||
    (shift === "required" ? event.shiftKey : !event.shiftKey);

  return keyMatches && shiftMatches && matchesModifier(event, chord.modifier);
}

function matchesModifier(
  event: KeyboardEvent,
  modifier: ShortcutModifier,
): boolean {
  switch (modifier) {
    case "none":
      return !event.ctrlKey && !event.metaKey && !event.altKey;
    case "control":
      return event.ctrlKey && !event.metaKey && !event.altKey;
    case "alt":
      return event.altKey && !event.ctrlKey && !event.metaKey;
    case "command":
      return event.metaKey && !event.ctrlKey && !event.altKey;
  }
}
