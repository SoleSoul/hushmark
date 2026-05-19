# Hushmark Markdown visual inspection

Use this document to compare what each Markdown feature says it should do with what Hushmark actually displays.

Each section has:

1. a title with the feature name,
2. what you should expect to see,
3. the actual Markdown usage.

Some sections are intentionally marked **not currently supported**. Those examples are included so future behavior changes are easy to notice.

---

## Feature: Paragraphs

**Expect:** Two calm text paragraphs with comfortable spacing.

**Usage:**

This is the first paragraph. It should render as ordinary reading text with no special decoration.

This is the second paragraph. It should have clear separation from the first paragraph without feeling too loose.

---

## Feature: Soft line breaks

**Expect:** The following three source lines should appear as one paragraph. Markdown soft breaks usually behave like spaces or ordinary wrapping.

**Usage:**

This sentence is split
across several source lines
but should still read like one paragraph.

---

## Feature: Hard line breaks

**Expect:** The following lines should visibly break after "first line" and after "second line" while remaining in the same paragraph.

**Usage:**

This is the first line with two trailing spaces.  
This is the second line with a trailing backslash.\
This is the third line.

---

## Feature: Headings

**Expect:** Six heading levels, from largest/strongest to smallest/subtlest.

**Usage:**

# Heading level 1

## Heading level 2

### Heading level 3

#### Heading level 4

##### Heading level 5

###### Heading level 6

---

## Feature: Emphasis

**Expect:** Italic/emphasized text in the middle of normal text.

**Usage:**

This sentence contains *emphasized text* using asterisks.

This sentence contains _emphasized text_ using underscores.

---

## Feature: Strong emphasis

**Expect:** Bold/strong text in the middle of normal text.

**Usage:**

This sentence contains **strong text** using asterisks.

This sentence contains __strong text__ using underscores.

---

## Feature: Combined emphasis

**Expect:** Text that appears both strong and emphasized.

**Usage:**

This sentence contains ***strong emphasized text***.

This sentence contains ___strong emphasized text___.

---

## Feature: Strikethrough

**Expect:** Struck-through text. This is currently supported by Hushmark.

**Usage:**

This text is ~~removed but still visible~~.

---

## Feature: Inline code

**Expect:** Short code fragments should stand out quietly inside normal text.

**Usage:**

Run `cargo test --quiet` from `src-tauri` when checking Rust tests.

Use the path `C:\Users\Example\Documents\Notes\doc.md` as a Windows-style inline path.

---

## Feature: Fenced code block

**Expect:** A visually contained code block with monospaced text.

**Usage:**

```rust
fn main() {
    println!("Hello, Hushmark");
}
```

---

## Feature: Fenced code block with long line

**Expect:** The code block should remain contained. A very long line should scroll horizontally instead of forcing the whole document wider.

**Usage:**

```text
C:\Users\Jonathan Lahav\Documents\Hushmark Notes\A folder with spaces\A very long folder name that keeps going\another folder\markdown-document-with-a-very-long-file-name-and-a-local-image-reference.md
```

---

## Feature: Indented code block

**Expect:** A monospaced block created by indentation. This is standard Markdown, but fenced code blocks are usually clearer.

**Usage:**

    This line is indented by four spaces.
    It should render as a code block.

---

## Feature: Blockquote

**Expect:** A quoted block with restrained styling, usually an inset or left border.

**Usage:**

> Hushmark is a quiet Markdown reader.
> It should keep quoted text readable without making it loud.

---

## Feature: Nested blockquote

**Expect:** A quote inside a quote. Nesting should be understandable but not visually overwhelming.

**Usage:**

> Outer quote.
>
> > Nested quote.
> >
> > Still nested.
>
> Back to the outer quote.

---

## Feature: Unordered list

**Expect:** A simple bulleted list.

**Usage:**

- First item
- Second item
- Third item

---

## Feature: Nested unordered list

**Expect:** A bulleted list with indented child items.

**Usage:**

- Parent item
  - Child item
  - Another child item
- Another parent item

---

## Feature: Ordered list

**Expect:** A numbered list.

**Usage:**

1. First step
2. Second step
3. Third step

---

## Feature: Nested ordered list

**Expect:** Numbered child items nested under a numbered parent item.

**Usage:**

1. First major step
   1. First sub-step
   2. Second sub-step
2. Second major step

---

## Feature: Mixed nested list

**Expect:** Ordered and unordered list nesting should stay readable.

**Usage:**

1. Prepare the document
   - Open Hushmark
   - Open this Markdown file
2. Inspect the output
   - Compare each expectation
   - Note anything surprising

---

## Feature: Links

**Expect:** The HTTPS link should open in the system browser. The mail link should open in the system mail app if one is configured. The unsupported FTP link should not navigate the Hushmark WebView.

**Usage:**

