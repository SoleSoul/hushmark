import { PRODUCT } from "./product";
import type { LoadedDocument } from "./types";

export const ERROR_WINDOW_TITLE = `Error - ${PRODUCT.displayName}`;

export function documentWindowTitle(
  documentView: LoadedDocument,
  platform: string,
): string {
  if (platform === "macos") {
    if (documentView.error) {
      return documentView.fileName ? `Error: ${documentView.fileName}` : "Error";
    }

    return documentView.fileName ?? PRODUCT.displayName;
  }

  if (documentView.error) {
    return documentView.fileName
      ? `Error: ${documentView.fileName} - ${PRODUCT.displayName}`
      : ERROR_WINDOW_TITLE;
  }

  return documentView.fileName
    ? `${documentView.fileName} - ${PRODUCT.displayName}`
    : PRODUCT.displayName;
}
