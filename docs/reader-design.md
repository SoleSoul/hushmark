# Hushmark reader design

Hushmark is a quiet Markdown reader with calm typography, minimal chrome, and no editor clutter.

The reader should feel like opening a focused document, not a web article, IDE, or notes workspace. The default presentation favors a comfortable text column, restrained headings, soft contrast, readable code blocks, and simple empty/error states.

Design boundaries:

- Keep the window focused on the current document.
- Prefer system and browser primitives over custom UI machinery.
- Support light and dark system appearance without adding a theme system yet.
- Avoid sidebars, tabs, editor controls, source views, and settings surfaces in the reader.