[Visit example.com](https://example.com)

[Email reader@example.com](mailto:reader@example.com)

[Unsupported FTP link](ftp://example.com/file.md)

---

## Feature: Intra-document links

**Expect:** Each existing fragment link should scroll to a heading in this same document instead of opening an external browser. The missing-fragment link should fail harmlessly and leave the document usable.

**Usage:**

- [Jump to table alignment](#feature-table-alignment)
- [Jump to duplicate heading](#duplicate-heading)
- [Jump to second duplicate heading](#duplicate-heading-1)
- [Jump to install/update heading](#install-update)
- [Jump to Hebrew heading](#שלום-עולם)
- [Missing fragment](#missing-fragment)

---

## Feature: Reference-style links

**Expect:** A clickable link whose URL is defined elsewhere in the document.

**Usage:**

[This is a reference-style link][example-reference].

[example-reference]: https://example.com/reference-style-link

---

## Feature: Autolinks

**Expect:** The URL and email address should become links.

**Usage:**

<https://example.com/autolink>

<reader@example.com>

---

## Feature: Local Markdown image

**Expect:** The local Hushmark placeholder image should render. This uses Markdown image syntax and should resolve relative to this file.

**Usage:**

![Hushmark placeholder](assets/hushmark-placeholder.svg)

---

## Feature: Local Markdown image with spaces

**Expect:** The local image whose filename contains spaces should render.

**Usage:**

![Image with spaces](<assets/image with spaces.svg>)

---

## Feature: Local Markdown image with Hebrew filename

**Expect:** The local image whose filename is Hebrew should render.

**Usage:**

![Hebrew filename image](<assets/שלום.svg>)

---

## Feature: Remote image

**Expect:** If network access and the remote server allow it, the remote image may render. If not, it may show as a broken image. Remote behavior is intentionally unchanged by local image support.

**Usage:**

![Remote placeholder image](https://via.placeholder.com/240x80.png?text=Remote+image)

---

## Feature: Image title text

**Expect:** The image should render. Some platforms may show the title as a tooltip on hover.

**Usage:**

![Hushmark placeholder with title](assets/hushmark-placeholder.svg "A local Hushmark placeholder image")

---

## Feature: Horizontal rule

**Expect:** A quiet dividing line below this paragraph.

**Usage:**

---

This text appears after the horizontal rule.

---

## Feature: Tables

**Expect:** A simple table with borders or clear cell separation. Tables are currently supported by Hushmark.

**Usage:**

| Feature | Current state | Notes |
| --- | --- | --- |
| Tables | Supported | Enabled in pulldown-cmark |
| Strikethrough | Supported | Enabled in pulldown-cmark |
| Task lists | Not supported yet | Should render as ordinary list text |

---

## Feature: Table alignment

**Expect:** If alignment is reflected by the renderer/browser, the columns should align left, center, and right. If not visually obvious, the table should still remain readable.

**Usage:**

| Left aligned | Center aligned | Right aligned |
| :--- | :---: | ---: |
| apple | banana | 123 |
| longer text | centered text | 456 |
| a much longer table cell that checks later-row alignment | centered later row | 789 |

---

## Duplicate heading

**Expect:** This first duplicate heading should receive a stable generated id ending in `duplicate-heading`.

**Usage:**

This section exists so the intra-document link test above has a duplicate heading target.

---

## Duplicate heading

**Expect:** This second duplicate heading should receive a stable generated id ending in `duplicate-heading-1`.

**Usage:**

This section exists so duplicate heading suffixes can be inspected visually.

---

## Install / Update

**Expect:** Punctuation should collapse into a single hyphen, producing an id like `install-update`.

**Usage:**

This heading checks punctuation in generated heading anchors.

---

## שלום עולם

**Expect:** Hebrew heading text should produce a stable Unicode id like `שלום-עולם`.

**Usage:**

This heading checks Unicode generated heading anchors.

---

## Feature: Escaped Markdown characters

**Expect:** The Markdown punctuation should appear literally instead of becoming formatting.

**Usage:**

\# Not a heading

\*Not emphasized\*

\[Not a link\](https://example.com)

\`Not inline code\`

---

## Feature: Backslash escapes in normal text

**Expect:** The escaped punctuation should display as punctuation.

**Usage:**

Escaped characters: \! \" \# \$ \% \& \' \( \) \* \+ \, \- \. \/ \: \; \< \= \> \? \@ \[ \\ \] \^ \_ \` \{ \| \} \~.

---

## Feature: HTML entity

**Expect:** Entities should display as their corresponding characters.

**Usage:**

Copyright: &copy;

Ampersand: &amp;

Less-than sign: &lt;

---

## Feature: Safe raw HTML

**Expect:** Some safe raw HTML may remain after sanitization. For example, this text may appear inside a plain block. Raw HTML is sanitized before display.

**Usage:**

<div title="Safe title">This text comes from a raw HTML div.</div>

---

## Feature: Unsafe raw HTML sanitization

**Expect:** The script should not run and should not appear as an executable script. Event-handler attributes should be stripped.

**Usage:**

<script>alert("This should not run");</script>

<img src="assets/hushmark-placeholder.svg" alt="Raw HTML image" onerror="alert('This should be stripped')">

---

## Feature: Dangerous JavaScript link sanitization

**Expect:** The link text should remain visible, but the dangerous `javascript:` URL should not survive as a clickable JavaScript URL.

**Usage:**

[Dangerous JavaScript link](javascript:alert("This should not run"))

---

## Feature: Unicode text

**Expect:** Unicode text should display normally.

**Usage:**

English: Hushmark reads Markdown quietly.

Hebrew: שלום עולם, זהו טקסט בעברית.

Emoji: 🌿 📖 ✨

---

## Feature: Mixed English and Hebrew

**Expect:** Mixed left-to-right and right-to-left text should remain readable, though exact bidi behavior depends on the browser engine.

**Usage:**

This sentence mixes English with עברית in the same line so bidirectional rendering can be inspected visually.

---

## Feature: Very long paragraph token

**Expect:** The document should not become unusably wide. Long text should wrap or be contained reasonably.

**Usage:**

This paragraph contains a very long token: hushmark-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.

---

## Feature: Task lists — not currently supported

**Expect:** These are **not supposed to render as real checkboxes right now**. They should appear as ordinary list items containing `[x]` and `[ ]`.

**Usage:**

- [x] Checked-looking task
- [ ] Unchecked-looking task

---

## Feature: Footnotes — not currently supported

**Expect:** These are **not supposed to render as numbered footnotes right now**. The syntax may remain visible text or behave like ordinary reference syntax.

**Usage:**

This sentence has a footnote reference.[^visual-footnote]

[^visual-footnote]: This is the footnote definition text.

---

## Feature: Heading attributes — not currently supported

**Expect:** The `{#custom-id .custom-class}` text is **not supposed to become an HTML id or class right now**. It should remain visible as heading text.

**Usage:**

### Heading with attributes {#custom-id .custom-class}

---

## Feature: GitHub alert blocks — not currently supported

**Expect:** These are **not supposed to become special GitHub-style alert panels right now**. They should render as ordinary blockquotes.

**Usage:**

> [!NOTE]
> This is a GitHub-style note block.

> [!WARNING]
> This is a GitHub-style warning block.

---

## Feature: Definition lists — not currently supported

**Expect:** This is **not supposed to render as a definition list right now**. It should display as ordinary paragraphs/text.

**Usage:**

Term one
: Definition for term one

Term two
: Definition for term two

---

## Feature: Math — not currently supported

**Expect:** This is **not supposed to render as formatted math right now**. Dollar-delimited text should remain ordinary text.

**Usage:**

Inline math: $E = mc^2$

Display math:

$$
\int_0^1 x^2 dx = \frac{1}{3}
$$

---

## Feature: Superscript and subscript — not currently supported

**Expect:** These are **not supposed to render as superscript/subscript right now** unless written as safe raw HTML that survives sanitization.

**Usage:**

Markdown-style superscript attempt: x^2^

Markdown-style subscript attempt: H~2~O

Raw HTML example: x<sup>2</sup> and H<sub>2</sub>O.

---

## Feature: Wikilinks — not currently supported

**Expect:** This is **not supposed to become a link right now**. It should remain visible as bracketed text.

**Usage:**

[[Another Note]]

[[Another Note|Custom label]]

---

## Feature: YAML front matter — not currently supported as metadata

**Expect:** This is **not supposed to be treated as hidden document metadata right now**. Since it appears in the middle of the document, it should render as ordinary Markdown content.

**Usage:**

---
title: Example document
author: Jonathan Lahav
tags:
  - hushmark
  - markdown
---

---

## Feature: Plus-delimited metadata block — not currently supported

**Expect:** This is **not supposed to be treated as hidden metadata right now**. It should render as ordinary text.

**Usage:**

+++
title = "Example document"
author = "Jonathan Lahav"
+++

---

## Feature: Smart punctuation — not currently enabled

**Expect:** Straight quotes and three dots are **not supposed to be automatically converted** into curly quotes or an ellipsis by Hushmark's Markdown parser right now.

**Usage:**

"Straight quotes", 'single quotes', three dots..., two hyphens --, and three hyphens ---.

---

## Feature: Raw HTML details element

**Expect:** If the sanitizer allows it, this may render as a collapsible details block. If browser/sanitizer behavior changes, inspect whether it remains safe and calm.

**Usage:**

<details>
<summary>Expandable raw HTML details</summary>

This text is inside a raw HTML details element.

</details>

---

## Feature: Final checklist

**Expect:** This section is just a visual checklist for the whole file.

**Usage:**

- The document should remain calm and readable.
- The content column should not become too wide.
- Code blocks and tables should stay contained.
- Local Markdown images should render.
- Unsafe HTML should not execute.
- Unsupported future features should be clearly visible as unsupported syntax.
