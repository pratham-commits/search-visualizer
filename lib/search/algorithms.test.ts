import { describe, expect, it } from "vitest";
import {
  aStarSearch,
  bestFirstGraphSearch,
  breadthFirstGraphSearch,
  breadthFirstTreeSearch,
  depthFirstGraphSearch,
  depthFirstTreeSearch,
  depthLimitedSearch,
  greedyBestFirstSearch,
  iterativeDeepeningSearch,
  uniformCostSearch,
} from "./algorithms";
import { plainEnglish, examNotation } from "./explain";
import { manhattan } from "./heuristic";
import { frameAt } from "./replay";
import { gridKey, gridProblem, isWall, type GridState } from "./problems/grid";
import { wallGrid } from "./problems/fixtures";
import { romaniaProblem, ROMANIA_SLD, type City } from "./problems/romania";
import type { Problem, StepEvent } from "./types";

const grid = gridProblem(wallGrid);

function expanded(trace: StepEvent[]): string[] {
  return trace.filter((event) => event.type === "expand").map((event) => event.stateKey);
}

function repeatsAState(keys: string[]): boolean {
  return new Set(keys).size < keys.length;
}

describe("breadth-first graph on the wall grid", () => {
  const result = breadthFirstGraphSearch(grid);

  it("expands in the hand-checked FIFO order and goal-tests the child", () => {
    expect(result.status).toBe("success");
    expect(expanded(result.trace)).toEqual([
      "0,0",
      "1,0",
      "0,1",
      "2,0",
      "0,2",
      "3,0",
      "2,1",
      "1,2",
      "3,1",
    ]);
    expect(result.path.map(gridKey)).toEqual([
      "0,0",
      "1,0",
      "2,0",
      "3,0",
      "3,1",
      "3,2",
    ]);
    expect(result.cost).toBe(5);
    const goal = result.trace.find(
      (event) => event.type === "goal-check" && event.isGoal,
    );
    expect(goal).toMatchObject({ when: "generate", stateKey: "3,2", phase: "done" });
    expect(frameAt(result.trace, result.trace.length - 1).explored).not.toContain(
      "3,2",
    );
  });
});

describe("depth-first graph on the wall grid", () => {
  const result = depthFirstGraphSearch(grid);

  it("expands down the first branch and keeps that first path", () => {
    expect(result.status).toBe("success");
    expect(expanded(result.trace)).toEqual([
      "0,0",
      "0,1",
      "0,2",
      "1,2",
      "2,2",
    ]);
    expect(result.path.map(gridKey)).toEqual([
      "0,0",
      "0,1",
      "0,2",
      "1,2",
      "2,2",
      "3,2",
    ]);
    expect(result.cost).toBe(5);
    const goal = result.trace.find(
      (event) => event.type === "goal-check" && event.isGoal,
    );
    expect(goal).toMatchObject({ when: "pop", stateKey: "3,2", phase: "done" });
    expect(frameAt(result.trace, result.trace.length - 1).explored).not.toContain(
      "3,2",
    );
  });
});

describe("tree search on the wall grid", () => {
  it("breadth-first matches graph search for the first four expansions, then repeats the start", () => {
    const result = breadthFirstTreeSearch(grid, { expansionLimit: 6 });
    expect(expanded(result.trace).slice(0, 5)).toEqual([
      "0,0",
      "1,0",
      "0,1",
      "2,0",
      "0,0",
    ]);
    expect(
      result.trace.some(
        (event) => event.phase === "repeated-state" && event.vars.repeated,
      ),
    ).toBe(true);
    const repeat = result.trace.find((event) => event.vars.repeated);
    expect(repeat?.vars.explored).toBeNull();
    expect(plainEnglish(repeat!)).toContain(
      "Repeated state — tree search does not detect this",
    );
  });

  it("depth-first plunges south, then generates a state it already saw", () => {
    const result = depthFirstTreeSearch(grid, { expansionLimit: 8 });
    expect(result.status).toBe("cutoff");
    expect(expanded(result.trace).slice(0, 5)).toEqual([
      "0,0",
      "0,1",
      "0,2",
      "1,2",
      "0,2",
    ]);
    const repeat = result.trace.find(
      (event) => event.type === "frontier-add" && event.vars.repeated,
    );
    expect(repeat).toBeTruthy();
    expect(examNotation(repeat!)).toContain(
      "Repeated state — tree search does not detect this",
    );
    expect(examNotation(repeat!)).toContain("Explored: — (tree search keeps none)");
  });
});

