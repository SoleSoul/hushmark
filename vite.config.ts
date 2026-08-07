import { defineConfig, type Plugin } from "vite";

const KATEX_STYLESHEET_SUFFIX = "/katex/dist/katex.min.css";

function useModernKatexFonts(): Plugin {
  return {
    name: "hushmark:katex-woff2-only",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?", 1)[0].replaceAll("\\", "/");
      if (!normalizedId.endsWith(KATEX_STYLESHEET_SUFFIX)) {
        return null;
      }

      let removedFallbacks = 0;
      const code = source.replace(
        /,url\(fonts\/(KaTeX_[^)]+)\.woff\) format\("woff"\),url\(fonts\/\1\.ttf\) format\("truetype"\)/g,
        () => {
          removedFallbacks += 1;
          return "";
        },
      );

      if (
        removedFallbacks === 0 ||
        !code.includes('format("woff2")') ||
        code.includes('format("woff")') ||
        code.includes('format("truetype")')
      ) {
        this.error(
          "KaTeX font declarations changed; review the WOFF2-only stylesheet transform.",
        );
      }

      return { code, map: null };
    },
  };
}

export default defineConfig({
  clearScreen: false,
  plugins: [useModernKatexFonts()],
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
