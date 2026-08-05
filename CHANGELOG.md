# Changelog

## [Unreleased]

## 0.1.12

Windows update recovery and Markdown table sizing update.

- Explain how to recover when Windows cannot replace an installed Hushmark executable because another process or security software is holding it.
- Keep compact Markdown table columns readable while giving prose-heavy columns the remaining width and reserving within-word breaks for genuine overflow.

## 0.1.11

Home, document layout, and zoom update.

- Replace the empty state with a book-contents home and keyboard-help page, reachable with Ctrl+H and included in Back/Forward history.
- Add 50%-200% document zoom, Page and Full Width layouts, and reflow-resistant reading-position bookmarks without adding persistent UI chrome.

## 0.1.10

Windows setup, self-uninstall, and front matter refinement.

- Give nested YAML front matter clearer inline hierarchy while retaining compact rendering.
- Preserve author-intended line breaks and repeated spaces in front matter text values.
- Keep a quiet **Setup** affordance in the Windows empty state, with action-specific Install, Update, Downgrade, and Reinstall labels when the installed copy differs.
- Remove the setup command-line mode and the confusing Default Apps shortcut from the setup page.
- Allow the installed Windows executable to remove its own Hushmark registry integration and files after the app exits, without a downloaded uninstaller.
- Restyle Windows setup as an unframed, reader-aligned surface with restrained rules and less rounded UI.
- Replace expandable setup diagnostics with visible version/copy status and direct integration rows, using an inline confirmation only when the running installed copy removes itself.
- Reliably remove Hushmark's temporary update file and empty install directory during uninstall.

## 0.1.9

YAML front matter rendering update.

- Render valid `---`-delimited YAML front matter as a quiet, sanitized metadata block while preserving malformed or unterminated blocks as ordinary Markdown.
- Keep long unbroken prose tokens from widening the reader viewport.
- Present front matter as a compact document colophon instead of a full-width property table.

## 0.1.8

Printing and cross-platform reader typography update.

- Restore the Windows reader's Georgia body typography at a stable 17px size while preserving the current Linux body typography, and strengthen the shared heading hierarchy.
- Add document-only Ctrl+P printing through the native WebView print dialog with print-specific layout, code, table, image, and page-break handling.

## 0.1.7

Linux runtime compatibility update.

- Disable WebKitGTK's DMABUF renderer by default on Linux before GTK/WebKit initialization, fixing the observed NVIDIA/X11 blank window and labwc/wlroots Wayland protocol error.

## 0.1.6

Linux runtime preparation and reader typography update.

- Compile Windows setup and integration commands only on Windows, with no non-Windows setup command stubs.
- Add startup platform capabilities so non-Windows builds do not request or display Install, Update, or setup flows.
- Move command-line argument parsing out of the Windows setup module. `--setup` is recognized only on Windows and behaves like any other flag-shaped file argument elsewhere.
- Use Tauri's cross-platform opener for approved external links on Windows and Linux.
- Add the RGBA application icon and desktop-entry metadata needed for Linux packaging.
- Use local system fonts for reader typography, keep body and heading sizes stable while resizing, and soften link underlines until hover or keyboard focus.

## 0.1.5

Tester-visible README image compatibility update.

- Keep small badge-style images inline instead of centering each image on its own line.
- Resolve safe relative local image paths in sanitized raw HTML `<img>` tags using the same local-image safety rules as Markdown image syntax.
- Added visual fixture coverage for inline badges, Markdown GIF images, and raw HTML local GIF images.
- Documented the narrow raw HTML local image behavior and its security limits.

## 0.1.4

Tester-visible navigation consistency update.

- Add Hushmark Back/Forward history for same-document `#fragment` links.
- Add Alt+Right and BrowserForward support for Hushmark document and fragment history after going back.
- Keep missing same-document fragments harmless by not adding broken history entries.
- Document the unified navigation model in the Markdown support docs and visual inspection fixture.

## 0.1.3

Tester-visible relative Markdown navigation update.

- Open relative `.md` and `.markdown` document links inside Hushmark.
- Preserve fragments for linked Markdown documents, so links like `setup.md#install-hushmark` open the target document and scroll to the generated heading anchor.
- Added app-level Back navigation for linked Markdown documents, including Alt+Left handling and scroll restoration.
- Keep the navigation root constrained to the first opened document's folder; absolute local paths, `file://` links, links outside that root, and non-Markdown relative files are not opened.
- Added linked-document fixtures and backend path-validation tests for relative links, fragments, root escapes, absolute paths, unsupported schemes, unsupported extensions, and malformed links.

## 0.1.2

Tester-visible link handling and polish update.

- Show the installed executable version in setup Details when an update is available.
- Regenerated the Windows app icon from a checked-in SVG source.
- Open Markdown `http`, `https`, and `mailto` links in the system default app while keeping fragment links inside Hushmark.
- Disabled the internal WebView right-click menu inside Hushmark without changing Windows Explorer right-click integration.
- Verified generated heading anchors, table alignment, and local Markdown images against the visual inspection fixture for this tester build.

## 0.1.1

Tester-visible Markdown rendering update.

- Documented Hushmark's CommonMark-style Markdown support baseline and known limitations.
- Added Markdown feature fixtures for visual regression checks and manual reader QA.
- Added safe local Markdown image support for document-relative image paths.
- Preserved Markdown table alignment without allowing arbitrary inline styles through sanitization.
- Added generated heading anchors for Markdown headings and intra-document fragment links.
- Fixed placeholder replacement ordering so later heading, image, and table-alignment placeholders are not corrupted by earlier replacements.
- Established human-readable patch versioning for tester-visible builds.

## 0.1.0

Initial Hushmark reader release.

- Productized and renamed the app as Hushmark.
- Built a standalone Windows Tauri executable for reading Markdown files.
- Added per-user installation at `%LOCALAPPDATA%\Programs\Hushmark\Hushmark.exe`.
- Added Windows Open With integration for `.md` and `.markdown` files.
- Added a right-click Markdown integration entry: `Open with Hushmark`.
- Added a compact setup integration control panel.
- Added safe uninstall/remove-integration behavior that removes only Hushmark-created entries.
- Added selected reader improvements: branded empty state, calmer read errors, and conservative overflow guards for code, tables, and images.
- Added release size optimization for the executable.
- Kept Windows default-app assignment user-guided instead of writing protected `UserChoice` defaults.
