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
  { n: 1, id: "bfs-tree", name: "Breadth-first tree-like" },
  { n: 2, id: "bfs-graph", name: "Breadth-first graph" },
  { n: 3, id: "dfs-tree", name: "Depth-first tree-like" },
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
  isGoalWhen: "pop" | "generate";
  reached: string;
  f: string;
  /** Replaces the on-pop / on-generate phrase when the algorithm has no frontier. */
  goalLabel?: string;
}

const INFO: Record<AlgorithmId, AlgorithmInfo> = {
  "bfs-tree": {
    id: "bfs-tree",
    name: "Breadth-first tree-like",
    line: "FIFO queue. IS-GOAL when a node is popped. No reached table; IS-CYCLE checks ancestors.",
    frontier: "FIFO queue",
    mode: "tree",
    isGoalWhen: "pop",
    reached: "none — tree-like search",
    f: "n/a (FIFO order)",
    pseudocode: `function BREADTH-FIRST-SEARCH(problem) returns a solution node or failure
  node ← NODE(problem.INITIAL)
  frontier ← a FIFO queue, with node as an element
  while not IS-EMPTY(frontier) do
    node ← POP(frontier)
    if problem.IS-GOAL(node.STATE) then return node
    if not IS-CYCLE(node) then
      for each child in EXPAND(problem, node) do
        add child to frontier
  return failure`,
  },
  "bfs-graph": {
    id: "bfs-graph",
    name: "Breadth-first graph",
    line: "FIFO queue and a reached set. IS-GOAL runs early, when a child is generated.",
    frontier: "FIFO queue",
    mode: "graph",
    isGoalWhen: "generate",
    reached: "reached set",
    f: "n/a (FIFO order)",
    pseudocode: `function BREADTH-FIRST-SEARCH(problem) returns a solution node or failure
  node ← NODE(problem.INITIAL)
  if problem.IS-GOAL(node.STATE) then return node
  frontier ← a FIFO queue, with node as an element
  reached ← {problem.INITIAL}
  while not IS-EMPTY(frontier) do
    node ← POP(frontier)
    for each child in EXPAND(problem, node) do
      s ← child.STATE
      if problem.IS-GOAL(s) then return child
      if s is not in reached then
        add s to reached
        add child to frontier
  return failure`,
  },
  "dfs-tree": {
    id: "dfs-tree",
    name: "Depth-first tree-like",
    line: "LIFO stack. IS-GOAL on pop. No reached table; IS-CYCLE(node) checks ancestors.",
    frontier: "LIFO stack",
    mode: "tree",
    isGoalWhen: "pop",
    reached: "none — tree-like search",
    f: "n/a (LIFO order)",
    pseudocode: `function DEPTH-FIRST-SEARCH(problem) returns a solution node or failure
  node ← NODE(problem.INITIAL)
  frontier ← a LIFO queue, with node as an element
  while not IS-EMPTY(frontier) do
    node ← POP(frontier)
    if problem.IS-GOAL(node.STATE) then return node
    if not IS-CYCLE(node) then
      for each child in EXPAND(problem, node) do
        add child to frontier
  return failure`,
  },
  "dfs-graph": {
    id: "dfs-graph",
    name: "Depth-first graph",
    line: "LIFO stack. IS-GOAL on pop. The reached set keeps the first path to a state.",
    frontier: "LIFO stack",
    mode: "graph",
    isGoalWhen: "pop",
    reached: "reached set, first path kept",
    f: "n/a (LIFO order)",
    pseudocode: `function DEPTH-FIRST-SEARCH(problem) returns a solution node or failure
  node ← NODE(problem.INITIAL)
  frontier ← a LIFO queue, with node as an element
  reached ← {problem.INITIAL}
  while not IS-EMPTY(frontier) do
    node ← POP(frontier)
    if problem.IS-GOAL(node.STATE) then return node
    for each child in EXPAND(problem, node) do
      s ← child.STATE
      if s is not in reached then
        add s to reached
        add child to frontier
  return failure`,
  },
  "depth-limited": {
    id: "depth-limited",
    name: "Depth-limited",
    line: "LIFO frontier with limit ℓ. Return the cutoff sentinel at the limit. IS-CYCLE avoids cycles.",
    frontier: "LIFO stack",
    mode: "tree",
    isGoalWhen: "pop",
    reached: "none — tree-like search",
    f: "n/a (LIFO order)",
    pseudocode: `function DEPTH-LIMITED-SEARCH(problem, ℓ) returns a node or failure or cutoff
  frontier ← a LIFO queue, with NODE(problem.INITIAL) as an element
  result ← failure
  while not IS-EMPTY(frontier) do
    node ← POP(frontier)
    if problem.IS-GOAL(node.STATE) then return node
    if DEPTH(node) > ℓ then result ← cutoff
    else if not IS-CYCLE(node) then
      for each child in EXPAND(problem, node) do
        add child to frontier
  return result`,
  },
  "iterative-deepening": {
    id: "iterative-deepening",
    name: "Iterative deepening",
    line: "Depth-limited search for ℓ = 0, 1, 2, …, starting over after each cutoff.",
    frontier: "LIFO stack",
    mode: "tree",
    isGoalWhen: "pop",
    reached: "none — each iteration is a fresh tree-like search",
    f: "n/a (LIFO order)",
    pseudocode: `function ITERATIVE-DEEPENING-SEARCH(problem) returns a solution node or failure
  for depth = 0 to ∞ do
    result ← DEPTH-LIMITED-SEARCH(problem, depth)
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
    isGoalWhen: "pop",
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
    isGoalWhen: "generate",
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
    isGoalWhen: "pop",
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
    isGoalWhen: "pop",
    replaceFrontier: "never",
    f: (node) => node.pathCost,
  });
}

export interface BestFirstOptions<S, A> {
  heuristic?: (node: Node<S, A>) => number;
  scoreKind: "g" | "h" | "g+h";
}

/** Best-first graph search: min-f, IS-GOAL on pop, replace a frontier node when f is lower. */
export function bestFirstGraphSearch<S, A>(
  problem: Problem<S, A>,
  f: (node: Node<S, A>) => number,
  options: BestFirstOptions<S, A>,
): SearchResult<S, A> {
  return search(problem, new PriorityFrontier(problem.stateKey, f), {
    mode: "graph",
    isGoalWhen: "pop",
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
    isGoalWhen: "pop",
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
        reached: mode === "graph" ? [] : null,
        reachedCost: null,
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
  "graph variant keeps a reached set; classic IDS/DLS is tree-like search, for low memory.";

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
  line: "Depth-limited search with a reached set. A state already reached, or still in the frontier, is not pushed again.",
  frontier: "LIFO stack",
  mode: "graph",
  isGoalWhen: "pop",
  reached: "reached set — each state once",
  f: "n/a (LIFO order)",
  pseudocode: `function DEPTH-LIMITED-SEARCH(problem, ℓ) returns a node or failure or cutoff
  frontier ← a LIFO queue, with NODE(problem.INITIAL) as an element
  reached ← {problem.INITIAL}
  result ← failure
  while not IS-EMPTY(frontier) do
    node ← POP(frontier)
    if problem.IS-GOAL(node.STATE) then return node
    if DEPTH(node) > ℓ then result ← cutoff
    else for each child in EXPAND(problem, node) do
      s ← child.STATE
      if s is not in reached then
        add s to reached
        add child to frontier
  return result`,
};

const IDS_GRAPH: AlgorithmInfo = {
  id: "iterative-deepening",
  name: "Iterative deepening",
  line: "Depth-limited graph search for ℓ = 0, 1, 2, …. Each iteration starts over and keeps a reached set.",
  frontier: "LIFO stack",
  mode: "graph",
  isGoalWhen: "pop",
  reached: "reached set — each state once per iteration",
  f: "n/a (LIFO order)",
  pseudocode: `function ITERATIVE-DEEPENING-SEARCH(problem) returns a solution node or failure
  for depth = 0 to ∞ do
    result ← DEPTH-LIMITED-SEARCH(problem, depth)
    if result ≠ cutoff then return result`,
};

const BEST_FIRST = `function BEST-FIRST-SEARCH(problem, f) returns a solution node or failure
  node ← NODE(STATE=problem.INITIAL)
  frontier ← a priority queue ordered by f, with node as an element
  reached ← a lookup table, with one entry with key problem.INITIAL and value node
  while not IS-EMPTY(frontier) do
    node ← POP(frontier)
    if problem.IS-GOAL(node.STATE) then return node
    for each child in EXPAND(problem, node) do
      s ← child.STATE
      if s is not in reached or child.PATH-COST < reached[s].PATH-COST then
        reached[s] ← child
        add child to frontier
  return failure`;

const PRIORITY: Record<"ucs" | "greedy" | "astar", AlgorithmInfo> = {
  ucs: {
    id: "ucs",
    name: "Uniform-cost",
    mode: "graph",
    frontier: "priority queue ordered by PATH-COST",
    isGoalWhen: "pop",
    reached: "state → best PATH-COST",
    f: "PATH-COST (g)",
    line: "Best-first search with f = PATH-COST. Also known as Dijkstra's algorithm. A cheaper path replaces the node already in reached.",
    pseudocode: `f ← PATH-COST    // g(n). Uniform-cost search is Dijkstra's algorithm.

${BEST_FIRST}`,
  },
  greedy: {
    id: "greedy",
    name: "Greedy best-first",
    mode: "graph",
    frontier: "priority queue ordered by h",
    isGoalWhen: "pop",
    reached: "state → best PATH-COST",
    f: "h",
    line: "Best-first search with f = h. Not optimal: h ignores the cost already paid.",
    pseudocode: `f ← h

${BEST_FIRST}`,
  },
  astar: {
    id: "astar",
    name: "A*",
    mode: "graph",
    frontier: "priority queue ordered by g + h",
    isGoalWhen: "pop",
    reached: "state → best PATH-COST",
    f: "g + h",
    line: "Best-first search with f = g + h. A lower f already in the frontier replaces the old node, and reached keeps the cheaper PATH-COST.",
    pseudocode: `f ← g + h

${BEST_FIRST}`,
  },
};

const LOCAL: Record<"hill-climbing" | "annealing" | "beam" | "genetic", AlgorithmInfo> = {
  "hill-climbing": {
    id: "hill-climbing",
    name: "Hill climbing",
    mode: "graph",
    frontier: "none",
    isGoalWhen: "pop",
    goalLabel: "stop at a local maximum",
    reached: "none",
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
    isGoalWhen: "pop",
    goalLabel: "stop when T = 0",
    reached: "none",
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
    isGoalWhen: "pop",
    goalLabel: "any state in the pool is a goal",
    reached: "none",
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
    isGoalWhen: "pop",
    goalLabel: "an individual reaches fitness 28",
    reached: "none",
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
