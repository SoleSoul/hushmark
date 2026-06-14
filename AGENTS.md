# Agent Instructions

This is the canonical Hushmark codebase. The current release target is Windows, with Linux support being prepared as the next platform target.

Hushmark is a calm, minimalist Markdown reader. Do not add platform-specific behavior or packaging unless explicitly requested.

Keep platform-specific behavior isolated. Windows registry, ShellExecute, setup/install, Open With, right-click, and Default Apps behavior should not be mixed into core reader, Markdown rendering, or navigation logic. Linux setup should be handled through packaging rather than an in-app setup mode; Linux support should start with clear stubs or small abstractions before desktop integration is implemented.

Preserve the product restraint:

- No editor.
- No toolbar.
- No tabs.
- No recent-files surface.
- No file tree.
- No reader settings surface unless explicitly requested.

Prefer small, behavior-preserving changes that follow the existing Rust + Tauri 2 + vanilla TypeScript structure. Do not bump the app version unless the work is an intentional tester-visible release.

Before claiming success, run the relevant checks for the change. For docs-only changes, at least inspect the diff and run `git diff --check`. For code changes, prefer `npm run build`, `cargo fmt`, `cargo test --quiet`, and `npm run tauri -- build` when the touched area warrants it.

On non-Windows machines, do not claim Windows release validation from local builds. Prefer lightweight docs/diff checks locally and use GitHub Actions or a Windows machine for Windows release artifacts and smoke tests.

Do not store project decisions in hidden agent/tool memory. Durable context belongs in tracked repository docs.

Start here:

- `docs/project-context.md`
- `docs/reader-design.md`
- `docs/markdown-support.md`
- `docs/windows-integration.md`
- `docs/roadmap.md`
- `docs/release-checklist.md`
