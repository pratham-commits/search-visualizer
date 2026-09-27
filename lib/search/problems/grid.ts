import type { Problem } from "../types";

export interface GridState {
  x: number;
  y: number;
}

export type GridAction = "N" | "E" | "S" | "W";

export interface GridSpec {
  width: number;
  height: number;
  walls: ReadonlyArray<GridState>;
  /** Cost of entering a cell. Missing cells cost 1. */
  costs: ReadonlyArray<{ x: number; y: number; cost: number }>;
  start: GridState;
  goal: GridState;
}

const ORDER: GridAction[] = ["N", "E", "S", "W"];

const DELTA: Record<GridAction, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export function gridKey(state: GridState): string {
  return `${state.x},${state.y}`;
}

export function isWall(spec: GridSpec, state: GridState): boolean {
  return spec.walls.some((wall) => wall.x === state.x && wall.y === state.y);
}

export function inBounds(spec: GridSpec, state: GridState): boolean {
  return (
    state.x >= 0 &&
    state.y >= 0 &&
    state.x < spec.width &&
    state.y < spec.height
  );
}

export function enterCost(spec: GridSpec, state: GridState): number {
  const found = spec.costs.find(
    (cell) => cell.x === state.x && cell.y === state.y,
  );
  return found?.cost ?? 1;
}

export function gridProblem(spec: GridSpec): Problem<GridState, GridAction> {
  return {
    initial: spec.start,
    actions(state) {
      if (!inBounds(spec, state) || isWall(spec, state)) return [];
      return ORDER.filter((action) => {
        const next = step(state, action);
        return inBounds(spec, next) && !isWall(spec, next);
      });
    },
    result(state, action) {
      return step(state, action);
    },
    stepCost(_state, _action, next) {
      return enterCost(spec, next);
    },
    goalTest(state) {
      return state.x === spec.goal.x && state.y === spec.goal.y;
    },
    stateKey: gridKey,
  };
}

function step(state: GridState, action: GridAction): GridState {
  const delta = DELTA[action];
  return { x: state.x + delta.x, y: state.y + delta.y };
}
