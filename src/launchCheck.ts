import { invoke } from "@tauri-apps/api/core";

const DISPLAY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;

// Used by CI through HUSHMARK_LAUNCH_CHECK: waits until the first view is on
// screen, reports what rendered, and asks the app to exit with the result.
export async function reportLaunchCheck(app: HTMLElement): Promise<void> {
  const deadline = Date.now() + DISPLAY_TIMEOUT_MS;
  while (!app.querySelector(":scope > .document, :scope > .state--error") && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const article = app.querySelector(":scope > .document");
  const report = article
    ? [
        document.title,
        `${article.querySelectorAll("h1, h2, h3").length} headings`,
        `${article.querySelectorAll('img[src^="data:image/svg+xml"]').length} diagrams`,
        `${article.querySelectorAll(".katex").length} formulas`,
      ].join("; ")
    : app.innerText.trim().replace(/\s+/g, " ") || "no document was displayed";

  await invoke("finish_launch_check", { passed: article !== null, report });
}
