type MermaidRenderer = (typeof import("mermaid"))["default"];

const MERMAID_SELECTOR = "pre > code.mermaid-source";
const MAX_TEXT_SIZE = 50_000;
const MAX_EDGES = 500;
const DIAGRAM_FONT_SIZE = 14;
const SECURE_CONFIG_KEYS = [
  "secure",
  "securityLevel",
  "startOnLoad",
  "maxTextSize",
  "maxEdges",
  "suppressErrorRendering",
  "htmlLabels",
  "themeCSS",
  "fontFamily",
  "altFontFamily",
  "legacyMathML",
  "forceLegacyMathML",
];

let rendererPromise: Promise<MermaidRenderer> | null = null;
let renderQueue: Promise<void> = Promise.resolve();
let nextDiagramId = 1;

type PreparedDiagram = {
  source: HTMLElement;
  replacement: HTMLElement | null;
};

export function renderMermaid(root: ParentNode): Promise<void> | null {
  const sources = Array.from(
    root.querySelectorAll<HTMLElement>(MERMAID_SELECTOR),
  );

  if (sources.length === 0) {
    return null;
  }

  return prepareDiagrams(sources).then((diagrams) => {
    for (const diagram of diagrams) {
      const pre = diagram.source.parentElement;
      if (!(pre instanceof HTMLPreElement)) {
        continue;
      }

      if (diagram.replacement) {
        pre.replaceWith(diagram.replacement);
      } else {
        pre.classList.add("mermaid-error");
        pre.title = "Diagram could not be rendered.";
      }
    }
  });
}

async function prepareDiagrams(sources: HTMLElement[]): Promise<PreparedDiagram[]> {
  let renderer: MermaidRenderer;

  try {
    renderer = await loadRenderer();
  } catch {
    return sources.map((source) => ({ source, replacement: null }));
  }

  return Promise.all(
    sources.map(async (source) => {
      const diagramId = `hushmark-mermaid-${nextDiagramId}`;
      nextDiagramId += 1;

      try {
        const result = await queueRender(
          renderer,
          diagramId,
          source.textContent ?? "",
        );
        return {
          source,
          replacement: await diagramFigure(result.svg),
        };
      } catch {
        return { source, replacement: null };
      }
    }),
  );
}

async function loadRenderer(): Promise<MermaidRenderer> {
  if (!rendererPromise) {
    rendererPromise = import("mermaid").then(({ default: mermaid }) => {
      const fontFamily = diagramFontFamily();

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        maxTextSize: MAX_TEXT_SIZE,
        maxEdges: MAX_EDGES,
        htmlLabels: false,
        theme: "base",
        handDrawnSeed: 1,
        fontSize: DIAGRAM_FONT_SIZE,
        themeVariables: {
          background: "#f8f7f3",
          primaryColor: "#e5e5f0",
          primaryTextColor: "#272832",
          primaryBorderColor: "#9698b0",
          lineColor: "#707380",
          secondaryColor: "#efeddb",
          tertiaryColor: "#e3ece7",
        },
        fontFamily,
        flowchart: {
          subGraphTitleMargin: {
            top: 4,
            bottom: 10,
          },
        },
        sequence: {
          actorFontSize: DIAGRAM_FONT_SIZE,
          actorFontFamily: fontFamily,
          noteFontSize: DIAGRAM_FONT_SIZE,
          noteFontFamily: fontFamily,
          messageFontSize: DIAGRAM_FONT_SIZE,
          messageFontFamily: fontFamily,
        },
        secure: SECURE_CONFIG_KEYS,
      });
      return mermaid;
    });
  }

  return rendererPromise;
}

function diagramFontFamily(): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--font-ui")
      .trim() || "system-ui, sans-serif"
  );
}

function queueRender(
  renderer: MermaidRenderer,
  id: string,
  source: string,
): Promise<Awaited<ReturnType<MermaidRenderer["render"]>>> {
  const render = renderQueue.then(() => renderer.render(id, source));
  renderQueue = render.then(
    () => undefined,
    () => undefined,
  );
  return render;
}

async function diagramFigure(svgMarkup: string): Promise<HTMLElement | null> {
  const parsed = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  if (parsed.querySelector("parsererror")) {
    return null;
  }

  const svg = parsed.documentElement;
  if (
    svg.localName !== "svg" ||
    svg.namespaceURI !== "http://www.w3.org/2000/svg"
  ) {
    return null;
  }

  const figure = document.createElement("figure");
  figure.className = "mermaid-diagram";

  const image = document.createElement("img");
  image.alt = diagramAlternativeText(svg);
  image.decoding = "async";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

  const dimensions = diagramDimensions(svg.getAttribute("viewBox"));
  if (dimensions) {
    image.width = dimensions.width;
    image.height = dimensions.height;
  }

  try {
    await image.decode();
  } catch {
    return null;
  }

  if (!dimensions && image.naturalWidth > 0 && image.naturalHeight > 0) {
    image.width = image.naturalWidth;
    image.height = image.naturalHeight;
  }

  figure.append(image);
  return figure;
}

function diagramAlternativeText(svg: Element): string {
  const title = svg.querySelector(":scope > title")?.textContent?.trim();
  const description = svg.querySelector(":scope > desc")?.textContent?.trim();

  if (title && description) {
    return `${title}. ${description}`;
  }
  return title || description || "Mermaid diagram";
}

function diagramDimensions(
  viewBox: string | null,
): { width: number; height: number } | null {
  if (!viewBox) {
    return null;
  }

  const values = viewBox.trim().split(/[ ,]+/).map(Number);
  if (
    values.length !== 4 ||
    !values.every(Number.isFinite) ||
    values[2] <= 0 ||
    values[3] <= 0
  ) {
    return null;
  }

  return {
    width: Math.ceil(values[2]),
    height: Math.ceil(values[3]),
  };
}
