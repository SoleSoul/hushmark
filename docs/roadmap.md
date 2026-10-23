# Hushmark Roadmap

This roadmap is not a contract. It is a short parking lot for likely next work and ideas that may be accepted, changed, or rejected later.

## Near-Term Release Readiness

- Keep `CHANGELOG.md` current under `Unreleased` for user-visible changes.
- Run the release checklist before publishing any GitHub release or explicitly shared prerelease binary.
- Smoke-test `examples/markdown-visual-inspection.md`, `examples/math-visual-inspection.md`, `examples/mermaid-visual-inspection.md`, same-document fragments, relative Markdown links, Home/Back/Forward, document zoom/layout, Ctrl+O, Ctrl+P, Ctrl+H, local images, table alignment, external links, and Windows setup mode.
- Smoke-test the quiet Windows setup entry point and install-version action labels.

## Near-Term Linux Support

- Upgrade to a stable Tauri release containing Tao 0.36 or later, then validate native title-bar appearance and window controls on GNOME Wayland without adding a custom title bar. Checked 2026-10-23: stable Tauri 2.12.5 uses `tauri-runtime-wry` 2.12.3, which depends on Tao 0.37, so the upgrade is no longer blocked. It awaits an explicit decision because it changes window behavior on every platform.
- After the Tauri upgrade, investigate server-side decorations on Linux/Wayland. Hushmark currently sets its own GTK header bar as the title bar, even with `GTK_CSD=0`. Under a compositor that draws title bars (owbox, KDE, labwc), it should let the compositor decorate the window, as a plain GTK window does. First determine whether this is the Tao bug the upgrade addresses; if not, track it as a separate Linux windowing issue.
- Decide whether the WebKitGTK/NVIDIA DMABUF blank-window issue needs an app-level or package-level workaround before a public Linux release.
- Keep the checked-in desktop entry and icon aligned with downstream Linux packaging, and verify Markdown MIME associations when packaging changes.
- Validate file opening, Ctrl+O, drag/drop, document links, local images, external links, and navigation on Linux.
- Keep install, update, and desktop-integration ownership in Linux packaging; do not add an in-app setup flow.

## Deferred Failure Feedback

Design this from first principles before implementing it. Application-level failures must not become part of the rendered Markdown, change document layout, disturb scroll restoration, or make the reader feel transient and unstable.

The following user actions can currently fail without visible feedback:

1. An external web or email link cannot be opened by the operating system: "This link could not be opened."
2. The native file picker cannot be opened: "The file picker could not be opened. You can also drag a Markdown file into Hushmark."
3. A clicked link uses an unsupported destination: "This link is not supported. Hushmark can open web, email, and Markdown links."
4. A same-document link points to a missing heading: "That section could not be found in this document."
5. Drag-and-drop registration fails at startup: "Drag and drop is unavailable. Use Ctrl+O to open a Markdown file."
6. Windows Setup status cannot be loaded, causing its Help-page action to disappear: "Setup is unavailable. Hushmark could not read the current installation status."

Top-level file failures, linked Markdown file failures, startup failures, and Windows setup-action failures already have visible states. Malformed mathematics remains visible as its source with local error styling and a tooltip. Window-title failures are cosmetic and should remain non-interrupting.

## Near-Term macOS Release Readiness

- Complete the Intel Mac smoke test in `docs/macos-support.md`, including Finder while quit/running, Dock reopen, native menus, full screen, and reader fixtures under WebKit.
- Validate each GitHub-built Universal DMG on Intel and periodically on Apple Silicon hardware when available.
- Consider Developer ID signing, notarization, and stapling later if the unsigned release experience becomes too burdensome.
- Keep macOS installation and Finder integration bundle-owned; do not add an in-app installer, updater, or settings surface.

## Open Product Decisions

These came out of the October 2026 quality review. Each needs an explicit product decision before implementation; record the outcome here or in the focused docs.

### Reading behavior

