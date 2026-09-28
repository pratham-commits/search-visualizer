import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FifoFrontier, LifoFrontier, PriorityFrontier } from "./frontier";
import { search } from "./loop";
import { frameAt } from "./replay";
import type { Problem, SearchPolicy, StepEvent } from "./types";

function roads(
  edges: Record<string, Array<{ to: string; cost: number }>>,
  goal = "G",
): Problem<string, string> {
  return {
    initial: "S",
    actions: (state) => (edges[state] ?? []).map((edge) => edge.to),
    result: (_state, action) => action,
    actionCost(state, action) {
      const edge = (edges[state] ?? []).find((item) => item.to === action);
      if (!edge) throw new Error(`missing edge ${state} -> ${action}`);
      return edge.cost;
    },
    isGoal: (state) => state === goal,
    stateKey: (state) => state,
  };
}

function policy(
  overrides: Partial<SearchPolicy<string, string>> = {},
): SearchPolicy<string, string> {
  return {
    mode: "tree",
    isGoalWhen: "pop",
    replaceFrontier: "never",
    f: (node) => node.pathCost,
    ...overrides,
  };
}

function pops(trace: StepEvent[]): string[] {
  return trace
    .filter((event) => event.type === "pop")
    .map((event) => event.stateKey);
}

const branch = roads({
  S: [
    { to: "A", cost: 4 },
    { to: "B", cost: 1 },
    { to: "C", cost: 2 },
  ],
  A: [],
  B: [],
  C: [{ to: "G", cost: 1 }],
  G: [],
});

describe("swappable frontier", () => {
  it("FIFO, LIFO, and min-g pop in different orders on the same problem", () => {
    const score = (node: { pathCost: number }) => node.pathCost;
    const fifo = search(branch, new FifoFrontier(branch.stateKey), policy());
    const lifo = search(branch, new LifoFrontier(branch.stateKey), policy());
    const priority = search(
      branch,
      new PriorityFrontier(branch.stateKey, score),
      policy(),
    );

    expect(pops(fifo.trace)).toEqual(["S", "A", "B", "C", "G"]);
    expect(pops(lifo.trace)).toEqual(["S", "C", "G"]);
    expect(pops(priority.trace)).toEqual(["S", "B", "C", "G"]);
    expect(fifo.status).toBe("success");
    expect(lifo.status).toBe("success");
    expect(priority.status).toBe("success");
  });
});

