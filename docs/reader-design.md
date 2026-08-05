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

Windows setup should feel like an interactive Hushmark document rather than a separate themed control panel. Use the reader's unframed warm canvas, content width, spacing, sans-serif heading hierarchy, serif explanatory copy, restrained rules, and square or lightly rounded controls. Avoid nested cards, a second paper surface inside the window, pills, or large areas of status color.
