export interface Problem<S, A> {
  initial: S;
  actions(state: S): A[];
  result(state: S, action: A): S;
  actionCost(state: S, action: A, next: S): number;
  isGoal(state: S): boolean;
  stateKey(state: S): string;
}

export interface Node<S, A> {
  id: number;
  state: S;
  parent: Node<S, A> | null;
  action: A | null;
  pathCost: number;
  depth: number;
}

export type SearchMode = "tree" | "graph";
export type IsGoalWhen = "pop" | "generate";
export type ReplaceFrontier = "never" | "if-lower-f";

/**
 * The frontier is the only data structure that changes between algorithms.
 * Tree-like vs graph, when IS-GOAL runs, and whether a cheaper frontier
 * node is replaced are book behaviors a queue cannot encode, so they sit
 * here beside it. `depthLimit` is depth-limited search: a node at that
 * depth is tested with IS-GOAL and then not expanded. `firstActionFirst` pushes
 * children so the first action is popped first, matching aima-python's
 * recursive depth-limited search.
 */
export interface SearchPolicy<S, A> {
  mode: SearchMode;
  isGoalWhen: IsGoalWhen;
  replaceFrontier: ReplaceFrontier;
  f: (node: Node<S, A>) => number;
  /** Optional h(n). Best-first labels and exam arithmetic read it from here. */
  heuristic?: (node: Node<S, A>) => number;
  /**
   * How the step text should print the priority. Unset for uninformed search.
   * `g` is uniform-cost, `h` is greedy, `g+h` is A*.
   */
  scoreKind?: "g" | "h" | "g+h";
  depthLimit?: number;
  /** Safety backstop. IS-CYCLE is what stops a tree-like search from looping. */
  expansionLimit?: number;
  firstActionFirst?: boolean;
}

export interface FrontierItem {
  id: number;
  stateKey: string;
  g: number;
  /** Null when the algorithm has no heuristic. */
  h: number | null;
  f: number;
  depth: number;
}

export type Phase =
  | "pop"
  | "examine-neighbors"
  | "generate-child"
  | "is-goal"
  | "repeated-state"
  | "cutoff"
  | "restart"
  | "done"
  | "local";

export interface StepFacts {
  phase: Phase;
  /** State being examined, such as "Arad" or "0,0". */
  focus: string | null;
  /** Successors generated or considered on this step. */
  examining: string[];
  /** Frontier after this step, in pop order. Index 0 is the next out. */
  dataStructure: FrontierItem[];
  nextOutId: number | null;
  structure: "fifo" | "lifo" | "priority" | "none";
  vars: {
    frontier: string[];
    /**
     * Null for tree-like search, which keeps no reached table.
     * Graph search: the states recorded so far.
     */
    reached: string[] | null;
    /**
     * Best PATH-COST for each reached state. Set for uniform-cost, greedy,
     * and A*, where reached is a table. Null when reached is only a set.
     */
    reachedCost: Record<string, number> | null;
    depth: number | null;
    repeated: boolean;
    /** Depth bound for this step. Null for uninformed BFS and DFS. */
    limit: number | null;
    /** IDS iteration, equal to the limit of that restart. Null otherwise. */
    iteration: number | null;
    /** Expansions in this IDS iteration of a state expanded in an earlier one. */
    reexpanded: number | null;
    /** Null for uninformed search. Otherwise which quantity the frontier sorts by. */
    scoreKind: "g" | "h" | "g+h" | null;
  };
}

