import { restoreDocumentReadingPosition } from "./documentView";
import { findFragmentTarget } from "./links";
import { renderMath } from "./math";
import { renderMermaid } from "./mermaid";
import type { DocumentReadingPosition } from "./types";

export type DocumentPositionRequest = {
  fragment?: string | null;
  readingPosition?: DocumentReadingPosition | null;
  scrollY?: number | null;
};

export type PreparedDocument = {
  article: HTMLElement;
  // Settles once diagrams and images are ready, or null when nothing is pending.
  ready: Promise<void> | null;
};

// Builds the off-screen article for already sanitized HTML and starts the
// asynchronous preparation that must finish before it is displayed.
export function prepareDocumentArticle(safeHtml: string): PreparedDocument {
  const article = document.createElement("article");
  article.className = "document";
  const content = document.createElement("div");
  content.className = "document__content";

  // The HTML is rendered and sanitized by Rust before it reaches the UI.
  content.innerHTML = safeHtml;
  renderMath(content);
  article.append(content);

  const preparations = [renderMermaid(content), decodeImages(content)].filter(
    (preparation): preparation is Promise<void> => preparation !== null,
  );

  return {
    article,
    ready:
      preparations.length === 0
        ? null
        : Promise.all(preparations).then(() => undefined),
  };
}

export function restoreRequestedDocumentPosition(
  article: HTMLElement,
  request: DocumentPositionRequest,
): void {
  if (request.readingPosition) {
    restoreReadingPositionAfterRender(article, request.readingPosition);
  } else if (request.fragment) {
    scrollToFragmentAfterRender(article, request.fragment);
  } else if (request.scrollY !== undefined && request.scrollY !== null) {
    restoreScrollAfterRender(request.scrollY, article);
  }
}

export function restoreScrollAfterRender(
  scrollY: number,
  renderedView?: HTMLElement,
): void {
  window.requestAnimationFrame(() => {
    if (!renderedView || renderedView.isConnected) {
      window.scrollTo(0, scrollY);
    }
  });
}

function decodeImages(root: ParentNode): Promise<void> | null {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  if (images.length === 0) {
    return null;
  }

  return Promise.allSettled(images.map((image) => image.decode())).then(
    () => undefined,
  );
}

function scrollToFragmentAfterRender(
  article: HTMLElement,
  fragment: string,
): void {
  window.requestAnimationFrame(() => {
    if (!article.isConnected) {
      return;
    }
    const target = findFragmentTarget(fragment);
    if (target) {
      target.scrollIntoView();
    }
  });
}

function restoreReadingPositionAfterRender(
  article: HTMLElement,
  position: DocumentReadingPosition,
): void {
  window.requestAnimationFrame(() => {
    if (article.isConnected) {
      restoreDocumentReadingPosition(article, position);
    }
  });
}
