import type { FrontierItem, StepEvent } from "./types";

export interface TrailPoint {
  value: number;
  x: number | null;
}

export interface TreeEdge {
  key: string;
  parentId: number;
  childId: number;
  from: string;
  to: string;
  repeated: boolean;
}

export interface Frame {
  index: number;
  explored: string[];
  frontier: FrontierItem[];
  /** Solution path only. Empty until the goal is found. */
  path: string[];
  treeEdges: TreeEdge[];
  arrows: Array<{ from: string; to: string }>;
  status: "running" | "success" | "failure" | "cutoff" | "finished";
  cost: number | null;
  focusKey: string | null;
  repeatedKey: string | null;
  structure: StepEvent["structure"] | null;
  cutoff: string[];
  depths: Record<string, number>;
  limit: number | null;
  iteration: number | null;
  reexpanded: number | null;
  /** Latest g, h, f seen for a state. h is null when the search has no heuristic. */
  scores: Record<string, { g: number; h: number | null; f: number }>;
  /** State whose frontier node was just replaced. Only the current step. */
  replacedKey: string | null;
  /** Latest local-search step. Null for frontier search. */
  local: StepEvent | null;
  /** Objective after each local-search step, for the value chart. */
  trail: TrailPoint[];
  /** Temperature at each annealing step. */
  temps: number[];
  /** Mean fitness after each completed generation, including the initial population. */
  means: number[];
  objective: number | null;
}

interface Link {
  stateKey: string;
  parentId: number | null;
  g: number;
}

function walk(links: Map<number, Link>, id: number): string[] {
  const keys: string[] = [];
  let current: number | null = id;
  const seen = new Set<number>();
  while (current !== null) {
    if (seen.has(current)) break;
    seen.add(current);
    const link = links.get(current);
    if (!link) break;
    keys.push(link.stateKey);
    current = link.parentId;
  }
  return keys.reverse();
}

function emptyFrame(index: number): Frame {
  return {
    index,
    explored: [],
    frontier: [],
    path: [],
    treeEdges: [],
    arrows: [],
    status: "running",
    cost: null,
    focusKey: null,
    repeatedKey: null,
    structure: null,
    cutoff: [],
    depths: {},
    limit: null,
    iteration: null,
    reexpanded: null,
    scores: {},
    replacedKey: null,
    local: null,
    trail: [],
    temps: [],
    means: [],
    objective: null,
  };
}

function clearIteration(state: {
  links: Map<number, Link>;
  explored: string[];
  seen: Set<string>;
  treeEdges: TreeEdge[];
  edgeKeys: Set<string>;
  cutoff: string[];
  depths: Record<string, number>;
}) {
  state.links.clear();
  state.explored.length = 0;
  state.seen.clear();
  state.treeEdges.length = 0;
  state.edgeKeys.clear();
  state.cutoff.length = 0;
  for (const key of Object.keys(state.depths)) delete state.depths[key];
}

