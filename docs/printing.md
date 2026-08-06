# Hushmark Printing

Hushmark prints the currently open document through the WebView's native print dialog. On Windows and Linux, press Ctrl+P while a document is open. Printing is unavailable from Home, error, and Windows setup views.

The print stylesheet removes the screen reading-column limit and padding, resets screen zoom-dependent font variables, uses a white page with dark text and a stable 11pt body size, and keeps non-document UI out of the output. Page and Full Width screen layout do not change print measure. Long code lines wrap instead of scrolling. Tables fit the printable width and allow cell content to wrap. Typeset mathematics retains its print scale, and display expressions avoid splitting where practical. Headings avoid breaks immediately after them, while images, code blocks, tables, table rows, and blockquotes avoid splitting where the print engine can honor that request.

Hushmark does not provide custom printer controls, silent printing, or a separate PDF-export path. Printer selection, page size, browser-generated headers and footers, and PDF output are controlled by the native print dialog.

## Manual Validation

Open `examples/print-visual-inspection.md`, press Ctrl+P, and inspect print preview and Print to PDF. Confirm:

- only the document is printed;
- page margins, body text, headings, and links remain readable;
- long code lines wrap without clipping or horizontal scrollbars;
- wide table cells wrap within the page;
- images stay within the printable width;
- multi-page content does not leave a heading alone at the bottom of a page;
- empty, error, and setup views do not open the print dialog.

Also open `examples/math-visual-inspection.md` and confirm inline and display mathematics print at a stable scale independent of the current screen zoom and layout.

Repeat the preview checks on Windows and Linux because WebView print engines and native dialogs differ.
