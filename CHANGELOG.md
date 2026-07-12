# Changelog

## [Unreleased]

- Restore the Windows reader's Georgia body typography at a stable 17px size while preserving the current Linux body typography, and strengthen the shared heading hierarchy.

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
