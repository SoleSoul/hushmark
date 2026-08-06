import katex from "katex";
import "katex/dist/katex.min.css";

const MATH_SELECTOR = ".math-inline, .math-display";

export function renderMath(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>(MATH_SELECTOR)) {
    const source = element.textContent ?? "";
    const displayMode = element.classList.contains("math-display");

    try {
      katex.render(source, element, {
        displayMode,
        maxExpand: 1000,
        maxSize: 20,
        output: "htmlAndMathml",
        strict: "ignore",
        throwOnError: true,
        trust: false,
      });
    } catch {
      const delimiter = displayMode ? "$$" : "$";
      element.textContent = `${delimiter}${source}${delimiter}`;
      element.classList.add("math-error");
      element.title = "Formula could not be rendered.";
    }
  }
}
