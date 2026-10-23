import { expect, test, type Page } from "@playwright/test";

type Platform = "linux" | "windows" | "macos";

type OpenOptions = {
  doc?: string;
  platform?: Platform;
  pendingOpenDocuments?: string[];
};

async function open(page: Page, { doc, platform = "linux", pendingOpenDocuments }: OpenOptions = {}) {
  await page.addInitScript((pending) => {
    (window as unknown as { __initialPendingOpenDocuments?: string[] }).__initialPendingOpenDocuments =
      pending;
    (window as unknown as { __printCount: number }).__printCount = 0;
    window.print = () => {
      (window as unknown as { __printCount: number }).__printCount += 1;
    };
  }, pendingOpenDocuments ?? []);

  const query = new URLSearchParams({ platform });
  if (doc) {
    query.set("doc", doc);
  }
  await page.goto(`/e2e/harness.html?${query}`);
  await expect(page.locator("#app > .document, #app > .home")).toBeVisible();
}

const article = (page: Page) => page.locator("#app > .document");
const home = (page: Page) => page.locator("#app > .home");

function topOf(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((element) => Math.round(element.getBoundingClientRect().top));
}

function zoomFactor(page: Page): Promise<string> {
  return page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--document-zoom-factor"),
  );
}

function layout(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.documentLayout);
}

function commands(page: Page, name: string): Promise<unknown[]> {
  return page.evaluate(
    (command) => (window as unknown as { __hushmark: { commands(name: string): unknown[] } }).__hushmark.commands(command),
    name,
  );
}

function emit(page: Page, event: string, payload: unknown): Promise<void> {
  return page.evaluate(
    ([name, value]) =>
      (window as unknown as { __hushmark: { emit(name: string, payload: unknown): void } }).__hushmark.emit(
        name as string,
        value,
      ),
    [event, payload] as const,
  );
}

/** Whether the element is at the top of the viewport, or as close as the page can scroll. */
function isScrolledTo(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().evaluate((element) => {
    const top = element.getBoundingClientRect().top;
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
    return Math.abs(top) < 2 || (atBottom && top > 0);
  });
}

/** Scrolls so the element sits at a fixed offset from the top of the viewport. */
async function scrollElementTo(page: Page, selector: string, offset: number): Promise<void> {
  await page.locator(selector).first().evaluate((element, top) => {
    window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - top);
  }, offset);
  await expect.poll(() => topOf(page, selector)).toBe(offset);
}

