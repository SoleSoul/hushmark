import { createTextElement } from "./dom";
import { SHORTCUTS } from "./shortcuts";

type Shortcut = {
  action: string;
  keys: readonly string[];
  keysAriaLabel?: string;
};

type ShortcutSection = {
  title: string;
  shortcuts: Shortcut[];
};

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Files",
    shortcuts: [
      { action: "Open a Markdown file", keys: SHORTCUTS.open.displayKeys },
      { action: "Print the current document", keys: SHORTCUTS.print.displayKeys },
    ],
  },
  {
    title: "View",
    shortcuts: [
      {
        action: "Zoom in",
        keys: SHORTCUTS.zoomIn.displayKeys,
        keysAriaLabel: SHORTCUTS.zoomIn.ariaLabel,
      },
      { action: "Zoom out", keys: SHORTCUTS.zoomOut.displayKeys },
      { action: "Reset zoom", keys: SHORTCUTS.resetZoom.displayKeys },
      {
        action: "Switch between Page and Full Width",
        keys: SHORTCUTS.toggleLayout.displayKeys,
      },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { action: "Go back", keys: SHORTCUTS.back.displayKeys },
      { action: "Go forward", keys: SHORTCUTS.forward.displayKeys },
      { action: "Help", keys: SHORTCUTS.home.displayKeys },
    ],
  },
];

function createShortcutRow(shortcut: Shortcut): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "home__shortcut";

  row.append(createTextElement("span", shortcut.action, "home__action"));

  const leader = document.createElement("span");
  leader.className = "home__leader";
  leader.setAttribute("aria-hidden", "true");
  row.append(leader);

  const keys = document.createElement("span");
  keys.className = "home__keys";
  keys.setAttribute(
    "aria-label",
    shortcut.keysAriaLabel ?? shortcut.keys.join(" plus "),
  );

  shortcut.keys.forEach((key, index) => {
    if (index > 0) {
      keys.append(createTextElement("span", "+", "home__key-separator"));
    }
    keys.append(createTextElement("kbd", key));
  });

  row.append(keys);
  return row;
}

function createShortcutSection(section: ShortcutSection): HTMLElement {
  const element = document.createElement("section");
  element.className = "home__section";
  element.append(createTextElement("h2", section.title));

  const list = document.createElement("ol");
  list.className = "home__shortcuts";
  list.append(...section.shortcuts.map(createShortcutRow));
  element.append(list);

  return element;
}

export function createHomeView(): HTMLElement {
  const home = document.createElement("section");
  home.className = "home";
  home.setAttribute("aria-labelledby", "home-title");

  const page = document.createElement("div");
  page.className = "home__page";

  const header = document.createElement("header");
  header.className = "home__header";
  const title = createTextElement("h1", "Hushmark");
  title.id = "home-title";
  header.append(title, createTextElement("p", "A calm Markdown reader."));
  page.append(header);

  const contents = document.createElement("div");
  contents.className = "home__contents";
  contents.append(...SHORTCUT_SECTIONS.map(createShortcutSection));
  page.append(contents);

  home.append(page);
  return home;
}