describe("explanations are computed from the step", () => {
  const result = breadthFirstGraphSearch(grid);
  const expand = result.trace.find((event) => event.type === "expand");

  it("names the focus and every neighbor on the first expansion", () => {
    expect(expand).toBeTruthy();
    const text = plainEnglish(expand!);
    expect(text).toContain(expand!.focus);
    for (const neighbor of expand!.examining) {
      expect(text).toContain(neighbor);
    }
    expect(examNotation(expand!)).toContain(
      `Explored: {${expand!.vars.explored?.join(", ")}}`,
    );
    expect(examNotation(expand!)).toContain("depth 0");
  });
});

describe("tree search re-expands and graph search does not", () => {
  it("breadth-first on the wall grid solves either way, and only the tree repeats a state", () => {
    const tree = breadthFirstTreeSearch(grid, { expansionLimit: 800 });
    const graph = breadthFirstGraphSearch(grid);
    expect(tree.status).toBe("success");
    expect(graph.status).toBe("success");
    expect(tree.cost).toBe(5);
    expect(graph.cost).toBe(5);
    expect(tree.path.map(gridKey)[0]).toBe("0,0");
    expect(tree.path.map(gridKey).at(-1)).toBe("3,2");
    expect(graph.path.map(gridKey)).toEqual([
      "0,0",
      "1,0",
      "2,0",
      "3,0",
      "3,1",
      "3,2",
    ]);
    expect(repeatsAState(expanded(tree.trace))).toBe(true);
    expect(repeatsAState(expanded(graph.trace))).toBe(false);
  });

  it("depth-limited graph search cycle-checks inside the limit and still solves", () => {
    const treeCut = depthLimitedSearch(grid, 3, "tree");
    const graphCut = depthLimitedSearch(grid, 3, "graph");
    expect(treeCut.status).toBe("cutoff");
    expect(graphCut.status).toBe("cutoff");
    expect(repeatsAState(expanded(treeCut.trace))).toBe(true);
    expect(repeatsAState(expanded(graphCut.trace))).toBe(false);
    expect(
      graphCut.trace.some(
        (event) => event.type === "frontier-skip" && event.reason === "explored",
      ),
    ).toBe(true);

    const tree = depthLimitedSearch(grid, 5, "tree");
    const graph = depthLimitedSearch(grid, 5, "graph");
    expect(tree.status).toBe("success");
    expect(graph.status).toBe("success");
    expect(tree.cost).toBe(5);
    expect(graph.cost).toBe(5);
    expect(graph.path.map(gridKey).at(-1)).toBe("3,2");
    expect(repeatsAState(expanded(graph.trace))).toBe(false);
  });
});

describe("discovered tree edges only accumulate", () => {
  const result = breadthFirstGraphSearch(grid);

  it("never drops an edge recorded on an earlier step", () => {
    let previous: string[] = [];
    for (let i = 0; i < result.trace.length; i += 1) {
      const keys = frameAt(result.trace, i).treeEdges.map((edge) => edge.key);
      for (const key of previous) expect(keys).toContain(key);
      previous = keys;
    }
    expect(previous.length).toBeGreaterThan(0);
  });
});

const deadEnd: Problem<string, string> = {
  initial: "S",
  actions: (state) => (state === "S" ? ["A"] : []),
  result: (_state, action) => action,
  stepCost: () => 1,
  goalTest: (state) => state === "G",
  stateKey: (state) => state,
};

describe("depth-limited search on the wall grid", () => {
  it("returns cutoff when the goal is deeper than L, without expanding the capped nodes", () => {
    const limited = depthLimitedSearch(grid, 1);
    expect(limited.status).toBe("cutoff");
    expect(expanded(limited.trace)).toEqual(["0,0"]);
    const capped = limited.trace.filter((event) => event.type === "depth-cutoff");
    expect(capped.map((event) => event.stateKey)).toEqual(["1,0", "0,1"]);
    expect(plainEnglish(capped[0])).toBe(
      "Node 1,0 is at depth 1 = the limit 1, so we do not expand it (cutoff).",
    );
    expect(examNotation(capped[0])).toContain("depth 1, limit 1");
    expect(examNotation(capped[0])).toContain("Outcome: cutoff");
    expect(limited.trace.at(-1)?.type).toBe("cutoff");
  });

  it("returns the shallow east-first path once L is the goal depth", () => {
    const solved = depthLimitedSearch(grid, 5);
    expect(solved.status).toBe("success");
    expect(expanded(solved.trace)).toEqual(["0,0", "1,0", "2,0", "3,0", "3,1"]);
    expect(solved.path.map(gridKey)).toEqual([
      "0,0",
      "1,0",
      "2,0",
      "3,0",
      "3,1",
      "3,2",
    ]);
    expect(solved.cost).toBe(5);
  });

  it("returns failure when the limit is never reached and the goal is absent", () => {
    const missed = depthLimitedSearch(deadEnd, 3);
    expect(missed.status).toBe("failure");
    expect(expanded(missed.trace)).toEqual(["S", "A"]);
    expect(examNotation(missed.trace.at(-1)!)).toContain("Outcome: failure");
    expect(depthLimitedSearch(deadEnd, 1).status).toBe("cutoff");
  });
});

