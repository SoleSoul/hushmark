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
- relative `.md` and `.markdown` document links under the starting document folder
- images as Markdown syntax, including relative local image paths under the opened document's folder
- safe raw HTML `<img>` tags with relative local image paths under the opened document's folder
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
- Raw HTML is parsed by `pulldown-cmark`, but Hushmark sanitizes the resulting HTML with `ammonia`. Safe tags and attributes may remain; unsafe elements, event handlers, arbitrary style attributes, and dangerous URL schemes should not.
- Relative Markdown document links must stay inside the navigation root, which is the folder of the first opened Markdown file. Absolute local paths, `file://` links, links outside that root, and links to non-Markdown files are not opened.
- Relative local image paths are resolved for Markdown image syntax and sanitized raw HTML `<img src="...">` tags. Raw HTML image support is limited to rewriting safe relative local image `src` values; it does not provide broader raw HTML or local-file access.
- Local image paths must stay inside the opened document's folder. Parent-directory traversal such as `../`, `file://` URLs, absolute local paths, and unsupported local file extensions are not resolved.
- Local image files are embedded into the rendered document as `data:` image URLs after sanitization. This keeps Hushmark from exposing a broader local-file protocol to the WebView.

## Link behavior

- Same-document `#fragment` links stay inside Hushmark, scroll to generated heading anchors when a matching heading exists, and participate in Hushmark Back/Forward history.
- Relative links to `.md` and `.markdown` files open inside Hushmark. Links with fragments, such as `chapter-2.md#install`, open the linked document and then scroll to the matching heading anchor.
- Back/Forward navigation for same-document fragments and relative Markdown document links is handled by Hushmark's app history. Alt+Left returns to the previous document or scroll position; Alt+Right returns to the next document or fragment after going back.
- Missing same-document fragments fail harmlessly and do not add broken history entries.
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
- Relative `.md` and `.markdown` links open inside Hushmark, and blocked relative links fail harmlessly.
- External `https:` links open outside Hushmark, while unsupported schemes fail harmlessly.
- Relative Markdown images render when the referenced file is under the document folder.
- Relative raw HTML `<img>` images render when the referenced file is under the document folder and uses a supported image extension.
- Images do not overflow the reading column.
- Hebrew and mixed English/Hebrew text display correctly.
- Raw unsafe HTML does not execute or display unsafe script/link behavior.
