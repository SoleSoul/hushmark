# Hushmark macOS Support

Hushmark uses the shared reader on macOS inside a platform-specific native application shell. The shell contract in `src/platformShell.ts` dynamically loads `src/macos.ts` only on macOS. Finder events and semantic reader commands cross that narrow bridge between `src-tauri/src/macos.rs` and shared behavior in `src/main.ts`. Native Open and Print commands stay in the Rust shell because they own native dialogs; Open sends only the selected document path through the shared loading path.

## Application Behavior

- Hushmark uses a normal decorated macOS window with native traffic-light controls and native full screen.
- Command-W closes the window by hiding the retained single reader window. The process and its reading state remain alive.
- Command-Q quits through the native application menu.
- Command-H, Hide Others, Show All, and the About panel use native predefined menu items.
- Clicking the Dock icon with no visible window shows and focuses the retained reader window.
- Document windows use the file name as their title. The Home / Help page keeps **Hushmark** as the window title and page heading.
- The reader deliberately retains Hushmark's existing light appearance when macOS changes system appearance. Dark reader colors require a separate shared design rather than an automatic platform palette.

The retained hidden window is deliberate. Hushmark has one document/navigation model rather than a multi-window document controller, so retaining the window gives normal Mac close/reopen behavior without discarding the reader state.

## Menu And Shortcuts

The macOS menu is native and intentionally small:

- **Hushmark**: About, Services, Hide, Hide Others, Show All, Quit
- **File**: Open, Close, Print
- **Edit**: Copy, Select All
- **Go**: Back, Forward, Home / Help
- **View**: Page, Full Width, zoom commands, Enter Full Screen
- **Window**: Minimize, Zoom, Bring All to Front
- **Help**: Home / Help

Home / Help is available through both Shift-Command-H and Command-Question Mark. Bare Command-H remains the native Hide command. Command-L switches between Page and Full Width; both layouts also have direct View-menu choices, with the shortcut shown beside the layout that Command-L will switch to. Open Recent is intentionally omitted until Hushmark has a clean NSDocumentController-compatible recent-document implementation; no custom recent-files surface is maintained.

Command-P opens WKWebView's native macOS print sheet. The Print item is enabled only for a successfully rendered document and remains disabled while asynchronous Mermaid diagrams are being prepared.

## Finder Integration

The macOS bundle declares `.md` and `.markdown` as Markdown documents with `Viewer` role and `Alternate` handler rank. This makes Hushmark available in Finder and Open With without claiming ownership or changing the user's default application.

Hushmark also imports `net.daringfireball.markdown`, maps it to both extensions and `text/markdown`, and declares conformance to `public.utf8-plain-text`. The imported declaration is required because Hushmark supports macOS versions where Markdown is not a system-declared type. It intentionally uses `UTImportedTypeDeclarations`, not an exported declaration: Hushmark supports the established Markdown format but does not own it.

Tauri's macOS `Opened` application events handle files opened while Hushmark is starting or already running, including Finder, Open With, and Dock-icon drops. Events received before the webview is ready are queued in the macOS shell. Additional top-level files replace the current single-window navigation session, matching Hushmark's existing model.

## Packaging

`src-tauri/tauri.macos.conf.json` is merged only for macOS builds. It enables `.app` and `.dmg` bundles, the macOS ICNS icon, Finder declarations, the macOS-only `Info.macos.plist` additions, hardened runtime, and a deliberate minimum deployment target of macOS 12 Monterey. It does not enable App Store sandboxing or any Windows setup behavior. Its null `licenseFile` is also deliberate: the repository remains GPL-licensed, but the license text must not become a DMG click-through agreement, which prevents normal drag-to-Applications copying on current macOS.

The supported distribution is a DMG containing Hushmark and an Applications link. Build a Universal binary for Intel and Apple Silicon with:

```sh
rustup target add x86_64-apple-darwin aarch64-apple-darwin
npm ci
npm run tauri -- build --target universal-apple-darwin
```

The expected outputs are under `src-tauri/target/universal-apple-darwin/release/bundle/macos/` and `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`.

GitHub Actions builds the same Universal target for manual workflow runs and version tags. Manual runs retain the DMG as a workflow artifact; tagged runs also attach it to the draft GitHub release as `Hushmark-<version>-macOS-universal-unsigned.dmg`. The filename and release notes identify the DMG as unsigned. macOS Gatekeeper may require users to attempt the first launch and then approve Hushmark with **Open Anyway** in System Settings → Privacy & Security.

Developer ID signing and notarization are optional future release improvements. If adopted, use a **Developer ID Application** certificate and keep all signing and notarization credentials in GitHub Actions secrets; never commit credentials or certificate exports.

## Intel Mac Smoke Test

Test both a development build and the Universal DMG on the Intel Mac:

1. Launch with no file and confirm the Hushmark window title and page heading, Home / Help contents, native menu bar, traffic lights, light reader appearance, and focus.
2. Check Command-O and File → Open from both Home / Help and an open document; check Command-P, Command-W, Dock reopen, Command-H, Command-Q, and Control-Command-F.
3. Check Shift-Command-H and Command-Question Mark reach the same Home / Help history entry; Command-[ and Command-] navigate history, and the native window title switches between each document name and Hushmark.
4. Open `.md` and `.markdown` while quit and running, with Finder Open, Open With, and a Dock-icon drop.
5. Confirm Hushmark appears as an alternate viewer and does not replace the current default handler.
6. Check Command-L switches between Page and Full Width, both direct View-menu choices work, and zoom, reading-position restoration, and full screen remain correct.
7. Switch macOS between Light and Dark appearances and confirm the reader remains consistently light; check trackpad scrolling, selection, Command-C, and Select All.
8. Open the Markdown, math, Mermaid, and print visual-inspection examples and check typography, code, tables, task lists, RTL/Hebrew, KaTeX, diagrams, local raster/SVG images, fragments, links, overflow, errors, and printing.
9. Inspect the built app with `lipo -info` and confirm both `x86_64` and `arm64` are present.
10. For a release candidate, download the GitHub-built DMG, confirm the unsigned Gatekeeper flow, and launch the copy installed in Applications. If signing is added later, also verify the signature, notarization, and stapled ticket.
