import { describe, expect, it } from "vitest";
import {
  classifyDocumentLink,
  fragmentIdCandidates,
  isRelativeMarkdownHref,
} from "./links";

describe("classifyDocumentLink", () => {
  it("treats fragments as same-document links", () => {
    expect(classifyDocumentLink("#usage")).toEqual({
      kind: "internal",
      fragment: "#usage",
    });
  });

  it("opens web and email links externally", () => {
    expect(classifyDocumentLink(" https://example.com/page ")).toEqual({
      kind: "external",
      url: "https://example.com/page",
    });
    expect(classifyDocumentLink("HTTP://example.com")).toEqual({
      kind: "external",
      url: "HTTP://example.com",
    });
    expect(classifyDocumentLink("mailto:reader@example.com")).toEqual({
      kind: "external",
      url: "mailto:reader@example.com",
    });
  });

  it("opens relative Markdown links inside Hushmark", () => {
    expect(classifyDocumentLink("guide.md")).toEqual({
      kind: "document",
      href: "guide.md",
    });
    expect(classifyDocumentLink("nested/child.markdown#section")).toEqual({
      kind: "document",
      href: "nested/child.markdown#section",
    });
  });

  it.each([
    null,
    "",
    "   ",
    "https://",
    "https:///path",
    "mailto:",
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///etc/passwd.md",
    "notes.txt",
    "/absolute/notes.md",
  ])("does not support %j", (href) => {
    expect(classifyDocumentLink(href)).toEqual({ kind: "unsupported" });
  });
});

describe("isRelativeMarkdownHref", () => {
  it("accepts percent-encoded relative Markdown paths", () => {
    expect(isRelativeMarkdownHref("my%20notes.md")).toBe(true);
    expect(isRelativeMarkdownHref("../sibling/README.MD")).toBe(true);
  });

  it.each([
    "#only-fragment",
    "/root.md",
    "\\\\server\\share.md",
    "%2Froot.md",
    "%5Croot.md",
    "line%0Abreak.md",
    "bad%E0.md",
    "image.png",
  ])("rejects %j", (href) => {
    expect(isRelativeMarkdownHref(href)).toBe(false);
  });
});

describe("fragmentIdCandidates", () => {
  it("tries the decoded fragment before the raw fragment", () => {
    expect(fragmentIdCandidates("#caf%C3%A9")).toEqual(["café", "caf%C3%A9"]);
  });

  it("does not duplicate fragments that need no decoding", () => {
    expect(fragmentIdCandidates("#usage")).toEqual(["usage"]);
    expect(fragmentIdCandidates("usage")).toEqual(["usage"]);
  });

  it("keeps fragments that cannot be decoded", () => {
    expect(fragmentIdCandidates("#bad%E0")).toEqual(["bad%E0"]);
  });

  it("returns nothing for an empty fragment", () => {
    expect(fragmentIdCandidates("#")).toEqual([]);
  });
});
