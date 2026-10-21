const WHEEL_ZOOM_THRESHOLD = 50;
const WHEEL_LINE_HEIGHT = 16;

// Turns Ctrl+wheel movement into discrete zoom steps, so high-resolution
// touchpads do not zoom on every small delta.
export class WheelZoomGesture {
  private accumulated = 0;

  reset(): void {
    this.accumulated = 0;
  }

  // Returns 1 to zoom in, -1 to zoom out, or 0 while still accumulating.
  add(delta: number): 1 | -1 | 0 {
    if (Math.sign(delta) !== Math.sign(this.accumulated)) {
      this.accumulated = 0;
    }
    this.accumulated += delta;

    if (Math.abs(this.accumulated) < WHEEL_ZOOM_THRESHOLD) {
      return 0;
    }

    const direction = this.accumulated < 0 ? 1 : -1;
    this.accumulated = 0;
    return direction;
  }
}

export function normalizedWheelDelta(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * WHEEL_LINE_HEIGHT;
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * window.innerHeight;
  }
  return event.deltaY;
}
