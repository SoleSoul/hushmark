import { describe, expect, it } from "vitest";
import { WheelZoomGesture } from "./wheelZoom";

describe("WheelZoomGesture", () => {
  it("zooms in once enough upward movement accumulates", () => {
    const gesture = new WheelZoomGesture();

    expect(gesture.add(-30)).toBe(0);
    expect(gesture.add(-30)).toBe(1);
    expect(gesture.add(-30)).toBe(0);
  });

  it("zooms out on downward movement", () => {
    const gesture = new WheelZoomGesture();

    expect(gesture.add(120)).toBe(-1);
  });

  it("restarts accumulation when the direction changes", () => {
    const gesture = new WheelZoomGesture();

    expect(gesture.add(-40)).toBe(0);
    expect(gesture.add(40)).toBe(0);
    expect(gesture.add(-40)).toBe(0);
  });

  it("forgets partial movement after a reset", () => {
    const gesture = new WheelZoomGesture();

    expect(gesture.add(-40)).toBe(0);
    gesture.reset();
    expect(gesture.add(-40)).toBe(0);
  });
});
