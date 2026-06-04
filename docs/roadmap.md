# Hushmark Roadmap

This roadmap is not a contract. It is a short parking lot for likely next work and ideas that may be accepted, changed, or rejected later.

## Near-Term Release Readiness

- Revalidate the migrated repo on the current machine before preparing the next tester build.
- Keep `CHANGELOG.md` current under `Unreleased` for tester-visible changes.
- Run the release checklist before publishing any GitHub/tester binary.
- Smoke-test `examples/markdown-visual-inspection.md`, same-document fragments, relative Markdown links, Back/Forward, Ctrl+O, local images, table alignment, external links, and setup mode.
- Confirm docs use `--setup`; older handoff notes that mention `--install` are stale.
- Keep the imported `project-context-handoff/` folder out of tracked project docs and commits.

## Later Ideas

These are speculative unless a future request explicitly accepts them:

- Overlay controls that appear only when needed and do not become a persistent toolbar.
- Table-of-contents overlay generated from document headings.
- Source/render toggle for inspection only, with no editing workflow.
- Reading width and zoom controls that preserve the minimalist reader feel.
- More Markdown fixtures or focused tests for parser, sanitization, image, link, and navigation edge cases.
- Optional frontend tests for link classification, document history, and setup affordance behavior.

## Refactoring Ideas

- Split reader rendering/link handling/navigation out of `src/main.ts` when frontend work next grows.
- Keep setup UI in `src/setupView.ts`; avoid mixing setup concerns back into reader code.
- Consolidate version and identity update checks if release work becomes repetitive.
- Extract Markdown rendering helpers only if `src-tauri/src/document.rs` becomes harder to reason about.

Refactors should be behavior-preserving unless the user asks for a visible product change.
