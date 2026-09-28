import { createFrontier, type FrontierKind } from "./frontier";
import { search } from "./loop";
import { gridProblem } from "./problems/grid";
import { wallGrid } from "./problems/fixtures";
import { romaniaProblem } from "./problems/romania";
import type { Node, Problem, SearchPolicy, SearchResult } from "./types";

export type DemoProblem = "grid" | "romania";

/** Demo policy: graph search, IS-GOAL when a node is popped, no replacement, f = PATH-COST. */
export function demoPolicy<S, A>(): SearchPolicy<S, A> {
  return {
    mode: "graph",
    isGoalWhen: "pop",
    replaceFrontier: "never",
    f: (node: Node<S, A>) => node.pathCost,
  };
}

export function demoProblem(which: DemoProblem): Problem<unknown, unknown> {
  if (which === "grid") return gridProblem(wallGrid) as Problem<unknown, unknown>;
  return romaniaProblem() as Problem<unknown, unknown>;
}

export function runRecorded<S, A>(
  problem: Problem<S, A>,
  kind: FrontierKind,
): SearchResult<S, A> {
  const policy = demoPolicy<S, A>();
  return search(problem, createFrontier(kind, problem.stateKey, policy.f), policy);
}
