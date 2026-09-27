import { FifoFrontier, LifoFrontier, PriorityFrontier } from "./frontier";
import { search } from "./loop";
import type { Node, Problem, SearchResult, StepEvent } from "./types";

export type AlgorithmId =
  | "bfs-tree"
  | "bfs-graph"
  | "dfs-tree"
  | "dfs-graph"
  | "depth-limited"
  | "iterative-deepening";

/** Syllabus algorithms. Uniform-cost stays; the generic best-first loop is the engine under it, greedy, and A*. */
export const ALGORITHM_CATALOG = [
  { n: 1, id: "bfs-tree", name: "Breadth-first tree" },
  { n: 2, id: "bfs-graph", name: "Breadth-first graph" },
  { n: 3, id: "dfs-tree", name: "Depth-first tree" },
  { n: 4, id: "dfs-graph", name: "Depth-first graph" },
  { n: 5, id: "depth-limited", name: "Depth-limited" },
  { n: 6, id: "iterative-deepening", name: "Iterative deepening" },
  { n: 7, id: "uniform-cost", name: "Uniform-cost" },
  { n: 8, id: "greedy", name: "Greedy best-first" },
  { n: 9, id: "astar", name: "A*" },
  { n: 10, id: "hill-climbing", name: "Hill climbing" },
  { n: 11, id: "annealing", name: "Simulated annealing" },
  { n: 12, id: "beam", name: "Local beam search" },
  { n: 13, id: "genetic", name: "Genetic algorithm" },
] as const;

export interface AlgorithmInfo {
  id: string;
  name: string;
  line: string;
  pseudocode: string;
  frontier: string;
  mode: "tree" | "graph";
  goalTest: "pop" | "generate";
  explored: string;
  f: string;
  /** Replaces the on-pop / on-generate phrase when the algorithm has no frontier. */
  goalLabel?: string;
}

const INFO: Record<AlgorithmId, AlgorithmInfo> = {
  "bfs-tree": {
    id: "bfs-tree",
    name: "Breadth-first tree",
    line: "FIFO queue. Goal-test a node when it is popped. No explored set.",
    frontier: "FIFO queue",
    mode: "tree",
    goalTest: "pop",
    explored: "none — tree search",
    f: "g",
    pseudocode: `frontier ← FIFO queue with NODE(initial)
while frontier is not empty do
  node ← POP(frontier)
  if GOAL(node) then return node
  for each child in EXPAND(node) do
    INSERT(child, frontier)`,
  },
  "bfs-graph": {
    id: "bfs-graph",
    name: "Breadth-first graph",
    line: "FIFO queue. Goal-test a child when it is generated. Mark a node explored when it is popped.",
    frontier: "FIFO queue",
    mode: "graph",
    goalTest: "generate",
    explored: "on pop",
    f: "g",
    pseudocode: `if GOAL(initial) then return it
frontier ← FIFO queue with NODE(initial)
while frontier is not empty do
  node ← POP(frontier)
  add node.STATE to explored
  for each child in EXPAND(node) do
    if child.STATE is explored or in frontier then skip
    if GOAL(child) then return child
    INSERT(child, frontier)`,
  },
  "dfs-tree": {
    id: "dfs-tree",
    name: "Depth-first tree",
    line: "LIFO stack. Goal-test a node when it is popped. No explored set, so a repeated state is pushed again.",
    frontier: "LIFO stack",
    mode: "tree",
    goalTest: "pop",
    explored: "none — tree search",
    f: "g",
    pseudocode: `frontier ← LIFO stack with NODE(initial)
while frontier is not empty do
  node ← POP(frontier)
  if GOAL(node) then return node
  for each child in EXPAND(node) do
    PUSH(child, frontier)`,
  },
  "dfs-graph": {
    id: "dfs-graph",
    name: "Depth-first graph",
    line: "LIFO stack. Goal-test on pop. The explored set keeps the first path that reached a state.",
    frontier: "LIFO stack",
    mode: "graph",
    goalTest: "pop",
    explored: "on pop, after the goal test fails",
    f: "g",
    pseudocode: `frontier ← LIFO stack with NODE(initial)
while frontier is not empty do
  node ← POP(frontier)
  if GOAL(node) then return node
  add node.STATE to explored
  for each child in EXPAND(node) do
    if child.STATE is explored or in frontier then skip
    PUSH(child, frontier)`,
  },
  "depth-limited": {
    id: "depth-limited",
    name: "Depth-limited",
    line: "Depth-first tree search with a depth limit L. A node at depth L is goal-tested and not expanded.",
    frontier: "LIFO stack",
    mode: "tree",
    goalTest: "pop",
    explored: "none — tree search",
    f: "g",
    pseudocode: `function DLS(problem, L)
  return RECURSIVE-DLS(NODE(initial), problem, L)

function RECURSIVE-DLS(node, problem, limit)
  if GOAL(node) then return solution
  if limit = 0 then return cutoff
  cutoff_occurred ← false
  for each child in EXPAND(node) do
    result ← RECURSIVE-DLS(child, problem, limit − 1)
    if result = cutoff then cutoff_occurred ← true
    else if result ≠ failure then return result
  if cutoff_occurred then return cutoff else return failure`,
  },
  "iterative-deepening": {
    id: "iterative-deepening",
    name: "Iterative deepening",
    line: "Run depth-limited search for L = 0, 1, 2, … and restart from the start after each cutoff.",
    frontier: "LIFO stack",
    mode: "tree",
    goalTest: "pop",
    explored: "none — each iteration is a fresh tree",
    f: "g",
    pseudocode: `function IDS(problem)
  for L = 0, 1, 2, … do
    result ← DLS(problem, L)
    if result ≠ cutoff then return result`,
  },
};

