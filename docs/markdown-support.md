# Hushmark Markdown support

Hushmark targets CommonMark-style Markdown with selected extensions. It uses `pulldown-cmark` in Rust to parse and render Markdown, then sanitizes the generated HTML with `ammonia` before the content reaches the WebView.

This is a support baseline, not a claim of full GitHub-Flavored Markdown, MultiMarkdown, or editor-grade Markdown compatibility.

## Current parser configuration

Markdown rendering is configured in `src-tauri/src/document.rs`.

The current `pulldown-cmark` options are:

- `Options::ENABLE_TABLES`
- `Options::ENABLE_STRIKETHROUGH`

All other non-CommonMark options remain disabled for now.

## Supported baseline

The reader is expected to handle ordinary CommonMark-style documents with:

- headings
- paragraphs
- soft and hard line breaks
- emphasis and strong emphasis
- inline code and fenced code blocks
- blockquotes
- unordered, ordered, and nested lists
- links
- auto-generated heading anchors and same-document `#fragment` links
- images as Markdown syntax, including relative local image paths under the opened document's folder
- horizontal rules
- tables
- strikethrough
- Unicode text, including Hebrew

## Known limitations

- Task lists are not enabled. `- [x] item` renders as ordinary list text, not as a checkbox.
- Footnotes are not enabled. Footnote syntax is not rendered as numbered footnotes; depending on the exact text, it remains visible text or is treated as ordinary CommonMark link-reference syntax.
- Heading attributes are not enabled. `# Heading {#id .class}` remains heading text instead of setting an explicit author-provided HTML `id` or class.
- Broader GitHub-Flavored Markdown behavior is not enabled beyond tables and strikethrough.
- Definition lists, math, metadata blocks, smart punctuation, superscript, subscript, and wikilinks are not enabled.
- Raw HTML is parsed by `pulldown-cmark`, but Hushmark sanitizes the resulting HTML with `ammonia`. Safe tags and attributes may remain; unsafe elements, event handlers, and dangerous URL schemes should not.
- Relative local image paths are resolved only for Markdown image syntax. Raw HTML image tags are sanitized but are not rewritten against the Markdown file location.
- Local image paths must stay inside the opened document's folder. Parent-directory traversal such as `../`, absolute local paths, and unsupported local file extensions are not resolved.
- Local image files are embedded into the rendered document as `data:` image URLs after sanitization. This keeps Hushmark from exposing a broader local-file protocol to the WebView.

## Link behavior

- Same-document `#fragment` links stay inside Hushmark and scroll to generated heading anchors when a matching heading exists.
- External `http://`, `https://`, and `mailto:` links open in the system default browser or mail app.
- Other schemes, including `javascript:`, `file:`, and `data:`, are not opened by Hushmark.

## Heading anchors

Hushmark generates safe heading IDs for Markdown headings so links like `[Jump](#my-section)` can move within the current document.

Slug behavior:

- Heading text is lowercased.
- Letters and numbers, including Unicode letters such as Hebrew, are preserved.
- Runs of spaces and punctuation become a single `-`.
- Leading and trailing `-` characters are removed.
- Empty or punctuation-only headings use `heading`.
- Duplicate headings receive stable numeric suffixes: `intro`, `intro-1`, `intro-2`.

Examples:

- `Introduction` -> `introduction`
- `My Section` -> `my-section`
- `Install / Update` -> `install-update`
- `שלום עולם` -> `שלום-עולם`

This behavior is stable for Hushmark, but it is not claimed to be exact GitHub anchor compatibility.

## Visual fixture

Open `examples/markdown-features.md` when checking reader changes. It intentionally covers common Markdown shapes plus unsupported syntax examples.

Manual visual checklist:

- The document stays within the reading column.
- Headings H1-H6 are readable and clearly ordered.
- Paragraphs, lists, blockquotes, and horizontal rules remain calm and readable.
- Code blocks and very long code/path lines scroll horizontally instead of breaking the page.
- Tables remain usable and do not force the whole window wider.
- Intra-document links scroll to the expected generated heading anchors.
- External `https:` links open outside Hushmark, while unsupported schemes fail harmlessly.
- Relative Markdown images render when the referenced file is under the document folder.
- Images do not overflow the reading column.
- Hebrew and mixed English/Hebrew text display correctly.
- Raw unsafe HTML does not execute or display unsafe script/link behavior.
