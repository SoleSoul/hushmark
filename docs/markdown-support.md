# Hushmark Markdown support

Hushmark targets CommonMark-style Markdown with selected extensions. It uses `pulldown-cmark` in Rust to parse and render Markdown, then sanitizes the generated HTML with `ammonia` before the content reaches the WebView.

This is a support baseline, not a claim of full GitHub-Flavored Markdown, MultiMarkdown, or editor-grade Markdown compatibility.

## Current parser configuration

Markdown rendering is configured in `src-tauri/src/document.rs`.

The current `pulldown-cmark` options are:

- `Options::ENABLE_TABLES`
- `Options::ENABLE_STRIKETHROUGH`
- `Options::ENABLE_MATH`
- `Options::ENABLE_TASKLISTS`

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
- `---`-delimited YAML front matter at the start of a file
- tables
- strikethrough
- read-only task lists
- inline `$...$` and display `$$...$$` TeX mathematics
- fenced Mermaid diagrams
- Unicode text, including Hebrew
- per-block right-to-left and left-to-right text direction

## Known limitations

- Footnotes are not enabled. Footnote syntax is not rendered as numbered footnotes; depending on the exact text, it remains visible text or is treated as ordinary CommonMark link-reference syntax.
- Heading attributes are not enabled. `# Heading {#id .class}` remains heading text instead of setting an explicit author-provided HTML `id` or class.
- Broader GitHub-Flavored Markdown behavior is not enabled beyond tables and strikethrough.
- Definition lists, smart punctuation, superscript, subscript, and wikilinks are not enabled.
- Raw HTML is parsed by `pulldown-cmark`, but Hushmark sanitizes the resulting HTML with `ammonia`. Safe tags and attributes may remain; unsafe elements, event handlers, arbitrary style attributes, and dangerous URL schemes should not.
- Relative Markdown document links must stay inside the navigation root, which is the folder of the first opened Markdown file. Absolute local paths, `file://` links, links outside that root, and links to non-Markdown files are not opened.
- Relative local image paths are resolved for Markdown image syntax and sanitized raw HTML `<img src="...">` tags. Raw HTML image support is limited to rewriting safe relative local image `src` values; it does not provide broader raw HTML or local-file access.
- Local image paths must stay inside the opened document's folder. Parent-directory traversal such as `../`, `file://` URLs, absolute local paths, and unsupported local file extensions are not resolved.
- Local image files are embedded into the rendered document as `data:` image URLs after sanitization. This keeps Hushmark from exposing a broader local-file protocol to the WebView.

## Table layout

Tables use the browser's automatic, content-sensitive column sizing. Ordinary short words contribute their natural minimum width, prose wraps at normal opportunities, and exceptionally long unbroken content can break as an emergency. When reasonable column minimums exceed the reader width, overflow should remain local to the table rather than forcing compact columns into character-by-character wrapping or widening the whole document.

Do not impose equal-width or position-based column rules on general Markdown tables. Markdown does not identify columns as labels, numbers, or prose, so fixed widths and first-column assumptions create surprising results across real documents.

Possible future minimum-height optimization approaches are recorded in `docs/table-layout-optimization.md`. Current Hushmark behavior intentionally remains browser-driven.

## Text direction

Hushmark follows the per-block direction model used by common rendered-Markdown hosts such as GitHub and GitLab, built on the HTML `dir="auto"` attribute. `dir="auto"` resolves a block's base direction from its first strong character, as in Unicode Bidirectional Algorithm rules P2 and P3. This suits Markdown, which has no direction syntax of its own.