export function algorithmInfo(id: AlgorithmId): AlgorithmInfo {
  return INFO[id];
}

export interface SearchOptions {
  expansionLimit?: number;
}

export function breadthFirstTreeSearch<S, A>(
  problem: Problem<S, A>,
  options: SearchOptions = {},
): SearchResult<S, A> {
  return search(problem, new FifoFrontier(problem.stateKey), {
    mode: "tree",
    goalTest: "pop",
    replaceFrontier: "never",
    f: (node) => node.pathCost,
    expansionLimit: options.expansionLimit,
  });
}

export function breadthFirstGraphSearch<S, A>(
  problem: Problem<S, A>,
): SearchResult<S, A> {
  return search(problem, new FifoFrontier(problem.stateKey), {
    mode: "graph",
    goalTest: "generate",
    replaceFrontier: "never",
    f: (node) => node.pathCost,
  });
}

export function depthFirstTreeSearch<S, A>(
  problem: Problem<S, A>,
  options: SearchOptions = {},
): SearchResult<S, A> {
  return search(problem, new LifoFrontier(problem.stateKey), {
    mode: "tree",
    goalTest: "pop",
    replaceFrontier: "never",
    f: (node) => node.pathCost,
    expansionLimit: options.expansionLimit,
  });
}

export function depthFirstGraphSearch<S, A>(
  problem: Problem<S, A>,
): SearchResult<S, A> {
  return search(problem, new LifoFrontier(problem.stateKey), {
    mode: "graph",
    goalTest: "pop",
    replaceFrontier: "never",
    f: (node) => node.pathCost,
  });
}

export interface BestFirstOptions<S, A> {
  heuristic?: (node: Node<S, A>) => number;
  scoreKind: "g" | "h" | "g+h";
}

/** aima-python `best_first_graph_search`: min-f, explored on pop, goal test on pop, replace a worse frontier node. */
export function bestFirstGraphSearch<S, A>(
  problem: Problem<S, A>,
  f: (node: Node<S, A>) => number,
  options: BestFirstOptions<S, A>,
): SearchResult<S, A> {
  return search(problem, new PriorityFrontier(problem.stateKey, f), {
    mode: "graph",
    goalTest: "pop",
    replaceFrontier: "if-lower-f",
    f,
    heuristic: options.heuristic,
    scoreKind: options.scoreKind,
  });
}

export function uniformCostSearch<S, A>(
  problem: Problem<S, A>,
  h?: (state: S) => number,
): SearchResult<S, A> {
  return bestFirstGraphSearch(problem, (node) => node.pathCost, {
    heuristic: h ? (node) => h(node.state) : undefined,
    scoreKind: "g",
  });
}

export function greedyBestFirstSearch<S, A>(
  problem: Problem<S, A>,
  h: (state: S) => number,
): SearchResult<S, A> {
  const heuristic = (node: Node<S, A>) => h(node.state);
  return bestFirstGraphSearch(problem, heuristic, {
    heuristic,
    scoreKind: "h",
  });
}

