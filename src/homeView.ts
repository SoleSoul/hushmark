import { createTextElement } from "./dom";
import {
  ariaLabelForShortcut,
  displayKeysForShortcut,
  SHORTCUTS,
} from "./shortcuts";
import type { ShortcutDefinition } from "./shortcuts";

type Shortcut = {
  action: string;
  definition: ShortcutDefinition;
};

type ShortcutSection = {
  title: string;
  shortcuts: Shortcut[];
};

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Files",
    shortcuts: [
      { action: "Open a Markdown file", definition: SHORTCUTS.open },
      { action: "Print the current document", definition: SHORTCUTS.print },
    ],
  },
  {
    title: "View",
    shortcuts: [
      {
        action: "Zoom in",
        definition: SHORTCUTS.zoomIn,
      },
      { action: "Zoom out", definition: SHORTCUTS.zoomOut },
      { action: "Reset zoom", definition: SHORTCUTS.resetZoom },
      {
        action: "Switch between Page and Full Width",
        definition: SHORTCUTS.toggleLayout,
      },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { action: "Go back", definition: SHORTCUTS.back },
      { action: "Go forward", definition: SHORTCUTS.forward },
      { action: "Home / Help", definition: SHORTCUTS.home },
    ],
  },
];

function createShortcutRow(shortcut: Shortcut, platform: string): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "home__shortcut";

  row.append(createTextElement("span", shortcut.action, "home__action"));

  const leader = document.createElement("span");
  leader.className = "home__leader";
  leader.setAttribute("aria-hidden", "true");
  row.append(leader);

  const keys = document.createElement("span");
  keys.className = "home__keys";
  const displayKeys = displayKeysForShortcut(shortcut.definition, platform);
  keys.setAttribute(
    "aria-label",
    ariaLabelForShortcut(shortcut.definition, platform) ??
      displayKeys.join(" plus "),
  );

  displayKeys.forEach((key, index) => {
    if (index > 0) {
      keys.append(createTextElement("span", "+", "home__key-separator"));
    }
    keys.append(createTextElement("kbd", key));
  });

  row.append(keys);
  return row;
}

function createShortcutSection(
  section: ShortcutSection,
  platform: string,
): HTMLElement {
  const element = document.createElement("section");
  element.className = "home__section";
  element.append(createTextElement("h2", section.title));

  const list = document.createElement("ol");
  list.className = "home__shortcuts";
  list.append(
    ...section.shortcuts.map((shortcut) => createShortcutRow(shortcut, platform)),
  );
  element.append(list);

  return element;
}

export function createHomeView(platform: string): HTMLElement {
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
  contents.append(
    ...SHORTCUT_SECTIONS.map((section) =>
      createShortcutSection(section, platform),
    ),
  );
  page.append(contents);

  home.append(page);
  return home;
}
