import { describe, expect, it } from "vitest";
import { OFF_TARGET, pickTarget, radialPositions } from "@/lib/radial";

describe("radialPositions", () => {
  it("places every target above the button (negative y in screen coords)", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      for (const p of radialPositions(n)) {
        expect(p.y).toBeLessThan(0);
      }
    }
  });

  it("returns no positions for zero favourites", () => {
    expect(radialPositions(0)).toEqual([]);
  });

  it("spreads targets far enough apart to hit distinctly", () => {
    const positions = radialPositions(5);
    for (let i = 1; i < positions.length; i++) {
      const gap = Math.hypot(
        positions[i].x - positions[i - 1].x,
        positions[i].y - positions[i - 1].y,
      );
      expect(gap).toBeGreaterThan(50);
    }
  });
});

describe("pickTarget (drag selection)", () => {
  const targets = radialPositions(3);

  it("picks the target the pointer lands on", () => {
    targets.forEach((t, i) => {
      expect(pickTarget({ x: t.x + 5, y: t.y - 5 }, targets)).toBe(i);
    });
  });

  it("release near the origin (no drag) selects nothing → cancel", () => {
    expect(pickTarget({ x: 0, y: 0 }, targets)).toBeNull();
  });

  it("release far outside every target selects nothing → cancel", () => {
    expect(pickTarget({ x: 400, y: 400 }, targets)).toBeNull();
  });

  it("the OFF target (below) never collides with preset targets (above)", () => {
    const all = [...targets, OFF_TARGET];
    expect(pickTarget({ x: OFF_TARGET.x, y: OFF_TARGET.y }, all)).toBe(all.length - 1);
    expect(pickTarget({ x: targets[1].x, y: targets[1].y }, all)).toBe(1);
  });
});
