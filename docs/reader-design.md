# Hushmark reader design

Hushmark is a quiet Markdown reader with calm typography, minimal chrome, and no editor clutter.

The reader should feel like opening a focused document, not a web article, IDE, or notes workspace. The default presentation should favor a comfortable text column, restrained styling, readable code blocks, and simple empty/error states.

Design boundaries:

- Keep the window focused on the current document.
- Use local system fonts: Georgia for document body text on Windows, Noto Serif or Linux Libertine where available on Linux, system sans-serif for UI and document headings, and system monospace for code.
- Keep reader sizes stable while resizing. Bundle a reader font only if it clearly improves the experience across target platforms.
- Keep document headings clearly distinct from body text through weight and a stable size hierarchy.
- Prefer system and browser primitives over custom UI machinery.
- Avoid sidebars, tabs, editor controls, source views, and settings surfaces in the reader.

The default Page layout keeps the established 760px preferred document width and surrounding whitespace. Zoom scales text and that preferred page width together, allowing the viewport to constrain it naturally. Full Width removes the artificial measure cap while retaining stable side padding; zoom changes text size but not the available content width. Both are keyboard-only document presentation controls and must not affect Home, Setup, error states, or print output. Page at 100% is restored on every launch so the paper-like reading view remains Hushmark's deliberate default.

The no-document home view may carry more information than the reader itself. Treat it as a restrained book contents page: keep the Hushmark title and short identity line prominent, group keyboard commands by purpose, and use dotted leaders to connect actions to their keys. It belongs in the same navigation history as documents so Home, Back, and Forward feel like movement between pages rather than application chrome.

Windows setup should feel like an interactive Hushmark document rather than a separate themed control panel. Use the reader's unframed warm canvas, content width, spacing, sans-serif heading hierarchy, serif explanatory copy, restrained rules, and square or lightly rounded controls. Avoid nested cards, a second paper surface inside the window, pills, or large areas of status color.