describe("iterative deepening on the wall grid", () => {
  const result = iterativeDeepeningSearch(grid);

  it("restarts from the start and returns the shallowest goal", () => {
    expect(result.status).toBe("success");
    expect(result.path.map(gridKey)).toEqual([
      "0,0",
      "1,0",
      "2,0",
      "3,0",
      "3,1",
      "3,2",
    ]);
    expect(expanded(result.trace)).toEqual([
      "0,0",
      "0,0",
      "1,0",
      "0,1",
      "0,0",
      "1,0",
      "2,0",
      "0,0",
      "0,1",
      "0,0",
      "0,2",
      "0,0",
      "1,0",
      "2,0",
      "3,0",
      "2,1",
      "1,0",
      "0,0",
      "1,0",
      "0,1",
      "0,1",
      "0,0",
      "1,0",
      "0,1",
      "0,2",
      "0,1",
      "1,2",
      "0,0",
      "1,0",
      "2,0",
      "3,0",
      "3,1",
    ]);
  });

  it("clears the tree at each restart and counts states expanded again", () => {
    const restarts = result.trace
      .map((event, index) => (event.type === "restart" ? index : -1))
      .filter((index) => index >= 0);
    expect(restarts.length).toBe(6);
    const before = frameAt(result.trace, restarts[2] - 1);
    const cleared = frameAt(result.trace, restarts[2]);
    expect(before.treeEdges.length).toBeGreaterThan(0);
    expect(cleared.treeEdges).toEqual([]);
    expect(cleared.cutoff).toEqual([]);
    expect(cleared.limit).toBe(2);
    const endOfSecond = frameAt(result.trace, restarts[3] - 1);
    expect(endOfSecond.reexpanded).toBe(1);
  });
});

const gridH = (state: GridState) => manhattan(state, wallGrid.goal);
const romaniaH = (city: City) => ROMANIA_SLD[city];

