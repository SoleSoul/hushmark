# Agent Instructions

This is the canonical Windows Hushmark codebase.

Hushmark is a calm, minimalist Markdown reader for Windows.

Preserve the product restraint:

- No editor.
- No toolbar.
- No tabs.
- No recent-files surface.
- No file tree.
- No reader settings surface unless explicitly requested.

Prefer small, behavior-preserving changes that follow the existing Rust + Tauri 2 + vanilla TypeScript structure. Do not bump the app version unless the work is an intentional tester-visible release.

Before claiming success, run the relevant checks for the change. For docs-only changes, at least inspect the diff and run `git diff --check`. For code changes, prefer `npm run build`, `cargo fmt`, `cargo test --quiet`, and `npm run tauri -- build` when the touched area warrants it.

Do not store project decisions in hidden agent/tool memory. Durable context belongs in tracked repository docs.

Start here:

- `docs/project-context.md`
- `docs/reader-design.md`
- `docs/markdown-support.md`
- `docs/windows-integration.md`
- `docs/roadmap.md`
- `docs/release-checklist.md`