- Top-level paragraphs, headings, blockquotes, lists, and tables, plus the front matter block and each front matter value, receive `dir="auto"` from the Rust renderer.
- Blockquotes, lists, and tables resolve one direction for their whole contents, and everything nested inside them inherits it. List markers, quote rules, and column order therefore stay consistent when items or cells mix scripts, and tight and loose lists behave alike. Nested blocks deliberately do not receive their own `dir="auto"`: HTML skips descendants with their own `dir` when resolving `dir="auto"`, which would leave a quote or loose list resolving left to right regardless of its text.
- Inside an inherited right-to-left context, a left-to-right fragment ending in punctuation, such as `C++` alone in a table cell, follows ordinary bidi ordering. Authors can wrap such a fragment in `<bdi>` to isolate it.
- A block with no strong characters, such as one containing only digits or punctuation, follows the WebView's `dir="auto"` fallback.
- Inline code, code blocks, invalid Mermaid source, and mathematics always read left to right and are bidi-isolated from surrounding text, so a Hebrew sentence cannot reorder their punctuation.
- Reader styles use logical properties, so the blockquote rule, list indentation, task-list markers, front matter rule, and default table-header alignment follow each block's direction on screen and in print. Right-to-left tables and front matter sit against the right edge of the measure.
- Explicit Markdown table alignment (`:---`, `---:`) stays physical left or right, as specified by GitHub-Flavored Markdown.
- Authored raw HTML may set `dir="ltr"`, `dir="rtl"`, or `dir="auto"` on any allowed element, and `<bdi>` / `<bdo>` are kept. Other `dir` values are removed.
- An explicit authored direction wins over detection. Markdown blocks inside raw HTML whose nearest `dir` is `ltr` or `rtl`, such as the common `<div dir="rtl">` wrapper separated from its Markdown by blank lines, inherit that direction instead of receiving `dir="auto"`. A Hebrew list whose first item starts with an English term therefore stays right to left inside such a wrapper. A nearer `dir="auto"` wrapper restores detection. This deliberately differs from GitHub, where wrapped blocks still resolve their own direction.
- The renderer follows authored wrappers by reading opening and closing tags in raw HTML, skipping comments, void elements, and self-closing tags. This only decides where `dir="auto"` is added; the sanitizer still checks all authored HTML.
- There is no document-wide direction setting or detection, and Home, Setup, and error states remain left to right.

## Mathematics

Hushmark recognizes `$...$` as inline mathematics and `$$...$$` as display mathematics through `pulldown-cmark`'s math extension. Math delimiters protect their contents from ordinary Markdown interpretation. Unclosed delimiters remain plain source.

The Rust renderer emits escaped, controlled math spans before sanitization. Temporary unforgeable classes prevent raw author HTML from opting into the math renderer. After sanitization, the frontend uses a locally bundled KaTeX build to typeset only those spans. KaTeX runs with untrusted commands disabled and bounded size and macro expansion. Its published stylesheet is narrowed during Vite preprocessing to WOFF2 font sources supported by Hushmark's modern WebViews, avoiding redundant WOFF and TTF copies while keeping the canonical KaTeX styling. The build fails if those upstream font declarations change unexpectedly. Invalid or unsupported formulas retain their original source and delimiters rather than disappearing.

KaTeX accepts a practical TeX mathematics subset, not complete LaTeX documents or arbitrary packages. Display expressions are centered and receive local horizontal overflow when they cannot fit the reading width. Screen zoom scales typeset mathematics with the rest of the document, while print output ignores screen layout and zoom preferences.

## Mermaid diagrams

Hushmark recognizes fenced code blocks whose first info-string word is `mermaid`, case-insensitively. The Rust Markdown renderer gives only genuine Mermaid fences an unforgeable class that survives sanitization; raw author HTML cannot opt into diagram rendering. Hushmark prepares diagrams before displaying the complete document, so Mermaid source does not flash during loading. Invalid diagrams remain ordinary escaped code blocks.

The frontend loads the locally bundled official Mermaid renderer only when a document contains a recognized fence. It prepares the complete article off-screen, including diagram rendering and image decoding, then displays it once before restoring the reading position. The generated SVG is displayed through a `data:` image rather than inserted as live SVG document content. This retains vector scaling and printing while preventing diagram scripts, links, handlers, and embedded elements from becoming interactive Hushmark DOM.