export type BareEvent =
  | {
      type: "seed";
      nodeId: number;
      stateKey: string;
      g: number;
      h: number | null;
      depth: number;
      f: number;
      frontier: FrontierItem[];
    }
  | {
      type: "pop";
      nodeId: number;
      stateKey: string;
      g: number;
      h: number | null;
      depth: number;
      f: number;
      frontier: FrontierItem[];
    }
  | {
      type: "goal-check";
      nodeId: number;
      stateKey: string;
      isGoal: boolean;
      when: IsGoalWhen;
    }
  | {
      type: "expand";
      nodeId: number;
      stateKey: string;
    }
  | {
      type: "generate";
      nodeId: number;
      parentId: number;
      stateKey: string;
      action: string;
      g: number;
      h: number | null;
      parentG: number;
      depth: number;
      f: number;
    }
  | {
      type: "frontier-add";
      nodeId: number;
      parentId: number | null;
      parentKey: string | null;
      stateKey: string;
      g: number;
      h: number | null;
      parentG: number | null;
      f: number;
      frontier: FrontierItem[];
    }
  | {
      type: "frontier-replace";
      removedId: number;
      addedId: number;
      parentId: number;
      parentKey: string;
      stateKey: string;
      g: number;
      h: number | null;
      previousG: number;
      previousF: number;
      f: number;
      frontier: FrontierItem[];
    }
  | {
      type: "frontier-skip";
      nodeId: number;
      stateKey: string;
      reason: "reached" | "worse-f" | "in-frontier" | "cycle";
    }
  | { type: "fail" }
  | { type: "cutoff"; reason: "expansion" | "depth" }
  | {
      type: "depth-cutoff";
      nodeId: number;
      stateKey: string;
      depth: number;
      limit: number;
    }
  | { type: "restart"; limit: number; iteration: number }
  | ClimbEvent
  | AnnealEvent
  | BeamEvent
  | GaEvent;

/** One queen column per row. Null on the landscape, where `x` is the coordinate. */
export interface ClimbEvent {
  type: "climb";
  currentKey: string;
  currentValue: number;
  currentQueens: number[] | null;
  currentX: number | null;
  bestKey: string | null;
  bestValue: number | null;
  bestQueens: number[] | null;
  bestX: number | null;
  neighborCount: number;
  moved: boolean;
  stuck: boolean;
  goal: boolean;
  /** This step moved to an equal-valued neighbor. */
  sideways: boolean;
  /** Consecutive sideways moves after this step. 0 when this step is not sideways. */
  sidewaysCount: number;
  /** Cap in force, or null when sideways moves are off. */
  sidewaysLimit: number | null;
}

export interface AnnealEvent {
  type: "anneal";
  currentKey: string;
  currentValue: number;
  currentQueens: number[] | null;
  currentX: number | null;
  neighborKey: string | null;
  neighborValue: number | null;
  neighborQueens: number[] | null;
  neighborX: number | null;
  deltaE: number | null;
  temperature: number;
  temperatureMax: number;
  /** Null when the step is uphill, or when temperature has hit 0. */
  acceptProbability: number | null;
  /** Uniform draw in [0, 1). Null when it was not consulted. */
  randomDraw: number | null;
  accepted: boolean;
  stopped: boolean;
  step: number;
  goal: boolean;
}

export interface BeamMember {
  key: string;
  value: number;
  queens: number[] | null;
  x: number | null;
  parentKey: string | null;
}

export interface BeamEvent {
  type: "beam";
  k: number;
  round: number;
  current: BeamMember[];
  pool: BeamMember[];
  chosen: BeamMember[];
  goal: boolean;
  stopped: boolean;
}

export interface GaIndividual {
  genes: number[];
  fitness: number;
}

export interface GaBirth {
  parentA: number[];
  parentB: number[];
  fitnessA: number;
  fitnessB: number;
  crossover: number;
  mutatedIndex: number | null;
  mutatedFrom: number | null;
  mutatedTo: number | null;
  child: number[];
  childFitness: number;
}

export interface GaEvent {
  type: "ga";
  generation: number;
  population: GaIndividual[];
  meanFitness: number;
  birth: GaBirth | null;
  born: GaIndividual[];
  replaced: boolean;
  goal: boolean;
  stopped: boolean;
  popSize: number;
}

export type StepEvent = BareEvent & StepFacts;

export interface SearchResult<S, A> {
  status: "success" | "failure" | "cutoff";
  node: Node<S, A> | null;
  path: S[];
  cost: number | null;
  trace: StepEvent[];
}