- **Reload.** F5 is WebView behavior, not a Hushmark command: it restarts the frontend, which reloads the document Hushmark was launched with, losing Back/Forward history and returning linked or Ctrl+O documents to the launch file or Home. Decide whether to add a deliberate Reload that re-reads the current file while keeping its reading position and history, and whether to list it on the Help page. Automatic reload when the file changes on disk is a separate, optional idea.
- **Find in page.** Ctrl+F comes from the WebView rather than Hushmark. It is expected to work in WebView2 on Windows but not in WebKitGTK or WKWebView; verify each platform, then decide whether to list it on Help only where it works or to provide a minimal find overlay everywhere.
- **Remembered zoom and layout.** Zoom and layout deliberately reset to Page at 100% on every launch. Reconsider remembering the last zoom level for readers who always need larger text; this would be persisted state, not a settings surface.
- **Dark appearance.** The reader stays light on every platform until a shared dark reader design exists. Decide whether to design one, for example a warm dark paper that follows the operating-system appearance.
- **Help shortcut.** Ctrl+H usually means History or Replace elsewhere. Consider adding F1 as a conventional alternative.

### Documents and Markdown coverage

- **Folder boundary.** Local images must stay inside the opened document's folder, and Markdown links inside the first opened document's folder, so `docs/guide.md` cannot show `../assets/diagram.png`. Consider a wider read-only boundary, such as the enclosing Git repository, and record the security reasoning.
- **Markdown extensions.** Candidates: footnotes (a `pulldown-cmark` option plus styling), GitHub alert blockquotes (`> [!NOTE]`), bare-URL autolinks, GitHub-compatible heading ids, and restrained syntax highlighting for fenced code.

### Dependencies

- **Mermaid 12.** Two low-severity advisories remain in the KaTeX copy bundled by Mermaid 11. Mermaid 12 resolves them but is a major upgrade; verify every diagram in `examples/mermaid-visual-inspection.md` at several zoom levels and in print before accepting it.
- **Tauri 2.12.** See Near-Term Linux Support. Smoke-test Windows setup, macOS menus and Finder events, and Linux windowing after upgrading.

### Robustness

- **Deeply nested documents.** Sanitizing is quadratic in HTML nesting depth (measured 2026-10-23: 10,000 nested blockquotes take 0.3 seconds, 100,000 take 31 seconds; nested raw `<div>` elements behave the same). The cost is in the sanitizer's HTML parser, not in Hushmark code. Options: cap nesting depth before sanitizing, as browsers cap DOM depth; make the document-loading commands asynchronous so rendering runs off the main thread and the window stays responsive; or both. Either changes behavior for pathological files only.

### Presentation and distribution

- **README.** The screenshot predates current features and shows the README itself; the README also leads with packaging details rather than what Hushmark is for. Consider a current screenshot of a document with mathematics, a diagram, and a table.
- **Signing.** Unsigned builds trigger SmartScreen and Gatekeeper warnings, the largest first-run obstacle. Options include SignPath (free for open source) or Azure Trusted Signing on Windows, and an Apple Developer ID on macOS.
- **Package managers.** Consider winget and Scoop, a Homebrew cask (which may require signing), and Flathub, alongside the existing AUR package.

## Later Ideas

These are speculative unless a future request explicitly accepts them:

- Overlay controls that appear only when needed and do not become a persistent toolbar.
- Table-of-contents overlay generated from document headings.
- Source/render toggle for inspection only, with no editing workflow.
- More Markdown fixtures or focused tests for parser, sanitization, image, link, and navigation edge cases.
- Frontend tests for setup affordance behavior and DOM-level rendering, if a DOM test environment proves worthwhile.
- Additional Linux package formats after a source-based package path is proven.

## Refactoring Ideas

- Keep setup UI in `src/setupView.ts`; avoid mixing setup concerns back into reader code.
- Keep Windows registry, ShellExecute, and setup/install behavior isolated behind platform gates or platform-specific modules.
- Extract Markdown rendering helpers only if `src-tauri/src/document.rs` becomes harder to reason about.
- Consider splitting `src-tauri/src/setup.rs` (Windows registry, install, and self-uninstall) into smaller modules; validate any change on Windows.

Refactors should be behavior-preserving unless the user asks for a visible product change.
