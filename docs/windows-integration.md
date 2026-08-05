# Hushmark Windows integration

Hushmark's setup and desktop integration behavior is Windows-only. Hushmark is designed to run as a standalone Tauri executable and can self-install for the current Windows user without admin rights.

Hushmark has no setup command-line mode. On Windows, setup is reached from the empty-state action. Linux setup is handled by packaging rather than by an in-app panel.

## Product identity

The product identity is centralized in:

- Rust: `src-tauri/src/identity.rs`
- Frontend: `src/product.ts`
- Version metadata: `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`

Current values:

- Display name: `Hushmark`
- Developer: `Jonathan Lahav`
- Release binary: `hushmark.exe`
- Installed executable: `Hushmark.exe`
- Install directory name: `Hushmark`
- ProgID: `Hushmark.md`
- Context-menu label: `Open with Hushmark`

## Install path

The setup page copies the running executable to:

```text
%LOCALAPPDATA%\Programs\Hushmark\Hushmark.exe
```

The install/update path uses a temporary copy and replaces the existing executable with the Windows file-replacement API when updating. The setup UI treats installation as its own immediate row: checked means the installed copy exists and matches the current executable.

## Registry keys

Hushmark writes only per-user registry entries under `HKCU`.

Open With support creates:

```text
HKCU\Software\Microsoft\Windows\CurrentVersion\App Paths\Hushmark.exe
HKCU\Software\Classes\Hushmark.md
HKCU\Software\Classes\Hushmark.md\DefaultIcon
HKCU\Software\Classes\Hushmark.md\shell\open\command
HKCU\Software\Classes\Applications\Hushmark.exe\shell\open\command
HKCU\Software\Classes\Applications\Hushmark.exe\SupportedTypes
HKCU\Software\Classes\Applications\Hushmark.exe\Capabilities
HKCU\Software\Classes\Applications\Hushmark.exe\Capabilities\FileAssociations
HKCU\Software\RegisteredApplications
HKCU\Software\Classes\.md\OpenWithProgids
HKCU\Software\Classes\.markdown\OpenWithProgids
```

The right-click menu row creates:

```text
HKCU\Software\Classes\SystemFileAssociations\.md\shell\OpenWithHushmark
HKCU\Software\Classes\SystemFileAssociations\.md\shell\OpenWithHushmark\command
HKCU\Software\Classes\SystemFileAssociations\.markdown\shell\OpenWithHushmark
HKCU\Software\Classes\SystemFileAssociations\.markdown\shell\OpenWithHushmark\command
```

The `.md` and `.markdown` `OpenWithProgids` keys and `Software\RegisteredApplications` key are shared Windows keys; Hushmark removes only its own `Hushmark.md` / `Hushmark` values from them.

After install/remove, Hushmark calls `SHChangeNotify(SHCNE_ASSOCCHANGED, ...)` so Explorer can refresh association state.

## Setup control panel behavior

Setup is an immediate integration page reached from the Windows empty state. There is no Apply button or expandable diagnostics section. The current version and whether the running executable is installed or standalone are visible beneath the heading. The empty-state action reads **Setup** in quiet text when the installed copy is current, and changes to Install, Update, Downgrade, or Reinstall when the running copy calls for an action. When an installed executable differs from the running build, its version appears directly in the installation row if it can be read.

Rows:

1. **Install Hushmark** copies or replaces `%LOCALAPPDATA%\Programs\Hushmark\Hushmark.exe`. If the installed version is older than the running version, the row reads **Update Hushmark**. If it is newer, the row reads **Downgrade Hushmark**. A same-version executable with different bytes reads **Reinstall Hushmark**. Turning off a current install performs the same complete removal as the uninstall action, so Windows is not left pointing at a missing executable.
2. **Show Hushmark in Open With** installs/updates Hushmark first if needed, then adds or removes only Hushmark Open With registration. If Open With already points at an older installed copy that still exists, the row remains checked while the install row offers the update.
3. **Add right-click menu entry** installs/updates Hushmark first if needed, then adds or removes only Hushmark context-menu entries. If the right-click command points at an older installed copy that still exists, the row remains checked while the install row offers the update.

Each row is the direct control for the state it displays and refreshes from actual file/registry state after the operation. Clicking a current installation row removes the installed copy and its integration; doing this from a separate standalone executable is immediate because that executable remains available. Doing it from the running installed copy expands an inline confirmation before Hushmark removes itself and closes. A separate **Remove installed copy** action appears only when a different installed build must remain distinct from the Update, Downgrade, or Reinstall action. **Remove Hushmark integration** appears only for orphaned registration without an installed executable.

Uninstall removes Hushmark's Open With registration, right-click entries, App Paths/application registration, installed executable, and fixed `Hushmark.exe.tmp` update file. If the installed executable is the currently running process, Hushmark starts a hidden, fixed PowerShell cleanup command from the Windows system directory, with a working directory outside the Hushmark install folder, then exits. It does not download or retain a helper executable or script. `%LOCALAPPDATA%\Programs\Hushmark` is removed only when empty; unrelated files are never removed recursively.

This is a complete removal of files and registry values owned by Hushmark. Windows may independently retain operating-system history or caches, such as event records or Prefetch data; the app does not attempt to erase those system-owned records.

## Default-app behavior

Hushmark does not automatically set itself as the default Markdown app.

Windows 10/11 default-app selection is intentionally user-controlled and stored in protected `UserChoice` entries. Hushmark registers itself as a candidate handler for Open With, but the setup page does not include a Default Apps shortcut or attempt to change the default handler.

## Manual test steps

Build release:

```powershell
npm run build
Push-Location .\src-tauri; cargo fmt; cargo test --quiet; Pop-Location
npm run tauri -- build
```

Run standalone:

```powershell
.\src-tauri\target\release\hushmark.exe .\examples\example.md
```

Test a copied executable:

```powershell
$temp = Join-Path $env:TEMP "hushmark-standalone-test"
New-Item -ItemType Directory -Force -Path $temp
Copy-Item .\src-tauri\target\release\hushmark.exe "$temp\Hushmark.exe"
& "$temp\Hushmark.exe" .\examples\example.md
```

In setup:

1. Run Hushmark without a document and open setup from the top-right action.
2. Click **Install Hushmark** and confirm `%LOCALAPPDATA%\Programs\Hushmark\Hushmark.exe` exists.
3. Confirm the empty-state action reads a quiet **Setup** when the installed copy is current.
4. Run a newer standalone build and confirm **Update Hushmark**. Run an older standalone build and confirm **Downgrade Hushmark**.
5. Confirm setup identifies whether the current process is the installed copy or a standalone copy.
6. From a fresh state, click **Show Hushmark in Open With** and confirm setup auto-installs Hushmark before adding Open With registration.
7. Click **Show Hushmark in Open With** again and confirm only Open With registration is removed.
8. From a fresh state, click **Add right-click menu entry** and confirm setup auto-installs Hushmark before adding context-menu entries.
9. Right-click a `.md` / `.markdown` file and check that **Open with Hushmark** appears.
10. Confirm there is no Default Apps control in setup.
11. Run the installed executable, click **Installed copy**, and confirm the inline uninstall prompt can be cancelled without changes. Open it again, choose **Uninstall**, and confirm the app exits, its owned registry entries are gone, and the empty `%LOCALAPPDATA%\Programs\Hushmark` directory is removed shortly afterward.
