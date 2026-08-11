# Hushmark Project Context

Hushmark is a small Markdown reader built with Rust, Tauri 2, and a minimal vanilla TypeScript frontend. It opens Markdown files into a quiet reader view with restrained typography, limited chrome, and operating-system file integration.

This repository is the canonical Hushmark codebase. GitHub Releases publish an unsigned standalone Windows executable and an unsigned Universal macOS DMG; Windows remains the only in-app setup/integration surface. The shared reader code also supports Linux runtime builds, with an AUR package maintained downstream in a separate repository. Other first-party Linux package formats have not been selected. Linux desktop integration belongs in packaging rather than in-app setup.

## What Hushmark Is Not

Hushmark is not a Markdown editor, IDE, note workspace, browser, Electron app, or general file manager. Do not add editor/source mode, split view, toolbars, tabs, recent files, sidebars, file trees, or reader settings unless explicitly requested.

## Current Accepted Feature Set

- Open a Markdown file from the first positional command-line argument.
- Open `.md` and `.markdown` files through the native Tauri dialog with the platform-standard Open shortcut.
- Open top-level Markdown files by drag/drop.
- Show a restrained book-contents Home / Help page when no document is open, and return to it with the platform shortcut through normal Back/Forward history.
- Show a Windows setup affordance on Help with a same-position Back action from Setup. Use a quiet `Setup` label when the installed copy is current, and action-specific Install, Update, Downgrade, or Reinstall labels when attention is useful.
- Render Markdown in Rust with `pulldown-cmark`, then sanitize HTML with `ammonia`.
- Pre-parse valid `---`-delimited YAML front matter and render it as sanitized metadata before the untouched Markdown body.
- Support CommonMark-style Markdown plus tables, strikethrough, read-only task lists, locally typeset TeX mathematics using `$...$` and `$$...$$` delimiters, and offline fenced Mermaid diagrams.
- Generate heading anchors and handle same-document `#fragment` history.
- Open safe relative `.md` / `.markdown` links inside Hushmark under the starting document folder.
- Open external `http`, `https`, and `mailto` links in the system app.
- Resolve safe local Markdown image paths and embed them as `data:` URLs.
- Preserve controlled table alignment classes.
- Print an open document with the platform-standard shortcut through the native WebView print dialog.
- Zoom all open-document content uniformly from 50% to 200% and switch between the default Page layout and an uncapped Full Width layout without adding reader chrome. Keep their text edges identical at the default window size and 100% zoom.
- Preserve semantic reading positions across document reflow, layout changes, zoom changes, and Back/Forward navigation.
- Disable the internal WebView context menu.
- Provide per-user Windows install, Open With, right-click integration, and complete Hushmark-owned uninstall behavior without admin rights.
- Keep in-app setup/integration unavailable on Linux; Linux setup belongs in packaging rather than the reader app.
- Use a native macOS menu, lifecycle, Finder open-document events, Viewer/alternate file registration, and DMG drag-to-Applications distribution without an in-app setup flow.

For detailed behavior, see `docs/markdown-support.md` and `docs/windows-integration.md`.

## Architecture Overview

- `src-tauri/src/document_parts.rs`: Source preprocessing, YAML front matter parsing, metadata rendering and sanitization, and Markdown body offsets.
- `src-tauri/src/document.rs`: Markdown loading, body rendering and sanitization, local images, heading anchors, linked-document validation, and Rust tests.
- `src-tauri/src/setup.rs`: Windows-only install/setup integration, registry handling, setup status, and deferred self-uninstall cleanup. The module and its Tauri commands are compiled only on Windows.
- `src-tauri/src/startup.rs`: Platform-neutral first-positional-argument parsing. There is no setup command-line mode.
- `src-tauri/src/external_links.rs`: External URL allowlisting before Tauri opens approved links with the system default application.
- `src-tauri/src/identity.rs`: Shared display identity plus Windows-gated integration identifiers.
- `src-tauri/src/lib.rs`: Tauri command and plugin registration plus startup platform capabilities.
- `src-tauri/src/macos.rs`: macOS-only native menus, window lifecycle, Dock reopen behavior, Finder open-document events, and native menu state.
- `src/main.ts`: Reader startup, rendering, link handling, document/home navigation history, keyboard commands, drag/drop, and capability-gated home setup affordance.
- `src/platformShell.ts`: Platform-neutral shell contract and no-op/default implementation; dynamically loads platform code only when required.
- `src/macos.ts`: Narrow macOS implementation of the frontend shell contract for native menu commands, printing, state, and queued Finder document opens.
- `src/documentView.ts`: Platform-neutral document zoom/layout calculations and rendered-structure reading-position capture/restore.
- `src/mermaid.ts`: Lazy, bounded Mermaid rendering, strict renderer configuration, isolated SVG images, and readable-source failure fallback.
- `src/homeView.ts`: Platform-neutral home and keyboard-contents page rendering.
- `src/setupView.ts`: Setup screen rendering and setup actions.
- `src/types.ts`, `src/dom.ts`, and `src/product.ts`: Shared frontend types, DOM helper, and frontend product labels.
- `src/styles.css`: Reader, print, empty/error state, and setup styles.
- `src-tauri/capabilities/default.json`: Tauri permissions, including dialog access.
- `src-tauri/tauri.macos.conf.json`: macOS-only app/DMG, Viewer association, icon, hardened-runtime, and deployment-target configuration.

