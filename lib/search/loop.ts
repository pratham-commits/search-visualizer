import type { Frontier } from "./frontier";
import { childNode, createNode, isCycle, nodePath } from "./node";
import type {
  BareEvent,
  FrontierItem,
  Node,
  Phase,
  Problem,
  SearchPolicy,
  SearchResult,
  StepEvent,
} from "./types";

export function search<S, A>(
  problem: Problem<S, A>,
  frontier: Frontier<S, A>,
  policy: SearchPolicy<S, A>,
): SearchResult<S, A> {
  const trace: StepEvent[] = [];
  let nextId = 1;
  const reached = new Set<string>();
  const bestCost = new Map<string, number>();
  const noteCost = (key: string, g: number) => {
    if (!policy.scoreKind) return;
    const previous = bestCost.get(key);
    if (previous === undefined || g < previous) bestCost.set(key, g);
  };
  const generated = new Set<string>();
  let expansions = 0;
  let cutoffOccurred = false;
  const score = policy.f;
  const keyOf = (state: S) => problem.stateKey(state);
  const hOf = (node: Node<S, A>): number | null =>
    policy.heuristic ? policy.heuristic(node) : null;

  const snap = (): FrontierItem[] =>
    frontier.toArray().map((node) => ({
      id: node.id,
      stateKey: keyOf(node.state),
      g: node.pathCost,
      h: hOf(node),
      f: score(node),
      depth: node.depth,
    }));

  const decorate = (
    event: BareEvent,
    facts: {
      phase: Phase;
      focus: string | null;
      examining: string[];
      depth: number | null;
      repeated?: boolean;
      frontier: FrontierItem[];
    },
  ): StepEvent => ({
    ...event,
    phase: facts.phase,
    focus: facts.focus,
    examining: facts.examining,
    dataStructure: facts.frontier,
    nextOutId: facts.frontier[0]?.id ?? null,
    structure: frontier.kind,
    vars: {
      frontier: facts.frontier.map((item) => item.stateKey),
      reached: policy.mode === "graph" ? [...reached] : null,
      reachedCost: policy.scoreKind ? Object.fromEntries(bestCost) : null,
      depth: facts.depth,
      repeated: facts.repeated ?? false,
      limit: policy.depthLimit ?? null,
      iteration: null,
      reexpanded: null,
      scoreKind: policy.scoreKind ?? null,
    },
  });

  const push = (
    event: BareEvent,
    facts: {
      phase: Phase;
      focus: string | null;
      examining: string[];
      depth: number | null;
      repeated?: boolean;
      frontier: FrontierItem[];
    },
  ) => {
    trace.push(decorate(event, facts));
  };

  const succeed = (node: Node<S, A>): SearchResult<S, A> => ({
    status: "success",
    node,
    path: nodePath(node),
    cost: node.pathCost,
    trace,
  });

  const cutoff = (): SearchResult<S, A> => {
    push(
      { type: "cutoff", reason: "expansion" },
      {
        phase: "done",
        focus: null,
        examining: [],
        depth: null,
        frontier: snap(),
      },
    );
    return {
      status: "cutoff",
      node: null,
      path: [],
      cost: null,
      trace,
    };
  };

  const root = createNode<S, A>({
    id: nextId,
    state: problem.initial,
    parent: null,
    action: null,
    pathCost: 0,
    depth: 0,
  });
  nextId += 1;
  const rootKey = keyOf(root.state);
  if (policy.mode === "tree") generated.add(rootKey);

  push(
    {
      type: "seed",
      nodeId: root.id,
      stateKey: rootKey,
      g: root.pathCost,
      h: hOf(root),
      depth: root.depth,
      f: score(root),
      frontier: [],
    },
    {
      phase: "generate-child",
      focus: rootKey,
      examining: [],
      depth: 0,
      frontier: [],
    },
  );

  if (policy.isGoalWhen === "generate") {
    const isGoal = problem.isGoal(root.state);
    push(
      {
        type: "goal-check",
        nodeId: root.id,
        stateKey: rootKey,
        isGoal,
        when: "generate",
      },
      {
        phase: isGoal ? "done" : "is-goal",
        focus: rootKey,
        examining: [],
        depth: 0,
        frontier: [],
      },
    );
    if (isGoal) return succeed(root);
  }

  if (policy.mode === "graph") reached.add(rootKey);
  frontier.push(root);
  noteCost(rootKey, root.pathCost);
  push(
    {
      type: "frontier-add",
      nodeId: root.id,
      parentId: null,
      parentKey: null,
      stateKey: rootKey,
      g: root.pathCost,
      h: hOf(root),
      parentG: null,
      f: score(root),
      frontier: snap(),
    },
    {
      phase: "generate-child",
      focus: rootKey,
      examining: [],
      depth: 0,
      frontier: snap(),
    },
  );

  while (!frontier.isEmpty()) {
    if (
      policy.expansionLimit !== undefined &&
      expansions >= policy.expansionLimit
    ) {
      return cutoff();
    }

    const node = frontier.pop();
    const nodeKey = keyOf(node.state);
    push(
      {
        type: "pop",
        nodeId: node.id,
        stateKey: nodeKey,
        g: node.pathCost,
        h: hOf(node),
        depth: node.depth,
        f: score(node),
        frontier: snap(),
      },
      {
        phase: "pop",
        focus: nodeKey,
        examining: [],
        depth: node.depth,
        frontier: snap(),
      },
    );

    if (policy.isGoalWhen === "pop") {
      const isGoal = problem.isGoal(node.state);
      push(
        {
          type: "goal-check",
          nodeId: node.id,
          stateKey: nodeKey,
          isGoal,
          when: "pop",
        },
        {
          phase: isGoal ? "done" : "is-goal",
          focus: nodeKey,
          examining: [],
          depth: node.depth,
          frontier: snap(),
        },
      );
      if (isGoal) return succeed(node);
    }

    if (
      policy.depthLimit !== undefined &&
      node.depth > policy.depthLimit
    ) {
      cutoffOccurred = true;
      push(
        {
          type: "depth-cutoff",
          nodeId: node.id,
          stateKey: nodeKey,
          depth: node.depth,
          limit: policy.depthLimit,
        },
        {
          phase: "cutoff",
          focus: nodeKey,
          examining: [],
          depth: node.depth,
          frontier: snap(),
        },
      );
      continue;
    }

    expansions += 1;
    const actions = problem.actions(node.state);
    const neighborKeys = actions.map((action) =>
      keyOf(problem.result(node.state, action)),
    );
    push(
      { type: "expand", nodeId: node.id, stateKey: nodeKey },
      {
        phase: "examine-neighbors",
        focus: nodeKey,
        examining: neighborKeys,
        depth: node.depth,
        frontier: snap(),
      },
    );

    const ordered = policy.firstActionFirst ? [...actions].reverse() : actions;
    for (const action of ordered) {
      const child = childNode(problem, node, action, nextId);
      nextId += 1;
      const childKey = keyOf(child.state);
      const cycle = policy.mode === "tree" && isCycle(child, keyOf);
      const otherBranch =
        policy.mode === "tree" && !cycle && generated.has(childKey);
      if (policy.mode === "tree") generated.add(childKey);
      push(
        {
          type: "generate",
          nodeId: child.id,
          parentId: node.id,
          stateKey: childKey,
          action: String(action),
          g: child.pathCost,
          h: hOf(child),
          parentG: node.pathCost,
          depth: child.depth,
          f: score(child),
        },
        {
          phase: "generate-child",
          focus: nodeKey,
          examining: [childKey],
          depth: node.depth,
          repeated: otherBranch,
          frontier: snap(),
        },
      );

      if (cycle) {
        push(
          {
            type: "frontier-skip",
            nodeId: child.id,
            stateKey: childKey,
            reason: "cycle",
          },
          {
            phase: "repeated-state",
            focus: nodeKey,
            examining: [childKey],
            depth: node.depth,
            repeated: true,
            frontier: snap(),
          },
        );
        continue;
      }

      if (policy.isGoalWhen === "generate") {
        const isGoal = problem.isGoal(child.state);
        push(
          {
            type: "goal-check",
            nodeId: child.id,
            stateKey: childKey,
            isGoal,
            when: "generate",
          },
          {
            phase: isGoal ? "done" : "is-goal",
            focus: childKey,
            examining: [],
            depth: child.depth,
            frontier: snap(),
          },
        );
        if (isGoal) return succeed(child);
      }

      if (policy.mode === "graph" && frontier.containsState(childKey)) {
        const incumbent = frontier.getByState(childKey);
        if (
          incumbent &&
          policy.replaceFrontier === "if-lower-f" &&
          score(child) < score(incumbent)
        ) {
          frontier.replace(childKey, child);
          noteCost(childKey, child.pathCost);
          push(
            {
              type: "frontier-replace",
              removedId: incumbent.id,
              addedId: child.id,
              parentId: node.id,
              parentKey: nodeKey,
              stateKey: childKey,
              g: child.pathCost,
              h: hOf(child),
              previousG: incumbent.pathCost,
              previousF: score(incumbent),
              f: score(child),
              frontier: snap(),
            },
            {
              phase: "generate-child",
              focus: nodeKey,
              examining: [childKey],
              depth: node.depth,
              frontier: snap(),
            },
          );
        } else {
          push(
            {
              type: "frontier-skip",
              nodeId: child.id,
              stateKey: childKey,
              reason:
                policy.replaceFrontier === "if-lower-f"
                  ? "worse-f"
                  : "in-frontier",
            },
            {
              phase: "repeated-state",
              focus: nodeKey,
              examining: [childKey],
              depth: node.depth,
              repeated: true,
              frontier: snap(),
            },
          );
        }
        continue;
      }

      if (policy.mode === "graph" && reached.has(childKey)) {
        // 4e best-first pushes the child again when PATH-COST is lower than reached[state].
        const previousCost = bestCost.get(childKey);
        if (
          policy.scoreKind &&
          previousCost !== undefined &&
          child.pathCost < previousCost
        ) {
          noteCost(childKey, child.pathCost);
          frontier.push(child);
          const reopened = snap();
          push(
            {
              type: "frontier-add",
              nodeId: child.id,
              parentId: node.id,
              parentKey: nodeKey,
              stateKey: childKey,
              g: child.pathCost,
              h: hOf(child),
              parentG: node.pathCost,
              f: score(child),
              frontier: reopened,
            },
            {
              phase: "generate-child",
              focus: nodeKey,
              examining: [childKey],
              depth: node.depth,
              frontier: reopened,
            },
          );
          continue;
        }
        push(
          {
            type: "frontier-skip",
            nodeId: child.id,
            stateKey: childKey,
            reason: "reached",
          },
          {
            phase: "repeated-state",
            focus: nodeKey,
            examining: [childKey],
            depth: node.depth,
            repeated: true,
            frontier: snap(),
          },
        );
        continue;
      }

      if (policy.mode === "graph") reached.add(childKey);
      frontier.push(child);
      noteCost(childKey, child.pathCost);
      const after = snap();
      push(
        {
          type: "frontier-add",
          nodeId: child.id,
          parentId: node.id,
          parentKey: nodeKey,
          stateKey: childKey,
          g: child.pathCost,
          h: hOf(child),
          parentG: node.pathCost,
          f: score(child),
          frontier: after,
        },
        {
          phase: otherBranch ? "repeated-state" : "generate-child",
          focus: nodeKey,
          examining: [childKey],
          depth: node.depth,
          repeated: otherBranch,
          frontier: after,
        },
      );
    }
  }

  if (cutoffOccurred) {
    push(
      { type: "cutoff", reason: "depth" },
      {
        phase: "done",
        focus: null,
        examining: [],
        depth: null,
        frontier: [],
      },
    );
    return {
      status: "cutoff",
      node: null,
      path: [],
      cost: null,
      trace,
    };
  }

  push(
    { type: "fail" },
    {
      phase: "done",
      focus: null,
      examining: [],
      depth: null,
      frontier: [],
    },
  );
  return {
    status: "failure",
    node: null,
    path: [],
    cost: null,
    trace,
  };
}
