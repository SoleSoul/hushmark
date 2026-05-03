# Changelog

## [Unreleased]

- No changes yet.

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

