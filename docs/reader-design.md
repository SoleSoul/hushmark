# Hushmark reader design

Hushmark is a quiet Markdown reader with calm typography, minimal chrome, and no editor clutter.

The reader should feel like opening a focused document, not a web article, IDE, or notes workspace. The default presentation should favor a comfortable text column, restrained styling, readable code blocks, and simple empty/error states.

Design boundaries:

- Keep the window focused on the current document.
- Use local system fonts: a serif stack for document body text, system sans-serif for UI and document headings, and system monospace for code.
- Keep reader sizes stable while resizing. Bundle a reader font only if it clearly improves the experience across target platforms.
- Prefer system and browser primitives over custom UI machinery.
- Avoid sidebars, tabs, editor controls, source views, and settings surfaces in the reader.