Keep Tauri JavaScript and Rust plugin versions aligned. Dialog support is currently pinned in npm and Cargo metadata. The Rust-only opener plugin provides shared Windows/Linux external-link OS access behind Hushmark's URL allowlist.

Windows release artifacts and Windows smoke tests should be produced through GitHub Actions or a Windows machine. On Linux, local checks can still be useful, but they should not be treated as Windows release validation.

## Version And Releases

Use human-readable patch versions for public releases and explicitly shared prerelease builds. Keep version metadata aligned across `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, and `CHANGELOG.md`.

Do not bump the version for docs-only changes, internal refactors, or other behavior-preserving maintenance unless a release or shared prerelease build is being prepared.

## Design Principles

- Reader-first, calm, and small.
- Prefer native platform and WebView behavior over custom UI machinery.
- Keep platform-specific behavior isolated from the core reader, Markdown rendering, and navigation logic.
- Keep Windows setup useful but out of the document reading path; do not create an equivalent in-app setup/update flow on Linux.
- Make security and path handling conservative.
- Prefer current repo state over historical handoff notes when they conflict.
- Keep documentation concise enough for future agents to read.

See `docs/reader-design.md` for the focused design note.

## Known Limitations

- There is no dedicated frontend unit test harness yet; UI/navigation behavior relies on TypeScript build checks, Rust tests, and manual smoke testing.
- Markdown support is intentionally limited; Hushmark is not full GitHub-Flavored Markdown. See `docs/markdown-support.md`.
- Windows default-app assignment remains user-controlled. Hushmark registers itself as a candidate for Open With, but the setup page does not try to guide or automate default-app selection.
- Linux packages should own installation, updates, desktop integration, icons, and MIME registration. See `docs/linux-support.md`.
- The macOS release DMG is unsigned, so Gatekeeper may require users to approve its first launch manually. Developer ID signing and notarization remain a possible future improvement.
- Same-document fragment history currently re-renders during popstate restoration. This is acceptable while the reader has little transient DOM-only state.
- Document zoom and layout intentionally reset to Page at 100% on every launch so Hushmark always opens with its paper-like reading baseline.
- The reader deliberately remains light when the operating system uses a dark appearance; dark mode is not accepted until it has a shared reader design.
- Release binaries are unsigned unless a signing step is added, so Windows SmartScreen and macOS Gatekeeper may warn users.

## Focused Docs

- `docs/reader-design.md`: Product restraint and reader design boundaries.
- `docs/markdown-support.md`: Markdown feature baseline, link behavior, anchors, fixtures, and limitations.
- `docs/windows-integration.md`: Install path, registry keys, setup behavior, and Windows manual tests.
- `docs/linux-support.md`: Linux runtime policy, package responsibilities, and remaining validation.
- `docs/macos-support.md`: Native Mac behavior, Finder integration, Universal DMG builds, signing, and smoke tests.
- `docs/printing.md`: Printing behavior, stylesheet policy, and manual validation.
- `docs/document-view.md`: Document layout, zoom, reading-position, and launch-default behavior.
- `docs/table-layout-optimization.md`: Research note on possible minimum-height table sizing beyond the current browser algorithm.
- `docs/roadmap.md`: Active ideas and possible future work.
- `docs/release-checklist.md`: Repeatable GitHub release and prerelease-build process.
