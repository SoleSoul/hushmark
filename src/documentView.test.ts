import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCUMENT_VIEW,
  MAX_DOCUMENT_ZOOM,
  MIN_DOCUMENT_ZOOM,
  resetDocumentZoom,
  toggledDocumentLayout,
  zoomedDocumentView,
} from "./documentView";

describe("document view preferences", () => {
  it("zooms within the supported range", () => {
    expect(zoomedDocumentView(DEFAULT_DOCUMENT_VIEW, 10).zoom).toBe(110);
    expect(
      zoomedDocumentView({ layout: "page", zoom: MAX_DOCUMENT_ZOOM - 5 }, 10).zoom,
    ).toBe(MAX_DOCUMENT_ZOOM);
    expect(
      zoomedDocumentView({ layout: "page", zoom: MIN_DOCUMENT_ZOOM + 5 }, -10).zoom,
    ).toBe(MIN_DOCUMENT_ZOOM);
  });

  it("returns the same preferences when zoom cannot change", () => {
    const atMaximum = { layout: "page" as const, zoom: MAX_DOCUMENT_ZOOM };

    expect(zoomedDocumentView(atMaximum, 10)).toBe(atMaximum);
    expect(resetDocumentZoom(DEFAULT_DOCUMENT_VIEW)).toBe(DEFAULT_DOCUMENT_VIEW);
  });

  it("resets zoom without changing the layout", () => {
    expect(resetDocumentZoom({ layout: "full-width", zoom: 150 })).toEqual({
      layout: "full-width",
      zoom: DEFAULT_DOCUMENT_VIEW.zoom,
    });
  });

  it("toggles between Page and Full Width", () => {
    const fullWidth = toggledDocumentLayout(DEFAULT_DOCUMENT_VIEW);

    expect(fullWidth).toEqual({ layout: "full-width", zoom: 100 });
    expect(toggledDocumentLayout(fullWidth).layout).toBe("page");
  });
});