describe("best-first graph search", () => {
  const romania = romaniaProblem();

  it("A* is optimal and greedy is not, on Arad to Bucharest", () => {
    const astar = aStarSearch(romania, romaniaH);
    const greedy = greedyBestFirstSearch(romania, romaniaH);
    const ucs = uniformCostSearch(romania, romaniaH);

    expect(astar.status).toBe("success");
    expect(astar.cost).toBe(418);
    expect(astar.path).toEqual([
      "Arad",
      "Sibiu",
      "Rimnicu",
      "Pitesti",
      "Bucharest",
    ]);
    expect(greedy.status).toBe("success");
    expect(greedy.path).toEqual(["Arad", "Sibiu", "Fagaras", "Bucharest"]);
    expect(greedy.cost).toBe(450);
    expect(ucs.status).toBe("success");
    expect(ucs.cost).toBe(418);

    expect(expanded(greedy.trace).length).toBeLessThan(expanded(astar.trace).length);
    expect(expanded(astar.trace).length).toBeLessThanOrEqual(
      expanded(ucs.trace).length,
    );
    expect(expanded(astar.trace)).toEqual([
      "Arad",
      "Sibiu",
      "Rimnicu",
      "Fagaras",
      "Pitesti",
    ]);
    expect(astar.trace.at(-1)?.vars.explored).not.toContain("Bucharest");
  });

  it("prints f = g + h, keeps the frontier sorted, and relaxes a worse path", () => {
    const astar = aStarSearch(romania, romaniaH);
    const sibiu = astar.trace.find(
      (event) => event.type === "generate" && event.stateKey === "Sibiu",
    );
    expect(sibiu && examNotation(sibiu)).toContain(
      "f(Sibiu) = g + h = 140 + 253 = 393",
    );
    expect(sibiu && plainEnglish(sibiu)).toContain(
      "f(Sibiu) = g + h = 140 + 253 = 393",
    );

    const popSibiu = astar.trace.find(
      (event) => event.type === "pop" && event.stateKey === "Sibiu",
    );
    expect(popSibiu && plainEnglish(popSibiu)).toBe(
      "Popped Sibiu (lowest f = 393).",
    );

    const afterArad = [...astar.trace]
      .reverse()
      .find(
        (event) =>
          event.type === "frontier-add" &&
          event.focus === "Arad" &&
          event.dataStructure.length === 3,
      );
    expect(afterArad?.dataStructure.map((item) => item.stateKey)).toEqual([
      "Sibiu",
      "Timisoara",
      "Zerind",
    ]);
    const keys = afterArad?.dataStructure.map((item) => item.f) ?? [];
    expect(keys).toEqual([...keys].sort((a, b) => a - b));

    const relaxed = astar.trace.find((event) => event.type === "frontier-replace");
    expect(relaxed).toMatchObject({
      stateKey: "Bucharest",
      previousG: 450,
      g: 418,
      previousF: 450,
      f: 418,
    });
    expect(relaxed && plainEnglish(relaxed)).toBe(
      "Relaxed Bucharest: found cheaper path, updated g from 450 to 418.",
    );
    const frame = frameAt(
      astar.trace,
      astar.trace.findIndex((event) => event.type === "frontier-replace"),
    );
    expect(frame.replacedKey).toBe("Bucharest");
    expect(frame.frontier.find((item) => item.stateKey === "Bucharest")).toMatchObject({
      g: 418,
      h: 0,
      f: 418,
    });
    expect(
      frame.treeEdges.some((edge) => edge.from === "Pitesti" && edge.to === "Bucharest"),
    ).toBe(true);
    expect(
      frame.treeEdges.some((edge) => edge.from === "Fagaras" && edge.to === "Bucharest"),
    ).toBe(false);
  });

  it("uniform-cost shows g accumulation and greedy shows h only", () => {
    const ucs = uniformCostSearch(romania, romaniaH);
    const sibiu = ucs.trace.find(
      (event) => event.type === "generate" && event.stateKey === "Sibiu",
    );
    expect(sibiu && examNotation(sibiu)).toContain(
      "g(Sibiu) = g(Arad) + 140 = 140",
    );
    expect(sibiu && examNotation(sibiu)).not.toContain("g + h");

    const greedy = greedyBestFirstSearch(romania, romaniaH);
    const greedySibiu = greedy.trace.find(
      (event) => event.type === "generate" && event.stateKey === "Sibiu",
    );
    expect(greedySibiu && examNotation(greedySibiu)).toContain("h(Sibiu) = 253");
    expect(greedySibiu && examNotation(greedySibiu)).not.toContain("g + h");
  });

  it("is the same loop: f = h matches greedy, and f = g matches uniform-cost", () => {
    const viaCore = bestFirstGraphSearch(
      romania,
      (node) => romaniaH(node.state),
      { heuristic: (node) => romaniaH(node.state), scoreKind: "h" },
    );
    const greedy = greedyBestFirstSearch(romania, romaniaH);
    expect(viaCore.path).toEqual(greedy.path);
    expect(viaCore.cost).toBe(greedy.cost);

    const ucsCore = bestFirstGraphSearch(romania, (node) => node.pathCost, {
      heuristic: (node) => romaniaH(node.state),
      scoreKind: "g",
    });
    expect(ucsCore.cost).toBe(uniformCostSearch(romania, romaniaH).cost);
    expect(ucsCore.path).toEqual(uniformCostSearch(romania, romaniaH).path);
  });

  it("expands fewer nodes for greedy than A* than or equal uniform-cost on the wall grid", () => {
    const greedy = greedyBestFirstSearch(grid, gridH);
    const astar = aStarSearch(grid, gridH);
    const ucs = uniformCostSearch(grid, gridH);
    expect(greedy.status).toBe("success");
    expect(astar.status).toBe("success");
    expect(ucs.status).toBe("success");
    expect(astar.cost).toBe(5);
    expect(ucs.cost).toBe(5);
    expect(expanded(greedy.trace).length).toBeLessThan(expanded(astar.trace).length);
    expect(expanded(astar.trace).length).toBeLessThanOrEqual(
      expanded(ucs.trace).length,
    );
    for (let y = 0; y < wallGrid.height; y += 1) {
      for (let x = 0; x < wallGrid.width; x += 1) {
        if (isWall(wallGrid, { x, y })) continue;
        const fromHere = gridProblem({ ...wallGrid, start: { x, y } });
        const result = aStarSearch(fromHere, gridH);
        expect(result.status).toBe("success");
        expect(gridH({ x, y })).toBeLessThanOrEqual(result.cost ?? Infinity);
      }
    }
  });
});
