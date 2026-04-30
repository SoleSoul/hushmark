# Changelog

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