export function aStarSearch<S, A>(
  problem: Problem<S, A>,
  h: (state: S) => number,
): SearchResult<S, A> {
  const heuristic = (node: Node<S, A>) => h(node.state);
  return bestFirstGraphSearch(
    problem,
    (node) => node.pathCost + heuristic(node),
    { heuristic, scoreKind: "g+h" },
  );
}

export function depthLimitedSearch<S, A>(
  problem: Problem<S, A>,
  limit: number,
  mode: "tree" | "graph" = "tree",
): SearchResult<S, A> {
  return search(problem, new LifoFrontier(problem.stateKey), {
    mode,
    goalTest: "pop",
    replaceFrontier: "never",
    f: (node) => node.pathCost,
    depthLimit: limit,
    firstActionFirst: true,
  });
}

const IDS_GUARD = 32;

export function iterativeDeepeningSearch<S, A>(
  problem: Problem<S, A>,
  mode: "tree" | "graph" = "tree",
): SearchResult<S, A> {
  const trace: StepEvent[] = [];
  const expandedBefore = new Set<string>();

  for (let limit = 0; limit <= IDS_GUARD; limit += 1) {
    const result = depthLimitedSearch(problem, limit, mode);
    const expandedThis = new Set<string>();
    let reexpanded = 0;
    trace.push({
      type: "restart",
      limit,
      iteration: limit,
      phase: "restart",
      focus: null,
      examining: [],
      dataStructure: [],
      nextOutId: null,
      structure: "lifo",
      vars: {
        frontier: [],
        explored: mode === "graph" ? [] : null,
        depth: null,
        repeated: false,
        limit,
        iteration: limit,
        reexpanded: 0,
        scoreKind: null,
      },
    });
    for (const event of result.trace) {
      if (event.type === "expand") {
        if (expandedBefore.has(event.stateKey)) reexpanded += 1;
        expandedThis.add(event.stateKey);
      }
      trace.push({
        ...event,
        vars: {
          ...event.vars,
          limit,
          iteration: limit,
          reexpanded,
        },
      });
    }
    for (const state of expandedThis) expandedBefore.add(state);
    if (result.status !== "cutoff") {
      return { ...result, trace };
    }
  }

  return {
    status: "cutoff",
    node: null,
    path: [],
    cost: null,
    trace,
  };
}

export function runAlgorithm<S, A>(
  problem: Problem<S, A>,
  id: AlgorithmId,
  options: { limit?: number } = {},
): SearchResult<S, A> {
  switch (id) {
    case "bfs-tree":
      return breadthFirstTreeSearch(problem, { expansionLimit: 400 });
    case "bfs-graph":
      return breadthFirstGraphSearch(problem);
    case "dfs-tree":
      return depthFirstTreeSearch(problem, { expansionLimit: 12 });
    case "dfs-graph":
      return depthFirstGraphSearch(problem);
    case "depth-limited":
      return depthLimitedSearch(problem, options.limit ?? 2);
    case "iterative-deepening":
      return iterativeDeepeningSearch(problem);
  }
}

export const DLS_GRAPH_CAPTION =
  "graph variant checks for repeated states; classic IDS/DLS is tree-search for low memory.";

export type AlgorithmFamily =
  | "bfs"
  | "dfs"
  | "dls"
  | "ids"
  | "ucs"
  | "greedy"
  | "astar"
  | "hill-climbing"
  | "annealing"
  | "beam"
  | "genetic";

export type VariantKind = "tree" | "graph";

export interface FamilySpec {
  id: AlgorithmFamily;
  name: string;
  ready: boolean;
  control: "toggle" | "fixed" | "none";
  defaultVariant: VariantKind | null;
}