describe("trace", () => {
  it("records pop, generate, frontier update, and goal-check, and frameAt matches that snapshot", () => {
    const result = search(branch, new FifoFrontier(branch.stateKey), policy());
    const kinds = new Set(result.trace.map((event) => event.type));
    expect(kinds.has("pop")).toBe(true);
    expect(kinds.has("generate")).toBe(true);
    expect(kinds.has("frontier-add")).toBe(true);
    expect(kinds.has("goal-check")).toBe(true);

    const index = result.trace.findIndex(
      (event) =>
        event.type === "frontier-add" &&
        event.frontier.map((item) => item.stateKey).join(",") === "A,B,C",
    );
    expect(index).toBeGreaterThan(-1);
    const event = result.trace[index];
    if (event.type !== "frontier-add") throw new Error("expected frontier-add");

    const frame = frameAt(result.trace, index);
    expect(frame.frontier.map((item) => item.stateKey)).toEqual(["A", "B", "C"]);
    expect(frame.frontier).toEqual(event.frontier);
    expect(frame.reached).toEqual(["S"]);
    expect(frame.status).toBe("running");

    const end = frameAt(result.trace, result.trace.length - 1);
    expect(end.status).toBe("success");
    expect(end.path).toEqual(result.path);
    expect(end.cost).toBe(result.cost);
  });

  it("calls IS-GOAL on generate without popping the goal, and on pop without expanding it", () => {
    const generated = search(
      branch,
      new FifoFrontier(branch.stateKey),
      policy({ isGoalWhen: "generate" }),
    );
    const popped = search(
      branch,
      new FifoFrontier(branch.stateKey),
      policy({ isGoalWhen: "pop" }),
    );

    const generatedGoal = generated.trace.find(
      (event) => event.type === "goal-check" && event.isGoal,
    );
    const poppedGoal = popped.trace.find(
      (event) => event.type === "goal-check" && event.isGoal,
    );
    expect(generatedGoal).toMatchObject({ type: "goal-check", when: "generate", stateKey: "G" });
    expect(poppedGoal).toMatchObject({ type: "goal-check", when: "pop", stateKey: "G" });
    expect(pops(generated.trace)).not.toContain("G");
    expect(pops(popped.trace)).toContain("G");
    expect(frameAt(generated.trace, generated.trace.length - 1).reached).not.toContain("G");
    expect(frameAt(popped.trace, popped.trace.length - 1).reached).not.toContain("G");
  });

  it("graph mode skips a reached state; tree-like search skips only a cycle on the path", () => {
    const cycle = roads({
      S: [{ to: "A", cost: 1 }],
      A: [
        { to: "S", cost: 1 },
        { to: "G", cost: 1 },
      ],
      G: [],
    });
    const graph = search(
      cycle,
      new FifoFrontier(cycle.stateKey),
      policy({ mode: "graph" }),
    );
    const tree = search(
      cycle,
      new FifoFrontier(cycle.stateKey),
      policy({ mode: "tree" }),
    );

    expect(pops(graph.trace)).toEqual(["S", "A", "G"]);
    expect(pops(tree.trace)).toEqual(["S", "A", "G"]);
    expect(
      graph.trace.some(
        (event) => event.type === "frontier-skip" && event.reason === "reached",
      ),
    ).toBe(true);
    expect(
      tree.trace.some(
        (event) => event.type === "frontier-skip" && event.reason === "cycle",
      ),
    ).toBe(true);
    expect(tree.trace.every((event) => event.vars.reached === null)).toBe(true);

    const fork = roads({
      S: [
        { to: "A", cost: 1 },
        { to: "B", cost: 1 },
      ],
      A: [{ to: "C", cost: 1 }],
      B: [{ to: "C", cost: 1 }],
      C: [{ to: "G", cost: 1 }],
      G: [],
    });
    const treeFork = search(
      fork,
      new FifoFrontier(fork.stateKey),
      policy({ mode: "tree" }),
    );
    const graphFork = search(
      fork,
      new FifoFrontier(fork.stateKey),
      policy({ mode: "graph" }),
    );
    const times = (trace: StepEvent[], key: string) =>
      trace.filter((event) => event.type === "expand" && event.stateKey === key)
        .length;
    expect(times(treeFork.trace, "C")).toBe(2);
    expect(times(graphFork.trace, "C")).toBe(1);
  });

  it("replaces a frontier node when f is lower", () => {
    const diamond = roads({
      S: [
        { to: "A", cost: 1 },
        { to: "B", cost: 4 },
      ],
      A: [{ to: "B", cost: 1 }],
      B: [{ to: "G", cost: 1 }],
      G: [],
    });
    const score = (node: { pathCost: number }) => node.pathCost;
    const result = search(
      diamond,
      new PriorityFrontier(diamond.stateKey, score),
      policy({
        mode: "graph",
        replaceFrontier: "if-lower-f",
      }),
    );

    expect(result.cost).toBe(3);
    expect(result.path).toEqual(["S", "A", "B", "G"]);
    expect(result.trace.some((event) => event.type === "frontier-replace")).toBe(true);
  });

  it("does not expand a node at the depth limit", () => {
    const result = search(branch, new LifoFrontier(branch.stateKey), policy({
      mode: "tree",
      isGoalWhen: "pop",
      depthLimit: 0,
      firstActionFirst: true,
    }));
    expect(result.status).toBe("cutoff");
    expect(result.trace.some((event) => event.type === "expand")).toBe(false);
    expect(result.trace.some((event) => event.type === "depth-cutoff")).toBe(true);
  });
});

describe("search library purity", () => {
  it("does not import React or touch the DOM", () => {
    const files = sourceFiles(join(process.cwd(), "lib/search"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/from ["']react/);
      expect(text, file).not.toMatch(/\bdocument\b/);
      expect(text, file).not.toMatch(/\bwindow\b/);
    }
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!path.endsWith(".ts") || path.endsWith(".test.ts")) return [];
    return [path];
  });
}
