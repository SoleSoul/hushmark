import type { DocumentReadingPosition } from "./types";

export type DocumentLayout = "page" | "full-width";

export type DocumentViewPreferences = {
  layout: DocumentLayout;
  zoom: number;
};

export const DEFAULT_DOCUMENT_VIEW: DocumentViewPreferences = {
  layout: "page",
  zoom: 100,
};

export const DOCUMENT_ZOOM_STEP = 10;
export const MIN_DOCUMENT_ZOOM = 50;
export const MAX_DOCUMENT_ZOOM = 200;

const READING_ANCHOR_SELECTOR =
  "h1, h2, h3, h4, h5, h6, p, li, pre, table, blockquote, dl, hr, img, details, summary, div";
const REFERENCE_VIEWPORT_FRACTION = 0.3;
const SCROLL_START_TOLERANCE = 1;

const SCALED_LENGTH_PROPERTIES = [
  ["--document-body-font-size-base", "--document-body-font-size"],
  ["--document-front-matter-font-size-base", "--document-front-matter-font-size"],
  [
    "--document-front-matter-term-font-size-base",
    "--document-front-matter-term-font-size",
  ],
  ["--document-message-font-size-base", "--document-message-font-size"],
  [
    "--document-message-heading-font-size-base",
    "--document-message-heading-font-size",
  ],
  ["--document-heading-1-font-size-base", "--document-heading-1-font-size"],
  ["--document-heading-2-font-size-base", "--document-heading-2-font-size"],
  ["--document-heading-3-font-size-base", "--document-heading-3-font-size"],
  ["--document-heading-4-font-size-base", "--document-heading-4-font-size"],
  ["--document-heading-5-font-size-base", "--document-heading-5-font-size"],
  ["--document-heading-6-font-size-base", "--document-heading-6-font-size"],
  ["--document-pre-font-size-base", "--document-pre-font-size"],
] as const;

export function zoomedDocumentView(
  preferences: DocumentViewPreferences,
  delta: number,
): DocumentViewPreferences {
  const zoom = Math.min(
    MAX_DOCUMENT_ZOOM,
    Math.max(MIN_DOCUMENT_ZOOM, preferences.zoom + delta),
  );
  return zoom === preferences.zoom ? preferences : { ...preferences, zoom };
}

export function resetDocumentZoom(
  preferences: DocumentViewPreferences,
): DocumentViewPreferences {
  return preferences.zoom === DEFAULT_DOCUMENT_VIEW.zoom
    ? preferences
    : { ...preferences, zoom: DEFAULT_DOCUMENT_VIEW.zoom };
}

export function toggledDocumentLayout(
  preferences: DocumentViewPreferences,
): DocumentViewPreferences {
  return {
    ...preferences,
    layout: preferences.layout === "page" ? "full-width" : "page",
  };
}

export function applyDocumentViewPreferences(
  root: HTMLElement,
  preferences: DocumentViewPreferences,
): void {
  const computedStyle = getComputedStyle(root);
  const zoomFactor = preferences.zoom / 100;

  root.dataset.documentLayout = preferences.layout;
  root.style.setProperty(
    "--document-page-width",
    `${cssPixels(computedStyle, "--document-page-width-base") * zoomFactor}px`,
  );

  for (const [baseProperty, scaledProperty] of SCALED_LENGTH_PROPERTIES) {
    const basePixels = cssPixels(computedStyle, baseProperty);
    root.style.setProperty(scaledProperty, `${basePixels * zoomFactor}px`);
  }
}

function cssPixels(
  computedStyle: CSSStyleDeclaration,
  property: string,
): number {
  const parsed = Number.parseFloat(computedStyle.getPropertyValue(property));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Missing numeric CSS property: ${property}`);
  }
  return parsed;
}

export function captureDocumentReadingPosition(
  article: HTMLElement,
): DocumentReadingPosition {
  const maxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  const scrollProgress =
    maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;

  if (window.scrollY <= SCROLL_START_TOLERANCE) {
    return {
      anchorId: null,
      anchorIndex: -1,
      anchorFraction: 0,
      viewportFraction: 0,
      scrollProgress,
      atStart: true,
    };
  }

  const anchors = readingAnchors(article);
  const viewportFraction = REFERENCE_VIEWPORT_FRACTION;
  const referenceY = window.innerHeight * viewportFraction;
  const anchor = anchorAtReferencePoint(anchors, referenceY);

  if (!anchor) {
    return {
      anchorId: null,
      anchorIndex: -1,
      anchorFraction: 0,
      viewportFraction,
      scrollProgress,
      atStart: false,
    };
  }

  const rect = anchor.getBoundingClientRect();
  const anchorFraction = Math.min(
    1,
    Math.max(0, (referenceY - rect.top) / Math.max(rect.height, 1)),
  );

  return {
    anchorId: anchor.id || null,
    anchorIndex: anchors.indexOf(anchor),
    anchorFraction,
    viewportFraction,
    scrollProgress,
    atStart: false,
  };
}

export function restoreDocumentReadingPosition(
  article: HTMLElement,
  position: DocumentReadingPosition,
): void {
  if (position.atStart) {
    window.scrollTo(0, 0);
    return;
  }

  const anchors = readingAnchors(article);
  let anchor: HTMLElement | null = null;

  if (position.anchorId) {
    const identified = anchors.filter(
      (candidate) => candidate.id === position.anchorId,
    );
    if (identified.length === 1) {
      [anchor] = identified;
    }
  }

  if (!anchor && position.anchorIndex >= 0) {
    anchor = anchors[position.anchorIndex] ?? null;
  }

  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    const anchorY =
      window.scrollY + rect.top + rect.height * position.anchorFraction;
    const referenceY = window.innerHeight * position.viewportFraction;
    window.scrollTo(0, Math.max(0, anchorY - referenceY));
    return;
  }

  const maxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  window.scrollTo(0, maxScroll * position.scrollProgress);
}

function readingAnchors(article: HTMLElement): HTMLElement[] {
  return Array.from(
    article.querySelectorAll<HTMLElement>(READING_ANCHOR_SELECTOR),
  ).filter((element) => !element.closest(".document-message"));
}

function anchorAtReferencePoint(
  anchors: HTMLElement[],
  referenceY: number,
): HTMLElement | null {
  const anchorSet = new Set(anchors);
  const referenceX = document.documentElement.clientWidth / 2;

  for (const element of document.elementsFromPoint(referenceX, referenceY)) {
    const candidate = element.closest<HTMLElement>(READING_ANCHOR_SELECTOR);
    if (candidate && anchorSet.has(candidate)) {
      return candidate;
    }
  }

  let nearest: HTMLElement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of anchors) {
    const rect = candidate.getBoundingClientRect();
    if (rect.height <= 0) {
      continue;
    }
    const distance =
      referenceY < rect.top
        ? rect.top - referenceY
        : referenceY > rect.bottom
          ? referenceY - rect.bottom
          : 0;

    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}
