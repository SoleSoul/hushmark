import type { LinkAction } from "./types";

export function classifyDocumentLink(href: string | null): LinkAction {
  const value = href?.trim();
  if (!value) {
    return { kind: "unsupported" };
  }

  if (value.startsWith("#")) {
    return { kind: "internal", fragment: value };
  }

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  const scheme = schemeMatch?.[1]?.toLowerCase();

  if (
    (scheme === "http" || scheme === "https") &&
    /^https?:\/\/[^/?#].+/i.test(value)
  ) {
    return { kind: "external", url: value };
  }

  if (scheme === "mailto" && value.length > "mailto:".length) {
    return { kind: "external", url: value };
  }

  if (!scheme && isRelativeMarkdownHref(value)) {
    return { kind: "document", href: value };
  }

  return { kind: "unsupported" };
}

export function isRelativeMarkdownHref(href: string): boolean {
  const [pathPart] = href.split("#", 1);
  if (!pathPart || pathPart.startsWith("/") || pathPart.startsWith("\\")) {
    return false;
  }

  try {
    const decodedPath = decodeURIComponent(pathPart);
    return (
      decodedPath.length > 0 &&
      !decodedPath.startsWith("/") &&
      !decodedPath.startsWith("\\") &&
      !/[\u0000-\u001f\u007f]/.test(decodedPath) &&
      /\.(md|markdown)$/i.test(decodedPath)
    );
  } catch {
    return false;
  }
}

export function fragmentIdCandidates(fragment: string): string[] {
  const cleanFragment = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const candidates = [cleanFragment];

  try {
    const decoded = decodeURIComponent(cleanFragment);
    if (!candidates.includes(decoded)) {
      candidates.unshift(decoded);
    }
  } catch {
    // Use the original fragment when percent-decoding fails.
  }

  return candidates.filter((candidate) => candidate.length > 0);
}

export function findFragmentTarget(fragment: string): HTMLElement | null {
  for (const id of fragmentIdCandidates(fragment)) {
    const target = document.getElementById(id);
    if (target) {
      return target;
    }
  }

  return null;
}
