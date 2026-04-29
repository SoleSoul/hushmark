# Hushmark Windows integration

Hushmark is designed to run as a standalone Tauri executable and can self-install for the current Windows user without admin rights.

## Product identity

The product identity is centralized in:

- Rust: `src-tauri/src/identity.rs`
- Frontend: `src/product.ts`

Current values:

- Display name: `Hushmark`
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

The install/update path uses a temporary copy and replaces the existing executable with the Windows file-replacement API when updating.

## Registry keys

Hushmark writes only per-user registry entries under `HKCU`:

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
HKCU\Software\Classes\SystemFileAssociations\.md\shell\OpenWithHushmark
HKCU\Software\Classes\SystemFileAssociations\.md\shell\OpenWithHushmark\command
HKCU\Software\Classes\SystemFileAssociations\.markdown\shell\OpenWithHushmark
HKCU\Software\Classes\SystemFileAssociations\.markdown\shell\OpenWithHushmark\command
```

The `.md` and `.markdown` `OpenWithProgids` keys and `Software\RegisteredApplications` key are shared Windows keys; Hushmark removes only its own `Hushmark.md` / `Hushmark` values from them.

After install/remove, Hushmark calls `SHChangeNotify(SHCNE_ASSOCCHANGED, ...)` so Explorer can refresh association state.

## Default-app behavior

Hushmark does not automatically set itself as the default Markdown app.

Windows 10/11 default-app selection is intentionally user-controlled and stored in protected `UserChoice` entries. Hushmark registers itself as a candidate handler and opens Windows Default Apps settings so the user can explicitly choose it.

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

1. Click **Install / Update Hushmark**.
2. Confirm `%LOCALAPPDATA%\Programs\Hushmark\Hushmark.exe` exists.
3. Right-click a `.md` file and check that **Open with Hushmark** appears.
4. Open Windows Default Apps from setup and choose Hushmark manually for `.md` / `.markdown` if desired.
5. Double-click a Markdown file after choosing Hushmark as default.
6. Click **Remove integration / uninstall**.
7. Confirm Hushmark registry entries are removed.

If setup is running from the installed executable, or another Hushmark window is holding the installed executable open, Hushmark removes registry integration but leaves the executable in place. Close Hushmark, then manually delete `%LOCALAPPDATA%\Programs\Hushmark\Hushmark.exe` if needed.

