# Hushmark Windows integration

Hushmark is designed to run as a standalone Tauri executable and can self-install for the current Windows user without admin rights.

## Product identity

The product identity is centralized in:

- Rust: `src-tauri/src/identity.rs`
- Frontend: `src/product.ts`

Current values:

- Display name: `Hushmark`
- Version: `0.1.0`
- Developer: `Jonathan Lahav`
- Release binary: `hushmark.exe`
- Installed executable: `Hushmark.exe`
- Install directory name: `Hushmark`
- ProgID: `Hushmark.md`
- Context-menu label: `Open with Hushmark`

## Install path

Setup mode copies the running executable to:

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

Setup mode is an immediate integration control panel. There is no Apply button. Version, developer, executable, and registry status information lives in the collapsed **Details** section so the main UI stays compact.

Rows:

1. **Install Hushmark** copies, updates, or removes `%LOCALAPPDATA%\Programs\Hushmark\Hushmark.exe`. If an installed copy exists but does not match the running build, setup shows it as installed with an update available rather than not installed. Turning off a current install also removes Hushmark Open With and right-click entries so Windows is not left pointing at a missing executable.
2. **Show Hushmark in Open With** installs/updates Hushmark first if needed, then adds or removes only Hushmark Open With registration. If Open With already points at an older installed copy that still exists, the row remains checked while the install row offers the update.
3. **Add right-click menu entry** installs/updates Hushmark first if needed, then adds or removes only Hushmark context-menu entries. If the right-click command points at an older installed copy that still exists, the row remains checked while the install row offers the update.

Each row refreshes from actual file/registry state after the operation. The **Remove all Hushmark integration** action removes Hushmark Open With registration, right-click entries, App Paths/application registration, and the installed executable when safe. It removes `%LOCALAPPDATA%\Programs\Hushmark` only if the directory is empty.

## Default-app behavior

Hushmark does not automatically set itself as the default Markdown app.

Windows 10/11 default-app selection is intentionally user-controlled and stored in protected `UserChoice` entries. Hushmark registers itself as a candidate handler and tries to open Windows Default Apps settings with the Windows shell so the user can explicitly choose it.

If Windows refuses to open Settings automatically, setup shows calm fallback instructions and keeps the technical OS error in the collapsed Details section.

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

Open setup:

```powershell
.\src-tauri\target\release\hushmark.exe --install
```

In setup:

1. Click **Install Hushmark** and confirm `%LOCALAPPDATA%\Programs\Hushmark\Hushmark.exe` exists.
2. Click **Install Hushmark** again and confirm the installed executable is removed when safe.
3. From a fresh state, click **Show Hushmark in Open With** and confirm setup auto-installs Hushmark before adding Open With registration.
4. Click **Show Hushmark in Open With** again and confirm only Open With registration is removed.
5. From a fresh state, click **Add right-click menu entry** and confirm setup auto-installs Hushmark before adding context-menu entries.
6. Right-click a `.md` / `.markdown` file and check that **Open with Hushmark** appears.
7. Open Windows Default Apps from setup and choose Hushmark manually for `.md` / `.markdown` if desired.
8. Double-click a Markdown file after choosing Hushmark as default.
9. Click **Remove all Hushmark integration** and confirm Hushmark registry entries and the installed executable are removed when safe.

If setup is running from the installed executable, or another Hushmark window is holding the installed executable open, Hushmark removes registry integration but leaves the executable in place. Close Hushmark, then manually delete `%LOCALAPPDATA%\Programs\Hushmark\Hushmark.exe` if needed.

