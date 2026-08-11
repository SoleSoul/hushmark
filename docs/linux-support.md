# Hushmark Linux Support

Linux runtime support is available from the shared Hushmark codebase. The reader core is platform-neutral, Windows setup code is excluded from Linux builds, and external links use Tauri's cross-platform opener. GitHub Releases publish Windows and macOS artifacts; the AUR package is maintained as downstream Linux packaging in a separate repository.

## Runtime Policy

Linux builds do not provide setup, self-install, self-update, Open With, context-menu, or default-app controls. Hushmark has no setup command-line mode on any platform.

Installation, updates, desktop integration, icons, and MIME registration belong to the package manager or distribution package.

## Wayland Window Decorations

Hushmark's current Tauri dependency line uses Tao 0.34 on Linux. Its custom Wayland client-side decorations can look inconsistent with the GNOME color scheme, and title-bar controls may not receive pointer input. Hushmark's initially hidden window may make the input problem more visible, but changing Linux startup behavior would be a temporary workaround rather than the correct fix.

Tao 0.36 restores GTK's normal decoration handling and fixes the related Wayland title-bar input bugs. Upgrade Hushmark when a stable Tauri release consumes Tao 0.36 or later, then validate GNOME Wayland title appearance, minimize/maximize/close input, startup visibility, and Windows window behavior. Do not replace the native title bar with an HTML implementation for this issue.

## WebKitGTK Renderer Workaround

On tested Linux systems, WebKitGTK's DMABUF renderer produced a blank window on NVIDIA/X11 and a Wayland protocol error on labwc/wlroots. Hushmark sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` by default on Linux before GTK/WebKit initialization, unless the user has already set that variable.

Retest this default as WebKitGTK and graphics drivers change.

## Packaging

An AUR package currently provides the established downstream source-package path. Its release procedure and external repository are documented in `docs/release-checklist.md`. Other supported or first-party Linux package formats have not been decided.

Any Linux package should:

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
