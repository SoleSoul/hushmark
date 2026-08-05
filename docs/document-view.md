# Hushmark Document View

Hushmark has two process-wide document presentation values: `layout` and `zoom`. They apply to every open document for the current launch and are independent of navigation entries.

Page is the default layout. Its 100% preferred width remains 760px. Zoom scales the existing document font sizes and preferred page width together; the viewport constrains the page when necessary. Full Width uses the available window width with a responsive side inset and no artificial width cap. Zoom changes text size in Full Width without shrinking the available content width.

Zoom ranges from 50% to 200% in 10 percentage-point steps. Use Ctrl++ or Ctrl+= to zoom in, Ctrl+- to zoom out, Ctrl+0 to reset, Ctrl+MouseWheel to zoom, and Ctrl+L to toggle Page and Full Width. These commands are intercepted outside documents so the WebView does not accidentally zoom Home or Windows Setup.

## Reading Position

Each document navigation entry stores a semantic rendered position rather than an absolute pixel offset. Hushmark captures a stable structural element near the reading line, the fractional position within that element, and the reading line's viewport fraction. A document-height progress ratio is retained as a fallback. The same bookmark is restored after zoom, layout changes, and Back/Forward re-rendering.

This deliberately uses the sanitized rendered DOM rather than parser or source offsets. Navigation entries already retain their rendered document snapshot, so structural order and generated heading IDs are stable for the lifetime of an entry.

## Launch Default And Print

Layout and zoom are intentionally volatile. Every Hushmark launch starts in Page at 100% so documents return to the paper-like default; the current values remain shared across documents only while that process is running.

Print uses its existing dedicated stylesheet. It ignores screen layout and screen zoom, removes the screen width constraint, and restores stable print font sizes.