export const ALGORITHM_FAMILIES: FamilySpec[] = [
  { id: "bfs", name: "Breadth-first", ready: true, control: "toggle", defaultVariant: "graph" },
  { id: "dfs", name: "Depth-first", ready: true, control: "toggle", defaultVariant: "graph" },
  { id: "dls", name: "Depth-limited", ready: true, control: "toggle", defaultVariant: "tree" },
  { id: "ids", name: "Iterative deepening", ready: true, control: "toggle", defaultVariant: "tree" },
  { id: "ucs", name: "Uniform-cost", ready: true, control: "fixed", defaultVariant: "graph" },
  { id: "greedy", name: "Greedy best-first", ready: true, control: "fixed", defaultVariant: "graph" },
  { id: "astar", name: "A*", ready: true, control: "fixed", defaultVariant: "graph" },
  { id: "hill-climbing", name: "Hill climbing", ready: true, control: "none", defaultVariant: null },
  { id: "annealing", name: "Simulated annealing", ready: true, control: "none", defaultVariant: null },
  { id: "beam", name: "Local beam search", ready: true, control: "none", defaultVariant: null },
  { id: "genetic", name: "Genetic algorithm", ready: true, control: "none", defaultVariant: null },
];

export function familySpec(id: AlgorithmFamily): FamilySpec {
  const found = ALGORITHM_FAMILIES.find((family) => family.id === id);
  if (!found) throw new Error(`unknown algorithm ${id}`);
  return found;
}

const DLS_GRAPH: AlgorithmInfo = {
  id: "depth-limited",
  name: "Depth-limited",
  line: "Depth-first search with limit L and an explored set. A state already explored or still in the frontier is not pushed again.",
  frontier: "LIFO stack",
  mode: "graph",
  goalTest: "pop",
  explored: "on pop — each state once",
  f: "g",
  pseudocode: `function DLS(problem, L)
  return RECURSIVE-DLS(NODE(initial), problem, L)

function RECURSIVE-DLS(node, problem, limit)
  if GOAL(node) then return solution
  if limit = 0 then return cutoff
  add node.STATE to explored
  for each child in EXPAND(node) do
    if child.STATE is explored or in frontier then skip
    result ← RECURSIVE-DLS(child, problem, limit − 1)`,
};

const IDS_GRAPH: AlgorithmInfo = {
  id: "iterative-deepening",
  name: "Iterative deepening",
  line: "Depth-limited graph search for L = 0, 1, 2, …. Each iteration starts over and keeps an explored set.",
  frontier: "LIFO stack",
  mode: "graph",
  goalTest: "pop",
  explored: "on pop — each state once per iteration",
  f: "g",
  pseudocode: `function IDS(problem)
  for L = 0, 1, 2, … do
    result ← GRAPH-DLS(problem, L)
    if result ≠ cutoff then return result`,
};

const PRIORITY: Record<"ucs" | "greedy" | "astar", AlgorithmInfo> = {
  ucs: {
    id: "ucs",
    name: "Uniform-cost",
    mode: "graph",
    frontier: "priority queue",
    goalTest: "pop",
    explored: "on pop",
    f: "g",
    line: "Graph search. Pop the frontier node with the smallest g. A cheaper path already in the frontier replaces the old one.",
    pseudocode: `function UNIFORM-COST(problem)
  return BEST-FIRST-GRAPH-SEARCH(problem, g)`,
  },
  greedy: {
    id: "greedy",
    name: "Greedy best-first",
    mode: "graph",
    frontier: "priority queue",
    goalTest: "pop",
    explored: "on pop",
    f: "h",
    line: "Graph search. Pop the frontier node with the smallest h. Not optimal: h ignores the cost already paid.",
    pseudocode: `function GREEDY-BEST-FIRST(problem, h)
  return BEST-FIRST-GRAPH-SEARCH(problem, h)`,
  },
  astar: {
    id: "astar",
    name: "A*",
    mode: "graph",
    frontier: "priority queue",
    goalTest: "pop",
    explored: "on pop",
    f: "g + h",
    line: "Graph search. Pop the frontier node with the smallest f = g + h. A lower f already in the frontier replaces the old node.",
    pseudocode: `function A-STAR(problem, h)
  return BEST-FIRST-GRAPH-SEARCH(problem, g + h)`,
  },
};