export function frameAt(trace: StepEvent[], index: number): Frame {
  if (trace.length === 0 || index < 0) return emptyFrame(index);

  const last = Math.min(index, trace.length - 1);
  const links = new Map<number, Link>();
  const explored: string[] = [];
  const seen = new Set<string>();
  const treeEdges: TreeEdge[] = [];
  const edgeKeys = new Set<string>();
  let frontier: FrontierItem[] = [];
  let status: Frame["status"] = "running";
  let goalId: number | null = null;
  let cost: number | null = null;
  let focusKey: string | null = null;
  let repeatedKey: string | null = null;
  let structure: Frame["structure"] = null;
  let arrows: Array<{ from: string; to: string }> = [];
  const cutoff: string[] = [];
  const depths: Record<string, number> = {};
  const scores: Record<string, { g: number; h: number | null; f: number }> = {};
  let replacedKey: string | null = null;
  let local: StepEvent | null = null;
  const trail: TrailPoint[] = [];
  const temps: number[] = [];
  const means: number[] = [];
  let objective: number | null = null;

  const remember = (
    key: string,
    g: number,
    h: number | null,
    f: number,
  ) => {
    scores[key] = { g, h, f };
  };
  const drawing = {
    links,
    explored,
    seen,
    treeEdges,
    edgeKeys,
    cutoff,
    depths,
  };

  for (let i = 0; i <= last; i += 1) {
    const event = trace[i];
    frontier = event.dataStructure;
    structure = event.structure;
    focusKey = event.focus;
    arrows =
      event.focus === null
        ? []
        : event.examining
            .filter((to) => to !== event.focus)
            .map((to) => ({ from: event.focus as string, to }));
    repeatedKey =
      event.vars.repeated && event.examining.length > 0
        ? event.examining[event.examining.length - 1]
        : null;
    replacedKey = event.type === "frontier-replace" ? event.stateKey : null;

    if (event.vars.depth !== null && event.focus) {
      depths[event.focus] = event.vars.depth;
    }

    switch (event.type) {
      case "restart":
        clearIteration(drawing);
        for (const key of Object.keys(scores)) delete scores[key];
        frontier = [];
        status = "running";
        goalId = null;
        cost = null;
        break;
      case "seed":
        links.set(event.nodeId, {
          stateKey: event.stateKey,
          parentId: null,
          g: event.g,
        });
        depths[event.stateKey] = event.depth;
        remember(event.stateKey, event.g, event.h, event.f);
        break;
      case "generate":
        links.set(event.nodeId, {
          stateKey: event.stateKey,
          parentId: event.parentId,
          g: event.g,
        });
        depths[event.stateKey] = event.depth;
        remember(event.stateKey, event.g, event.h, event.f);
        break;
      case "depth-cutoff":
        depths[event.stateKey] = event.depth;
        if (!cutoff.includes(event.stateKey)) cutoff.push(event.stateKey);
        break;
      case "frontier-add":
        if (event.parentId !== null && event.parentKey) {
          const key = `${event.parentId}:${event.parentKey}>${event.nodeId}:${event.stateKey}`;
          if (!edgeKeys.has(key)) {
            edgeKeys.add(key);
            treeEdges.push({
              key,
              parentId: event.parentId,
              childId: event.nodeId,
              from: event.parentKey,
              to: event.stateKey,
              repeated: event.vars.repeated,
            });
          }
        }
        remember(event.stateKey, event.g, event.h, event.f);
        break;
      case "expand":
        if (!seen.has(event.stateKey)) {
          seen.add(event.stateKey);
          explored.push(event.stateKey);
        }
        break;
      case "goal-check":
        if (event.isGoal) {
          status = "success";
          goalId = event.nodeId;
          cost = links.get(event.nodeId)?.g ?? null;
        }
        break;
      case "fail":
        status = "failure";
        break;
      case "cutoff":
        status = "cutoff";
        break;
      case "pop":
        depths[event.stateKey] = event.depth;
        remember(event.stateKey, event.g, event.h, event.f);
        break;
      case "frontier-replace": {
        remember(event.stateKey, event.g, event.h, event.f);
        for (let edge = treeEdges.length - 1; edge >= 0; edge -= 1) {
          const drawn = treeEdges[edge];
          if (drawn.childId === event.removedId || drawn.to === event.stateKey) {
            edgeKeys.delete(drawn.key);
            treeEdges.splice(edge, 1);
          }
        }
        const key = `${event.parentId}:${event.parentKey}>${event.addedId}:${event.stateKey}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          treeEdges.push({
            key,
            parentId: event.parentId,
            childId: event.addedId,
            from: event.parentKey,
            to: event.stateKey,
            repeated: false,
          });
        }
        links.set(event.addedId, {
          stateKey: event.stateKey,
          parentId: event.parentId,
          g: event.g,
        });
        break;
      }
      case "frontier-skip":
        break;
      case "climb": {
        local = event;
        if (trail.length === 0) {
          trail.push({ value: event.currentValue, x: event.currentX });
        }
        if (event.moved && event.bestValue !== null) {
          trail.push({ value: event.bestValue, x: event.bestX });
          objective = event.bestValue;
        } else {
          objective = event.currentValue;
        }
        status = event.goal ? "success" : event.stuck ? "finished" : "running";
        break;
      }
      case "anneal": {
        local = event;
        temps.push(event.temperature);
        if (trail.length === 0) {
          trail.push({ value: event.currentValue, x: event.currentX });
        }
        if (event.accepted && event.neighborValue !== null) {
          trail.push({ value: event.neighborValue, x: event.neighborX });
          objective = event.neighborValue;
        } else {
          objective = event.currentValue;
        }
        status = event.goal ? "success" : event.stopped ? "finished" : "running";
        break;
      }
      case "beam": {
        local = event;
        const shown = event.chosen;
        objective = shown.reduce((best, item) => Math.max(best, item.value), 0);
        if (event.round > 0 || trail.length === 0) {
          trail.push({ value: objective, x: null });
        }
        status = event.goal ? "success" : event.stopped ? "finished" : "running";
        break;
      }
      case "ga": {
        local = event;
        objective = event.meanFitness;
        if (event.birth === null || event.replaced) means.push(event.meanFitness);
        const best = Math.max(
          0,
          ...(event.replaced ? event.born : event.population).map((person) => person.fitness),
        );
        trail.push({ value: best, x: null });
        status = event.goal ? "success" : event.stopped ? "finished" : "running";
        break;
      }
    }
  }

  const current = trace[last];

  return {
    index: last,
    explored,
    frontier,
    path: status === "success" && goalId !== null ? walk(links, goalId) : [],
    treeEdges,
    arrows,
    status,
    cost: status === "success" ? cost : null,
    focusKey,
    repeatedKey,
    structure,
    cutoff,
    depths,
    limit: current.vars.limit,
    iteration: current.vars.iteration,
    reexpanded: current.vars.reexpanded,
    scores,
    replacedKey,
    local,
    trail,
    temps,
    means,
    objective,
  };
}

export function describeEvent(event: StepEvent): string {
  if (event.type === "climb") {
    return event.stuck ? "local maximum" : `climb ${event.currentValue} → ${event.bestValue}`;
  }
  if (event.type === "anneal") {
    if (event.stopped) return "T = 0";
    return event.accepted ? `accept ΔE ${event.deltaE}` : `reject ΔE ${event.deltaE}`;
  }
  if (event.type === "beam") return event.round === 0 ? "initial beam" : `beam round ${event.round}`;
  if (event.type === "ga") {
    return event.birth === null ? "initial population" : `generation ${event.generation}`;
  }
  const who = event.focus ?? "—";
  return `${event.phase} · ${who}`;
}
