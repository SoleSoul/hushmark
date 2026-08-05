# Hushmark

A quiet Markdown reader.

Hushmark opens Markdown files in a calm, uncluttered reading view. It is meant for reading documents, notes, READMEs, and small collections of linked Markdown files, not for editing them.

![Hushmark screenshot](docs/images/hushmark-screenshot.png)

## Features

- Clean rendered Markdown view
- Local `.md` / `.markdown` files
- Relative Markdown document links
- Back and Forward navigation
- Page and Full Width document layouts with keyboard zoom
- Generated heading anchors
- Local and remote images
- Tables and strikethrough
- Native document printing with **Ctrl+P**
- External links open outside Hushmark
- Optional Windows Open With and right-click integration

## Install

Download the latest Windows build from the [Releases](../../releases) page.

Current Windows builds are unsigned, so Windows may show a SmartScreen warning.

After opening Hushmark, you can use the setup view to add optional Windows integration for Markdown files.

Linux runtime support is available from the same source release, and an [AUR package](https://aur.archlinux.org/packages/hushmark) provides downstream Arch Linux packaging. Linux desktop integration is handled by packaging rather than by an in-app setup flow.

## Use

Open a Markdown file by:

- double-clicking a file after Windows integration is enabled
- using **Open With**
- dragging a file onto Hushmark
- pressing **Ctrl+O**
- running Hushmark with a Markdown file path

Hushmark remembers document navigation while it is open, including Back and Forward between linked documents.

Press **Ctrl+P** to print the open document through the system print dialog.

Press **Ctrl+H** for Hushmark's keyboard reference. Document view commands include **Ctrl+L** for Page or Full Width layout, **Ctrl++** / **Ctrl+-** for zoom, and **Ctrl+0** to reset zoom.

## Markdown support

Hushmark supports common Markdown reading features, including headings, links, images, tables, strikethrough, code blocks, blockquotes, and lists.

Raw HTML is sanitized before display.

More details are in [docs/markdown-support.md](docs/markdown-support.md).

## Platform status

The Hushmark reader runtime supports Windows and Linux. GitHub Releases currently provide a standalone Windows executable with optional in-app desktop integration. An AUR package is maintained separately; other first-party Linux package formats have not been selected. Linux integration belongs to packages and desktop files rather than an in-app setup flow.

macOS may come later.

## Development

Hushmark is built with Rust, Tauri 2, TypeScript, HTML, and CSS.

Install Node.js with npm, the stable Rust toolchain, and the native prerequisites required by Tauri 2 for your operating system. Windows development requires the Microsoft C++ Build Tools and WebView2; Linux development requires the appropriate WebKitGTK and system build packages for the distribution.

Install the locked JavaScript dependencies before the first build:

```sh
npm ci
```

Useful commands:

```sh
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri -- build
git diff --check
```

Project notes for contributors and coding agents are in [AGENTS.md](AGENTS.md) and [docs/project-context.md](docs/project-context.md).

## License

Hushmark is licensed under the GNU General Public License v3.0 or later.

See [LICENSE](LICENSE).

The Hushmark name and branding are covered separately in [BRANDING.md](BRANDING.md).
