# Hushmark print inspection

This document exercises the first printing implementation. Open it in Hushmark, press Ctrl+P, and inspect both print preview and Print to PDF.

## Prose and links

Printed body text should use a stable size, dark ink, and comfortable spacing on a white page. The screen reading-column width and outer padding should not constrain the printed document. This paragraph includes an [external link](https://example.com/printing) whose label should remain readable without appending a noisy URL.

Hushmark is intended for documents, notes, READMEs, and linked collections of Markdown files. Printing should preserve that quiet reading character while using the available page width sensibly. Several paragraphs are included so headings, ordinary wrapping, and page transitions can be inspected together.

> A blockquote should retain its left border and should avoid splitting across pages when practical.

## Long code lines

Long code should wrap in print instead of being clipped or producing a horizontal scrollbar.

```text
C:\Users\Example\Documents\Hushmark Notes\A folder with spaces\an-extremely-long-directory-name\another-long-directory-name\a-markdown-document-with-a-long-name.md --option=an-uninterrupted-value-that-needs-to-remain-visible-in-the-printed-output
```

```rust
fn print_document(document: &Document) -> Result<(), PrintError> {
    document.render_with_a_deliberately_long_function_call("first argument", "second argument", "third argument", "fourth argument")?;
    Ok(())
}
```

## Wide table

The table should stay within the printable page. Long cell content should wrap rather than being clipped.

| Area | Expected print behavior | Deliberately long value |
| --- | --- | --- |
| Prose | Uses the printable width | Ordinary sentences wrap naturally and remain easy to follow across several lines. |
| Code | No horizontal scrolling | `an_uninterrupted_identifier_that_is_far_wider_than_a_typical_printable_table_column_and_must_wrap` |
| Images | Stay within page bounds | Local embedded images preserve their aspect ratio and do not overflow the paper. |
| Links | Remain identifiable | https://example.com/a/very/long/path/that/should/wrap/inside/the/table/cell/without/widening/the/page |

## Local image

The image should remain within the page width and avoid splitting across pages.

![Hushmark placeholder](assets/hushmark-placeholder.svg)

## Multi-page content

The remaining sections provide enough prose to exercise page breaks. A heading should not be stranded at the bottom of a page without the content that follows it.

### First continuation

Good print output depends on restrained rules rather than recreating the screen inside a sheet of paper. The printable page supplies its own margins, while the document supplies hierarchy, rhythm, and content. Code, tables, images, quotations, lists, and links should remain recognizable without requiring application chrome.

The native print engine ultimately decides pagination. Hushmark asks it to keep headings with following content and to avoid splitting complex blocks where practical. Those requests may be relaxed when an item is taller than an entire page.

### Second continuation

Printing should remain a direct reading action. There is no custom printer interface, silent output, or special PDF mode. The system dialog owns printer selection, paper size, orientation, copies, and PDF destinations.

1. Confirm the first page has sensible margins.
2. Confirm body text is stable and dark.
3. Confirm code lines remain fully visible.
4. Confirm the table fits the page.
5. Confirm the image does not overflow.
6. Confirm headings are not isolated at page bottoms where avoidable.

### Final continuation

This final section helps expose an unnecessary trailing blank page or awkward last-page spacing. The document should finish naturally after this paragraph.
