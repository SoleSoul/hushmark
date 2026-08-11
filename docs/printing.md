# Hushmark Printing

Hushmark prints the currently open document through the WebView's native print dialog. Press Ctrl+P on Windows and Linux or Command-P on macOS while a document is open. Printing is unavailable from Home, error, and Windows setup views. While Mermaid diagrams are being prepared, printing is briefly disabled so the native print dialog cannot capture an incomplete document.

The print stylesheet removes the screen reading-column limit and padding, resets screen zoom-dependent font variables, uses a white page with dark text and a stable 11pt body size, and keeps non-document UI out of the output. Page and Full Width screen layout do not change print measure. Long code lines wrap instead of scrolling. Tables fit the printable width and allow cell content to wrap. Typeset mathematics and Mermaid diagrams retain sharp output within the printable width. Display mathematics and diagrams avoid splitting where practical. Headings avoid breaks immediately after them, while images, code blocks, tables, table rows, and blockquotes avoid splitting where the print engine can honor that request.

Hushmark does not provide custom printer controls, silent printing, or a separate PDF-export path. Printer selection, page size, browser-generated headers and footers, and PDF output are controlled by the native print dialog.

## Manual Validation

Open `examples/print-visual-inspection.md`, use the platform-standard print shortcut, and inspect print preview and Print to PDF. Confirm:

- only the document is printed;
- page margins, body text, headings, and links remain readable;
- long code lines wrap without clipping or horizontal scrollbars;
- wide table cells wrap within the page;
- images stay within the printable width;
- multi-page content does not leave a heading alone at the bottom of a page;
- empty, error, and setup views do not open the print dialog.

Also open `examples/math-visual-inspection.md` and confirm inline and display mathematics print at a stable scale independent of the current screen zoom and layout.

Open `examples/mermaid-visual-inspection.md` and confirm diagrams print sharply within the page, do not split where practical, and do not include the source blocks they replaced. The malformed example should print as readable code.

Repeat the preview checks on Windows, Linux, and macOS because WebView print engines and native dialogs differ.