test.describe("reader", () => {
  test("renders a document and names the window after it", async ({ page }) => {
    await open(page, { doc: "linked-doc.md" });

    await expect(article(page).locator("h1")).toHaveText("Linked Markdown document");
    await expect(page).toHaveTitle("linked-doc.md - Hushmark");
  });

  test("opens Home when started without a document", async ({ page }) => {
    await open(page);

    await expect(home(page)).toBeVisible();
    await expect(page).toHaveTitle("Hushmark");
  });

  test("follows linked documents and moves through Back and Forward", async ({ page }) => {
    await open(page, { doc: "linked-doc.md" });

    await page.getByRole("link", { name: "Open child document" }).click();
    await expect(page).toHaveTitle("child-doc.md - Hushmark");

    await page.getByRole("link", { name: "Go back to the linked document heading" }).click();
    await expect(page).toHaveTitle("linked-doc.md - Hushmark");
    await expect.poll(() => isScrolledTo(page, "#linked-fragment-target")).toBe(true);

    await page.keyboard.press("Alt+ArrowLeft");
    await expect(page).toHaveTitle("child-doc.md - Hushmark");
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(page).toHaveTitle("linked-doc.md - Hushmark");

    // Back at the first entry stays put instead of leaving the reader.
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(page).toHaveTitle("linked-doc.md - Hushmark");
    await expect(article(page).locator("h1")).toHaveText("Linked Markdown document");

    await page.keyboard.press("Alt+ArrowRight");
    await expect(page).toHaveTitle("child-doc.md - Hushmark");
  });

  test("jumps to same-document headings and returns with Back", async ({ page }) => {
    await open(page, { doc: "markdown-features.md" });
    await scrollElementTo(page, 'a[href="#tables"]', 200);
    const scrollBefore = await page.evaluate(() => Math.round(window.scrollY));

    await page.getByRole("link", { name: "Jump to table alignment" }).click();
    await expect.poll(() => isScrolledTo(page, "#tables")).toBe(true);

    await page.keyboard.press("Alt+ArrowLeft");
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(scrollBefore);
  });

  test("shows a quiet message for a missing linked document", async ({ page }) => {
    await open(page, { doc: "linked-doc.md" });
    await page.locator(".document__content").evaluate((content) => {
      const link = document.createElement("a");
      link.href = "missing.md";
      link.textContent = "Missing document";
      content.append(link);
    });

    await page.getByRole("link", { name: "Missing document" }).click();

    await expect(page.locator(".document-message h2")).toHaveText("This linked file could not be opened.");
    await expect(page).toHaveTitle("linked-doc.md - Hushmark");
  });

  test("Home keeps the reading position for Back", async ({ page }) => {
    await open(page, { doc: "math-visual-inspection.md" });
    await scrollElementTo(page, "#display-mathematics", 120);

    await page.keyboard.press("Control+h");
    await expect(home(page)).toBeVisible();
    await expect(home(page).locator(".home__shortcut")).not.toHaveCount(0);

    await page.keyboard.press("Alt+ArrowLeft");
    await expect(article(page)).toBeVisible();
    await expect.poll(() => topOf(page, "#display-mathematics")).toBe(120);
  });

  test("zoom and layout commands keep the reading position", async ({ page }) => {
    await open(page, { doc: "math-visual-inspection.md" });
    await scrollElementTo(page, "#display-mathematics", 120);

    await page.keyboard.press("Control+=");
    await page.keyboard.press("Control+=");
    await expect.poll(() => zoomFactor(page)).toBe("1.2");

    await page.keyboard.press("Control+l");
    await expect.poll(() => layout(page)).toBe("full-width");

    await page.keyboard.press("Control+-");
    await expect.poll(() => zoomFactor(page)).toBe("1.1");

    await page.keyboard.press("Control+0");
    await expect.poll(() => zoomFactor(page)).toBe("1");
    await expect.poll(() => layout(page)).toBe("full-width");

    await page.keyboard.press("Control+l");
    await expect.poll(() => layout(page)).toBe("page");
    await expect.poll(() => topOf(page, "#display-mathematics")).toBe(120);
  });

  test("Control and the mouse wheel zoom in steps", async ({ page }) => {
    await open(page, { doc: "math-visual-inspection.md" });
    await page.mouse.move(450, 350);

    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Control");
    await expect.poll(() => zoomFactor(page)).toBe("1.1");

    await page.keyboard.down("Control");
    await page.mouse.wheel(0, 120);
    await page.keyboard.up("Control");
    await expect.poll(() => zoomFactor(page)).toBe("1");
  });

  test("zoom, layout, and print do nothing on Home", async ({ page }) => {
    await open(page);

    await page.keyboard.press("Control+=");
    await page.keyboard.press("Control+l");
    await page.keyboard.press("Control+p");

    expect(await zoomFactor(page)).toBe("1");
    expect(await layout(page)).toBe("page");
    expect(await page.evaluate(() => (window as unknown as { __printCount: number }).__printCount)).toBe(0);
  });

  test("prints an open document", async ({ page }) => {
    await open(page, { doc: "print-visual-inspection.md" });

    await page.keyboard.press("Control+p");

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __printCount: number }).__printCount))
      .toBe(1);
  });

  test("opens a chosen document from the file picker", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      (window as unknown as { __hushmark: { dialogResult: string } }).__hushmark.dialogResult =
        "/examples/linked-doc.md";
    });

    await page.keyboard.press("Control+o");

    await expect(page).toHaveTitle("linked-doc.md - Hushmark");
    expect(await commands(page, "plugin:dialog|open")).toHaveLength(1);
  });

  test("opens a dropped document", async ({ page }) => {
    await open(page);

    await emit(page, "tauri://drag-drop", {
      paths: ["/examples/linked-doc.md"],
      position: { x: 10, y: 10 },
    });

    await expect(page).toHaveTitle("linked-doc.md - Hushmark");
  });

  test("hands web and email links to the system and ignores unsupported links", async ({ page }) => {
    await open(page, { doc: "markdown-features.md" });

    await page.locator('a[href="https://example.com"]').click();
    await page.locator('a[href="mailto:reader@example.com"]').click();
    await page.locator('a[href^="ftp:"]').click();

    await expect
      .poll(() => commands(page, "open_external_link"))
      .toEqual([{ url: "https://example.com" }, { url: "mailto:reader@example.com" }]);
    await expect(page).toHaveTitle("markdown-features.md - Hushmark");
  });

  test("disables the WebView context menu", async ({ page }) => {
    await open(page, { doc: "linked-doc.md" });

    const prevented = await page.locator(".document p").first().evaluate((paragraph) => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      paragraph.dispatchEvent(event);
      return event.defaultPrevented;
    });

    expect(prevented).toBe(true);
  });
});

