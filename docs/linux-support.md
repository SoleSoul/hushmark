# Hushmark Linux Support

Linux runtime support is available from the shared Hushmark codebase. The reader core is platform-neutral, Windows setup code is excluded from Linux builds, and external links use Tauri's cross-platform opener.

## Runtime Policy

Linux builds do not provide setup, self-install, self-update, Open With, context-menu, or default-app controls. `--setup` is not recognized on Linux and behaves like any other flag-shaped file argument.

Installation, updates, desktop integration, icons, and MIME registration belong to the package manager or distribution package.

## Known Runtime Issue

On the tested NVIDIA/X11 system, WebKitGTK's DMABUF renderer produces a blank window. Launching with `WEBKIT_DISABLE_DMABUF_RENDERER=1` avoids the upstream rendering failure. Keep this workaround explicit and retest without it as WebKitGTK and graphics drivers change.

## Packaging

The supported package formats have not been decided. Any Linux package should:

- install the `hushmark` executable in the normal executable path;
- install `packaging/linux/hushmark.desktop` as the desktop entry;
- install `src-tauri/icons/icon.svg` as the scalable `hushmark` application icon;
- declare Markdown MIME associations from the desktop entry;
- let the package manager own installation and updates.

Create package-specific metadata against a stable Linux-capable release tag, so it can reference a stable upstream source archive and checksum.

## Remaining Validation

- Launch and window behavior on a supported Linux desktop.
- Command-line file opening, Ctrl+O, and drag/drop.
- Relative document links, local images, and Back/Forward navigation.
- External `http`, `https`, and `mailto` links through the system default application.
- Desktop entry, icon, and Markdown MIME registration from the package.
