# Hushmark Project Context

Hushmark is a small Markdown reader built with Rust, Tauri 2, and a minimal vanilla TypeScript frontend. It opens Markdown files into a quiet reader view with restrained typography, limited chrome, and operating-system file integration.

This repository is the canonical Hushmark codebase. The current release target and integration surface are Windows, but future Linux support is possible.

## What Hushmark Is Not

Hushmark is not a Markdown editor, IDE, note workspace, browser, Electron app, or general file manager. Do not add editor/source mode, split view, toolbars, tabs, recent files, sidebars, file trees, or reader settings unless explicitly requested.

## Current Accepted Feature Set

- Open a Markdown file from the first positional command-line argument.
- Open `.md` and `.markdown` files with Ctrl+O through the native Tauri dialog.
- Open top-level Markdown files by drag/drop.
- Show a simple empty state when no document is open.
- Show a subtle empty-state-only `Install` or `Update` setup affordance when needed.
- Open setup mode with `--setup`.
- Render Markdown in Rust with `pulldown-cmark`, then sanitize HTML with `ammonia`.
- Support CommonMark-style Markdown plus tables and strikethrough.
- Generate heading anchors and handle same-document `#fragment` history.
- Open safe relative `.md` / `.markdown` links inside Hushmark under the starting document folder.
- Open external `http`, `https`, and `mailto` links in the system app.
- Resolve safe local Markdown image paths and embed them as `data:` URLs.
- Preserve controlled table alignment classes.
- Disable the internal WebView context menu.
- Provide per-user Windows install, Open With, right-click integration, and Default Apps handoff without admin rights.

For detailed behavior, see `docs/markdown-support.md` and `docs/windows-integration.md`.

## Architecture Overview

- `src-tauri/src/document.rs`: Markdown loading, rendering, sanitization, local images, heading anchors, linked-document validation, and Rust tests.
- `src-tauri/src/setup.rs`: Windows install/setup integration, registry handling, setup status, and `--setup` parsing.
- `src-tauri/src/external_links.rs`: External link opening.
- `src-tauri/src/identity.rs`: Product identity constants used by Windows integration.
- `src-tauri/src/lib.rs`: Tauri command and plugin registration.
- `src/main.ts`: Reader startup, rendering, link handling, navigation history, Ctrl+O, drag/drop, and empty-state setup affordance.
- `src/setupView.ts`: Setup screen rendering and setup actions.
- `src/types.ts`, `src/dom.ts`, and `src/product.ts`: Shared frontend types, DOM helper, and frontend product labels.
- `src/styles.css`: Reader, empty/error state, and setup styles.
- `src-tauri/capabilities/default.json`: Tauri permissions, including dialog access.

Keep Tauri JavaScript and Rust plugin versions aligned. Dialog support is currently pinned in npm and Cargo metadata.

Windows release artifacts and Windows smoke tests should be produced through GitHub Actions or a Windows machine. On Linux, local checks can still be useful, but they should not be treated as Windows release validation.

## Version And Tester Builds

Current app version: `0.1.4`.

Use human-readable patch versions for tester-visible builds. Keep version metadata aligned across `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and version references in docs.

Do not bump the version for docs-only changes, internal refactors, or other behavior-preserving maintenance unless a tester build is being prepared.

## Design Principles

- Reader-first, calm, and small.
- Prefer native Windows and WebView behavior over custom UI machinery.
- Keep setup useful but out of the document reading path.
- Make security and path handling conservative.
- Prefer current repo state over historical handoff notes when they conflict.
- Keep documentation concise enough for future agents to read.

See `docs/reader-design.md` for the focused design note.

## Known Limitations

- There is no dedicated frontend unit test harness yet; UI/navigation behavior relies on TypeScript build checks, Rust tests, and manual smoke testing.
- Markdown support is intentionally limited; Hushmark is not full GitHub-Flavored Markdown. See `docs/markdown-support.md`.
- Windows default-app assignment remains user-controlled; Hushmark registers itself as a candidate and opens Default Apps settings.
- Same-document fragment history currently re-renders during popstate restoration. This is acceptable while the reader has little transient DOM-only state.
- Release binaries are unsigned unless a signing step is added, so Windows SmartScreen may warn testers.

## Focused Docs

- `docs/reader-design.md`: Product restraint and reader design boundaries.
- `docs/markdown-support.md`: Markdown feature baseline, link behavior, anchors, fixtures, and limitations.
- `docs/windows-integration.md`: Install path, registry keys, setup behavior, and Windows manual tests.
- `docs/roadmap.md`: Active ideas and possible future work.
- `docs/release-checklist.md`: Repeatable tester/GitHub release process.
