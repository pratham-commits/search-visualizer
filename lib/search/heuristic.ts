import type { GridState } from "./problems/grid";

/** 4-connected grid heuristic. Admissible when every action costs at least 1. */
export function manhattan(a: GridState, b: GridState): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