const LOCAL: Record<"hill-climbing" | "annealing" | "beam" | "genetic", AlgorithmInfo> = {
  "hill-climbing": {
    id: "hill-climbing",
    name: "Hill climbing",
    mode: "graph",
    frontier: "none",
    goalTest: "pop",
    goalLabel: "stop at a local maximum",
    explored: "none",
    f: "—",
    line: "Steepest ascent. Move to the best neighbor only when it is strictly better. Stop on a local maximum or a plateau.",
    pseudocode: `function HILL-CLIMBING(problem)
  current ← problem.INITIAL
  loop do
    neighbor ← a highest-valued successor of current
    if VALUE(neighbor) ≤ VALUE(current) then return current
    current ← neighbor`,
  },
  annealing: {
    id: "annealing",
    name: "Simulated annealing",
    mode: "graph",
    frontier: "none",
    goalTest: "pop",
    goalLabel: "stop when T = 0",
    explored: "none",
    f: "—",
    line: "Pick a random neighbor. Accept it when ΔE > 0, otherwise with probability e^(ΔE/T). T cools on an exponential schedule.",
    pseudocode: `function SIMULATED-ANNEALING(problem, schedule)
  current ← problem.INITIAL
  for t = 0, 1, 2, … do
    T ← schedule(t)
    if T = 0 then return current
    next ← a random successor of current
    ΔE ← VALUE(next) − VALUE(current)
    if ΔE > 0 then current ← next
    else current ← next with probability e^(ΔE/T)`,
  },
  beam: {
    id: "beam",
    name: "Local beam search",
    mode: "graph",
    frontier: "none",
    goalTest: "pop",
    goalLabel: "any state in the pool is a goal",
    explored: "none",
    f: "—",
    line: "Keep k states. Each round, pool every successor of every state, then keep the best k of that one pool.",
    pseudocode: `function LOCAL-BEAM-SEARCH(problem, k)
  current ← k states
  loop do
    pool ← every successor of every state in current
    if any state in pool is a goal then return it
    current ← the k best states in pool`,
  },
  genetic: {
    id: "genetic",
    name: "Genetic algorithm",
    mode: "graph",
    frontier: "none",
    goalTest: "pop",
    goalLabel: "an individual reaches fitness 28",
    explored: "none",
    f: "—",
    line: "A population of 8-queens states. Select parents by fitness, cross over at a random gene, mutate with probability p, and replace the population.",
    pseudocode: `function GENETIC-ALGORITHM(population, fitness)
  repeat
    new ← empty
    for i = 1 to SIZE(population) do
      parent_a, parent_b ← FITNESS-WEIGHTED-SELECTION(population)
      child ← CROSSOVER(parent_a, parent_b) at a random point
      child ← MUTATE(child) with probability p
      add child to new
    population ← new`,
  },
};

export function selectionInfo(
  family: AlgorithmFamily,
  variant: VariantKind,
): AlgorithmInfo {
  const spec = familySpec(family);
  const mode: VariantKind =
    spec.control === "fixed" ? "graph" : spec.defaultVariant === null ? "tree" : variant;
  switch (family) {
    case "bfs":
      return INFO[mode === "tree" ? "bfs-tree" : "bfs-graph"];
    case "dfs":
      return INFO[mode === "tree" ? "dfs-tree" : "dfs-graph"];
    case "dls":
      return mode === "graph" ? DLS_GRAPH : INFO["depth-limited"];
    case "ids":
      return mode === "graph" ? IDS_GRAPH : INFO["iterative-deepening"];
    case "ucs":
    case "greedy":
    case "astar":
      return PRIORITY[family];
    case "hill-climbing":
    case "annealing":
    case "beam":
    case "genetic":
      return LOCAL[family];
  }
}

export function runSelection<S, A>(
  problem: Problem<S, A>,
  family: AlgorithmFamily,
  variant: VariantKind,
  options: { limit?: number; h?: (state: S) => number } = {},
): SearchResult<S, A> | null {
  const spec = familySpec(family);
  if (!spec.ready) return null;
  const mode: VariantKind = spec.control === "fixed" ? "graph" : variant;
  switch (family) {
    case "bfs":
      return mode === "tree"
        ? breadthFirstTreeSearch(problem, { expansionLimit: 400 })
        : breadthFirstGraphSearch(problem);
    case "dfs":
      return mode === "tree"
        ? depthFirstTreeSearch(problem, { expansionLimit: 12 })
        : depthFirstGraphSearch(problem);
    case "dls":
      return depthLimitedSearch(problem, options.limit ?? 2, mode);
    case "ids":
      return iterativeDeepeningSearch(problem, mode);
    case "ucs":
      return uniformCostSearch(problem, options.h);
    case "greedy":
      return options.h ? greedyBestFirstSearch(problem, options.h) : null;
    case "astar":
      return options.h ? aStarSearch(problem, options.h) : null;
    default:
      return null;
  }
}
