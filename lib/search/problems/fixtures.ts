import type { GridSpec } from "./grid";

/**
 * 4 columns, 3 rows. y grows south, matching the sheet.
 *
 *   S . . .
 *   . # . .
 *   . . . G
 *
 * Uniform enter-cost 1. Manhattan from S to G is 5, and a 5-step route
 * still exists around the wall, so that is the optimum (not 4).
 * Hand-run of FIFO, graph mode, IS-GOAL on pop, actions N-E-S-W:
 * the first time G is popped its parents are
 * (0,0)-(1,0)-(2,0)-(3,0)-(3,1)-(3,2).
 */
export const wallGrid: GridSpec = {
  width: 4,
  height: 3,
  walls: [{ x: 1, y: 1 }],
  costs: [],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 2 },
};

export const WALL_GRID_OPTIMAL_PATH = [
  "0,0",
  "1,0",
  "2,0",
  "3,0",
  "3,1",
  "3,2",
] as const;

export const WALL_GRID_OPTIMAL_COST = 5;