Mermaid runs in strict security mode with HTML labels and click behavior unavailable. Renderer security settings, CSS injection settings, global font settings, input length, and edge limits cannot be overridden by diagram directives or Mermaid front matter. Hushmark supplies reader-aligned typography by default, while Mermaid's diagram-specific typography remains ordinary author configuration alongside layout, curves, look, and safe theme variables. A diagram is limited to 50,000 source characters and 500 edges. Hushmark does not fetch Mermaid or diagram resources from a CDN.

Diagram figures stay within the document measure, scale with Hushmark zoom, and fit the printable page. The official Mermaid package supports many diagram families, but Hushmark does not separately promise every Mermaid syntax or external icon pack. Invalid, unsupported, or resource-limited diagrams retain their escaped source and receive a restrained explanatory tooltip.

Hushmark leaves Mermaid's sequence-diagram participant mirroring at its default, so participant labels appear at both the top and bottom unless the author configures the diagram otherwise.

## YAML front matter

Hushmark recognizes YAML front matter only when the first line is exactly `---` and a later line contains a matching `---` delimiter. A source pre-parser returns structured metadata and the untouched Markdown body before `pulldown-cmark` runs. Valid metadata is shown as a subdued key/value block, and the front matter lines are omitted from the Markdown body.

Single values such as text, numbers, booleans, and `null` are displayed directly. Author-intended line breaks and repeated spaces within text values are preserved while long lines continue to wrap. Lists use a plain inline representation, while nested mappings retain their key/value hierarchy with restrained inline styling. Values are not interpreted as Markdown or HTML. Metadata output is escaped and passes through the same HTML sanitizer as the rendered document.

If the YAML is malformed or the closing delimiter is missing, Hushmark treats the entire file as ordinary Markdown so no source content is hidden. Empty front matter is accepted without showing an empty metadata block. Only `---`-delimited YAML front matter is supported initially; TOML and JSON front matter variants are not recognized.

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

Open `examples/markdown-features.md` when checking general reader changes. Open `examples/math-visual-inspection.md` for inline and display mathematics, currency, invalid input, narrow-window overflow, zoom/layout behavior, and printing. Open `examples/mermaid-visual-inspection.md` for diagram rendering, author configuration, invalid-source fallback, navigation stability, zoom/layout behavior, and printing.

Manual visual checklist:

- The document stays within the reading column.
- Headings H1-H6 are readable and clearly ordered.
- Paragraphs, lists, blockquotes, and horizontal rules remain calm and readable.
- Task-list markers render as quiet, disabled checkboxes, including in nested lists.
- Code blocks and very long code/path lines scroll horizontally instead of breaking the page.
- Tables remain usable and do not force the whole window wider.
- Intra-document links scroll to the expected generated heading anchors.
- Relative `.md` and `.markdown` links open inside Hushmark, and blocked relative links fail harmlessly.
- External `https:` links open outside Hushmark, while unsupported schemes fail harmlessly.
- Relative Markdown images render when the referenced file is under the document folder.
- Relative raw HTML `<img>` images render when the referenced file is under the document folder and uses a supported image extension.
- Images do not overflow the reading column.
- Hebrew and mixed English/Hebrew text display correctly; Hebrew blocks read right to left with right-side quote rules, list markers, and table columns, while code and math stay left to right.
- Raw unsafe HTML does not execute or display unsafe script/link behavior.
- Valid YAML front matter appears as quiet metadata without raw delimiters, while malformed or unterminated front matter remains visible as Markdown.
- Inline mathematics follows the prose baseline, display mathematics is centered, and long expressions overflow locally without widening the document.
- Currency and unclosed delimiters remain ordinary source, while invalid closed formulas remain visible with their delimiters.
- Mermaid fences become sharp, centered figures without widening the document; configured diagrams remain bounded by Hushmark's security settings, and invalid diagrams remain readable source.
