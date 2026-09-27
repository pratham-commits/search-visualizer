import { describe, expect, it } from "vitest";
import { runRecorded } from "./demo";
import { manhattan } from "./heuristic";
import { enterCost, gridKey, gridProblem, isWall } from "./problems/grid";
import {
  WALL_GRID_OPTIMAL_COST,
  WALL_GRID_OPTIMAL_PATH,
  wallGrid,
} from "./problems/fixtures";
import { romaniaProblem } from "./problems/romania";

describe("wall grid", () => {
  const problem = gridProblem(wallGrid);

  it("never generates a move into or through a wall", () => {
    expect(isWall(wallGrid, { x: 1, y: 1 })).toBe(true);
    expect(problem.actions({ x: 1, y: 1 })).toEqual([]);
    for (let y = 0; y < wallGrid.height; y += 1) {
      for (let x = 0; x < wallGrid.width; x += 1) {
        const state = { x, y };
        for (const action of problem.actions(state)) {
          const next = problem.result(state, action);
          expect(isWall(wallGrid, next)).toBe(false);
          expect(gridKey(next)).not.toBe("1,1");
        }
      }
    }
  });

  it("charges the cost of entering the destination", () => {
    const weighted = gridProblem({
      ...wallGrid,
      costs: [{ x: 3, y: 0, cost: 7 }],
    });
    expect(enterCost(wallGrid, { x: 1, y: 0 })).toBe(1);
    expect(
      weighted.stepCost({ x: 2, y: 0 }, "E", { x: 3, y: 0 }),
    ).toBe(7);
  });

  it("FIFO graph search finds the hand-checked path", () => {
    const result = runRecorded(problem, "fifo");
    expect(result.status).toBe("success");
    expect(result.cost).toBe(WALL_GRID_OPTIMAL_COST);
    expect(result.path.map(gridKey)).toEqual([...WALL_GRID_OPTIMAL_PATH]);
  });

  it("Manhattan is admissible on every open cell", () => {
    for (let y = 0; y < wallGrid.height; y += 1) {
      for (let x = 0; x < wallGrid.width; x += 1) {
        if (isWall(wallGrid, { x, y })) continue;
        const fromHere = gridProblem({ ...wallGrid, start: { x, y } });
        const result = runRecorded(fromHere, "fifo");
        expect(result.status).toBe("success");
        expect(manhattan({ x, y }, wallGrid.goal)).toBeLessThanOrEqual(
          result.cost ?? Infinity,
        );
      }
    }
  });
});

describe("Romania map", () => {
  const problem = romaniaProblem();

  it("matches textbook road costs in both directions", () => {
    const roads: Array<[string, string, number]> = [
      ["Arad", "Sibiu", 140],
      ["Arad", "Zerind", 75],
      ["Arad", "Timisoara", 118],
      ["Sibiu", "Fagaras", 99],
      ["Fagaras", "Bucharest", 211],
      ["Sibiu", "Rimnicu", 80],
      ["Rimnicu", "Pitesti", 97],
      ["Pitesti", "Bucharest", 101],
      ["Bucharest", "Giurgiu", 90],
      ["Bucharest", "Urziceni", 85],
    ];
    for (const [from, to, cost] of roads) {
      expect(problem.stepCost(from as "Arad", to as "Arad", to as "Arad")).toBe(cost);
      expect(problem.stepCost(to as "Arad", from as "Arad", from as "Arad")).toBe(cost);
    }
  });

  it("keeps aima-python neighbor order for Sibiu", () => {
    expect(problem.actions("Arad")).toEqual(["Zerind", "Sibiu", "Timisoara"]);
    expect(problem.actions("Sibiu")).toEqual([
      "Arad",
      "Fagaras",
      "Oradea",
      "Rimnicu",
    ]);
  });
});
