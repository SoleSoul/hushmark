import { describe, expect, it } from "vitest";
import { documentWindowTitle } from "./windowTitle";
import type { LoadedDocument } from "./types";

function loadedDocument(overrides: Partial<LoadedDocument>): LoadedDocument {
  return {
    path: "/docs/notes.md",
    navigationRoot: "/docs",
    fileName: "notes.md",
    html: "<p></p>",
    error: null,
    ...overrides,
  };
}

describe("documentWindowTitle", () => {
  it("names the document and product on Windows and Linux", () => {
    expect(documentWindowTitle(loadedDocument({}), "windows")).toBe(
      "notes.md - Hushmark",
    );
    expect(
      documentWindowTitle(loadedDocument({ error: "missing" }), "linux"),
    ).toBe("Error: notes.md - Hushmark");
    expect(
      documentWindowTitle(
        loadedDocument({ fileName: null, error: "missing" }),
        "linux",
      ),
    ).toBe("Error - Hushmark");
  });

  it("uses document-only titles on macOS", () => {
    expect(documentWindowTitle(loadedDocument({}), "macos")).toBe("notes.md");
    expect(
      documentWindowTitle(loadedDocument({ error: "missing" }), "macos"),
    ).toBe("Error: notes.md");
    expect(
      documentWindowTitle(
        loadedDocument({ fileName: null, error: "missing" }),
        "macos",
      ),
    ).toBe("Error");
  });

  it("falls back to the product name without a file name", () => {
    expect(
      documentWindowTitle(loadedDocument({ fileName: null }), "windows"),
    ).toBe("Hushmark");
    expect(documentWindowTitle(loadedDocument({ fileName: null }), "macos")).toBe(
      "Hushmark",
    );
  });
});
