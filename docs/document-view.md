# Hushmark Document View

Hushmark has two process-wide document presentation values: `layout` and `zoom`. They apply to every open document for the current launch and are independent of navigation entries.

Page is the default layout. At 100%, it keeps the established 712px text measure, equivalent to the previous 760px page width after its two 24px side insets. Zoom scales that logical page measure and all of its contents together, including text, images, and document spacing. The viewport constrains the scaled page when it cannot fit.

Full Width uses the available window width with a stable reading inset and no artificial measure cap. Its contents receive the same uniform scale as Page but may reflow into a different logical width. At Hushmark's default 900px window width and 100% zoom, Page and Full Width have identical text edges. In a wider window or at a lower zoom, Page may accumulate more surrounding whitespace while Full Width retains its reading inset. When a scaled Page cannot fit, both layouts reduce their side margins by the same amount, down to 24px.

Zoom ranges from 50% to 200% in 10 percentage-point steps. On Windows and Linux, use Ctrl++ or Ctrl+= to zoom in, Ctrl+- to zoom out, Ctrl+0 to reset, Ctrl+MouseWheel to zoom, and Ctrl+L to toggle Page and Full Width. On macOS, use the corresponding Command shortcuts, including Command-L for the layout toggle; Page and Full Width are also direct native View-menu choices. These commands are intercepted outside documents so the WebView does not accidentally zoom Home or Windows Setup.

## Reading Position

Each document navigation entry stores a semantic rendered position rather than an absolute pixel offset. Hushmark captures a stable structural element near the reading line, the fractional position within that element, and the reading line's viewport fraction. A document-height progress ratio is retained as a fallback. The same bookmark is restored after zoom, layout changes, and Back/Forward re-rendering.

This deliberately uses the sanitized rendered DOM rather than parser or source offsets. Navigation entries already retain their rendered document snapshot, so structural order and generated heading IDs are stable for the lifetime of an entry.

## Launch Default And Print

Layout and zoom are intentionally volatile. Every Hushmark launch starts in Page at 100% so documents return to the paper-like default; the current values remain shared across documents only while that process is running.

Print uses its existing dedicated stylesheet. It ignores screen layout and screen zoom, removes the screen width constraint, and restores stable print font sizes.
