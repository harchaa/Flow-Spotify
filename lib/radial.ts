/**
 * Geometry for the hold-and-drag radial menu (pure functions, unit-tested).
 * Screen coordinates: +y is down, so negative y offsets sit ABOVE the button.
 */
export type Point = { x: number; y: number };

/** Positions for `count` preset targets, fanned in an arc above the button. */
export function radialPositions(count: number, radius = 110): Point[] {
  if (count <= 0) return [];
  // Spread across the upper arc (200°–340°), even margins on both ends.
  const start = 200;
  const span = 140;
  return Array.from({ length: count }, (_, i) => {
    const deg = count === 1 ? 270 : start + (span * i) / (count - 1);
    const rad = (deg * Math.PI) / 180;
    return {
      x: Math.round(radius * Math.cos(rad)),
      y: Math.round(radius * Math.sin(rad)),
    };
  });
}

/** The OFF target shown below the button while a Flow is running. */
export const OFF_TARGET: Point = { x: 0, y: 96 };

/**
 * Which target (if any) the pointer offset is aiming at.
 * Returns the index of the nearest target within `threshold` px, else null —
 * releasing outside every target cancels.
 */
export function pickTarget(
  offset: Point,
  targets: Point[],
  threshold = 44,
): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  targets.forEach((t, i) => {
    const dist = Math.hypot(offset.x - t.x, offset.y - t.y);
    if (dist < threshold && dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}
