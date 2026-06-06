# Hushmark Release Checklist

Use this for tester or GitHub releases. Do not run it for ordinary docs-only changes unless a release is actually being prepared.

## Version Policy

- Bump the patch version for tester-visible builds.
- Do not bump the version for docs-only changes, internal refactors, or behavior-preserving maintenance.
- Keep versions aligned in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and `docs/windows-integration.md`.

## Before Building

- Check `git status --short --branch`.
- Move completed tester-visible notes from `CHANGELOG.md` `Unreleased` into the new version entry.
- Confirm no unrelated local artifacts are staged.
- Confirm docs and setup instructions use `--setup`.

## Build Commands

PowerShell:

```powershell
npm run build
Push-Location .\src-tauri; cargo fmt; cargo test --quiet; Pop-Location
npm run tauri -- build
git diff --check
```

Bash:

```bash
npm run build
(cd src-tauri && cargo fmt && cargo test --quiet)
npm run tauri -- build
git diff --check
```

## GitHub Actions Release Build

Use GitHub Actions for Windows release binaries. The release workflow lives at `.github/workflows/release.yml` and runs on `windows-latest`. Ordinary branch pushes do not run this workflow. Manual runs produce workflow artifacts only; pushed `v*` tags also create a draft prerelease.

Manual tester build:

1. Push the branch to GitHub if needed.
2. Open **Actions** -> **Release**.
3. Click **Run workflow**.
4. Download the produced workflow artifact from the completed run.
5. Smoke-test the downloaded Windows executable before sharing it.

Tagged draft release:

1. Confirm the app version is current and committed.
2. Create and push a matching version tag, for example `v0.1.4`.
3. Wait for the **Release** workflow to finish.
4. Open **Releases** and inspect the draft prerelease named `Hushmark 0.1.4`.
5. Download and smoke-test the attached Windows artifact.
6. Publish the draft release only after manual testing; clear the prerelease flag if this is no longer a tester-only release.

Workflow artifacts are available from the run summary under **Artifacts**. The workflow uploads the standalone executable from `src-tauri/target/release/hushmark.exe` using a `Hushmark-<version>-windows-x86_64-exe` artifact name. Tag builds also attach the Windows artifact to the draft GitHub Release.

## Smoke Tests

- Run `src-tauri\target\release\hushmark.exe examples\markdown-visual-inspection.md`.
- Open with no arguments and confirm the empty state.
- Open setup with `src-tauri\target\release\hushmark.exe --setup`.
- Check Ctrl+O from empty state and from an open document.
- Check same-document fragments, missing fragments, Alt+Left, and Alt+Right.
- Check relative `.md` / `.markdown` links, linked fragments, Back/Forward, and blocked unsafe links.
- Check local images, table alignment, code overflow, Hebrew text, and unsafe HTML examples.
- Check external `https:` and `mailto:` links open outside Hushmark.
- Confirm the internal WebView context menu remains disabled.
- If setup changed, smoke install/update, Open With, right-click entry, Default Apps handoff, and remove-all behavior on Windows.

## Local Release History

Release build output is local and ignored. If keeping local tester history, use:

```text
src-tauri/target/release/versions/hushmark-<version>.exe
src-tauri/target/release/versions/hushmark-<version>-<short-note>.exe
```

Leave the current build at `src-tauri/target/release/hushmark.exe`.

## GitHub Release Notes

- Mention that Windows binaries are currently unsigned.
- Warn testers that Windows SmartScreen may show a warning for unsigned builds.
- Summarize tester-visible changes from `CHANGELOG.md`.
- Include the standalone `hushmark.exe` only if that is the intended artifact for the release.

## Do Not Commit

- `node_modules/`
- `dist/`
- `src-tauri/target/`
- Local `*.exe`, installer, or archive artifacts.
- Old binaries or local release-history folders.
- Imported handoff folders or exported todo/status tables.
- Temporary logs, screenshots, or smoke-test scratch files unless explicitly added as docs assets.
