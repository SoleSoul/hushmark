# Hushmark Roadmap

This roadmap is not a contract. It is a short parking lot for likely next work and ideas that may be accepted, changed, or rejected later.

## Near-Term Release Readiness

- Keep `CHANGELOG.md` current under `Unreleased` for user-visible changes.
- Run the release checklist before publishing any GitHub release or explicitly shared prerelease binary.
- Smoke-test `examples/markdown-visual-inspection.md`, `examples/math-visual-inspection.md`, `examples/mermaid-visual-inspection.md`, same-document fragments, relative Markdown links, Home/Back/Forward, document zoom/layout, Ctrl+O, Ctrl+P, Ctrl+H, local images, table alignment, external links, and Windows setup mode.
- Smoke-test the quiet Windows setup entry point and install-version action labels.

## Near-Term Linux Support

- Upgrade to a stable Tauri release containing Tao 0.36 or later, then validate native title-bar appearance and window controls on GNOME Wayland without adding a custom title bar. Checked 2026-08-09: Tao 0.36.0 is available, but stable Tauri 2.11.5 uses `tauri-runtime-wry` 2.11.4, which still depends on Tao 0.35.0; do not force an unsupported override.
- Decide whether the WebKitGTK/NVIDIA DMABUF blank-window issue needs an app-level or package-level workaround before a public Linux release.
- Keep the checked-in desktop entry and icon aligned with downstream Linux packaging, and verify Markdown MIME associations when packaging changes.
- Validate file opening, Ctrl+O, drag/drop, document links, local images, external links, and navigation on Linux.
- Keep install, update, and desktop-integration ownership in Linux packaging; do not add an in-app setup flow.
- Add Linux CI only when it performs a useful build or test rather than duplicating the Windows release workflow.

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

## Later Ideas

These are speculative unless a future request explicitly accepts them:

- Overlay controls that appear only when needed and do not become a persistent toolbar.
- Table-of-contents overlay generated from document headings.
- Source/render toggle for inspection only, with no editing workflow.
- More Markdown fixtures or focused tests for parser, sanitization, image, link, and navigation edge cases.
- Optional frontend tests for link classification, document history, and setup affordance behavior.
- Additional Linux package formats after a source-based package path is proven.
- macOS support after Windows remains stable and Linux support is better understood.

## Refactoring Ideas

- Split reader rendering/link handling/navigation out of `src/main.ts` when frontend work next grows.
- Keep setup UI in `src/setupView.ts`; avoid mixing setup concerns back into reader code.
- Keep Windows registry, ShellExecute, and setup/install behavior isolated behind platform gates or platform-specific modules.
- Consolidate version and identity update checks if release work becomes repetitive.
- Extract Markdown rendering helpers only if `src-tauri/src/document.rs` becomes harder to reason about.

Refactors should be behavior-preserving unless the user asks for a visible product change.
