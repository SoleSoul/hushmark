# Hushmark Roadmap

This roadmap is not a contract. It is a short parking lot for likely next work and ideas that may be accepted, changed, or rejected later.

## Near-Term Release Readiness

- Prepare platform boundaries for Linux support while preserving current Windows behavior.
- Revalidate the migrated repo on the current machine before preparing the next tester build.
- Keep `CHANGELOG.md` current under `Unreleased` for tester-visible changes.
- Run the release checklist before publishing any GitHub/tester binary.
- Smoke-test `examples/markdown-visual-inspection.md`, same-document fragments, relative Markdown links, Back/Forward, Ctrl+O, local images, table alignment, external links, and setup mode.
- Confirm setup documentation uses `--setup`.
- Keep the imported `project-context-handoff/` folder out of tracked project docs and commits.

## Near-Term Linux Support

- Integrate the checked-in desktop entry and icon into Linux packaging and verify Markdown MIME associations.
- Validate file opening, Ctrl+O, drag/drop, document links, local images, external links, and navigation on Linux.
- Keep install, update, and desktop-integration ownership in Linux packaging; do not add an in-app setup flow.
- Add Linux CI only when it performs a useful build or test rather than duplicating the Windows release workflow.

## Later Ideas

These are speculative unless a future request explicitly accepts them:

- Overlay controls that appear only when needed and do not become a persistent toolbar.
- Table-of-contents overlay generated from document headings.
- Source/render toggle for inspection only, with no editing workflow.
- Reading width and zoom controls that preserve the minimalist reader feel.
- More Markdown fixtures or focused tests for parser, sanitization, image, link, and navigation edge cases.
- Optional frontend tests for link classification, document history, and setup affordance behavior.
- Linux packaging and desktop integration, such as `.desktop` files and MIME association, after the reader can run cleanly on Linux.
- macOS support after Windows remains stable and Linux support is better understood.

## Refactoring Ideas

- Split reader rendering/link handling/navigation out of `src/main.ts` when frontend work next grows.
- Keep setup UI in `src/setupView.ts`; avoid mixing setup concerns back into reader code.
- Keep Windows registry, ShellExecute, and setup/install behavior isolated behind platform gates or platform-specific modules.
- Consolidate version and identity update checks if release work becomes repetitive.
- Extract Markdown rendering helpers only if `src-tauri/src/document.rs` becomes harder to reason about.

Refactors should be behavior-preserving unless the user asks for a visible product change.