test.describe("rendering", () => {
  test("typesets mathematics and keeps invalid formulas readable", async ({ page }) => {
    await open(page, { doc: "math-visual-inspection.md" });

    await expect(article(page).locator(".katex")).not.toHaveCount(0);
    await expect(article(page)).toContainText("\\hushmarkUnsupported");
    await expect(article(page)).toContainText("$x + y");
  });

  test("draws Mermaid diagrams as images and keeps invalid diagrams as code", async ({ page }) => {
    await open(page, { doc: "mermaid-visual-inspection.md" });

    const diagrams = article(page).locator('img[src^="data:image/svg+xml"]');
    await expect(diagrams).toHaveCount(5);
    for (const diagram of await diagrams.all()) {
      expect(await diagram.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    }
    await expect(article(page).locator("pre code").filter({ hasText: "Start -->" })).toHaveCount(1);
  });

  test("embeds and decodes local images", async ({ page }) => {
    await open(page, { doc: "markdown-visual-inspection.md" });

    const localImages = article(page).locator('img[src^="data:image/"]');
    expect(await localImages.count()).toBeGreaterThan(3);
    for (const image of await localImages.all()) {
      expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }
  });
});

test.describe("macOS frontend", () => {
  test("Command shortcuts navigate, zoom, and switch layout", async ({ page }) => {
    await open(page, { doc: "linked-doc.md", platform: "macos" });
    await expect(page).toHaveTitle("linked-doc.md");

    await page.getByRole("link", { name: "Open child document" }).click();
    await expect(page).toHaveTitle("child-doc.md");
    await page.keyboard.press("Meta+[");
    await expect(page).toHaveTitle("linked-doc.md");
    await page.keyboard.press("Meta+]");
    await expect(page).toHaveTitle("child-doc.md");

    await page.keyboard.press("Meta+=");
    await expect.poll(() => zoomFactor(page)).toBe("1.1");
    await page.keyboard.press("Meta+l");
    await expect.poll(() => layout(page)).toBe("full-width");

    await page.keyboard.press("Shift+Meta+h");
    await expect(home(page)).toBeVisible();
  });

  test("native menu commands drive the reader and receive its state", async ({ page }) => {
    await open(page, { doc: "linked-doc.md", platform: "macos" });

    await emit(page, "hushmark://macos-menu", "macos-zoom-in");
    await expect.poll(() => zoomFactor(page)).toBe("1.1");
    await emit(page, "hushmark://macos-menu", "macos-full-width");
    await expect.poll(() => layout(page)).toBe("full-width");
    await emit(page, "hushmark://macos-menu", "macos-actual-size");
    await expect.poll(() => zoomFactor(page)).toBe("1");

    await page.getByRole("link", { name: "Open child document" }).click();
    await expect(page).toHaveTitle("child-doc.md");
    await expect
      .poll(async () => (await commands(page, "update_macos_menu_state")).at(-1))
      .toMatchObject({ state: { canGoBack: true, canGoForward: false, hasDocument: true, layout: "full-width" } });

    await emit(page, "hushmark://macos-menu", "macos-back");
    await expect(page).toHaveTitle("linked-doc.md");
    await emit(page, "hushmark://macos-menu", "macos-help");
    await expect(home(page)).toBeVisible();
  });

  test("opens Finder documents at launch and while running", async ({ page }) => {
    await open(page, { platform: "macos", pendingOpenDocuments: ["/examples/linked-doc.md"] });
    await expect(page).toHaveTitle("linked-doc.md");

    await emit(page, "hushmark://macos-open-document", "/examples/nested/child-doc.md");
    await expect(page).toHaveTitle("child-doc.md");
  });

  test("prints through the native print command", async ({ page }) => {
    await open(page, { doc: "print-visual-inspection.md", platform: "macos" });

    await page.keyboard.press("Meta+p");

    await expect.poll(() => commands(page, "print_macos_document")).toHaveLength(1);
    expect(await page.evaluate(() => (window as unknown as { __printCount: number }).__printCount)).toBe(0);
  });
});
