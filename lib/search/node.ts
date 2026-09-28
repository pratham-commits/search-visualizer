import type { Node, Problem } from "./types";

export function createNode<S, A>(fields: Node<S, A>): Node<S, A> {
  return fields;
}

export function childNode<S, A>(
  problem: Problem<S, A>,
  parent: Node<S, A>,
  action: A,
  id: number,
): Node<S, A> {
  const state = problem.result(parent.state, action);
  return {
    id,
    state,
    parent,
    action,
    pathCost: parent.pathCost + problem.actionCost(parent.state, action, state),
    depth: parent.depth + 1,
  };
}

/** True when `node.STATE` already appears on the path from its parent to the root. */
export function isCycle<S, A>(
  node: Node<S, A>,
  stateKey: (state: S) => string,
): boolean {
  const key = stateKey(node.state);
  let ancestor = node.parent;
  while (ancestor) {
    if (stateKey(ancestor.state) === key) return true;
    ancestor = ancestor.parent;
  }
  return false;
}

export function nodePath<S, A>(node: Node<S, A>): S[] {
  const states: S[] = [];
  let current: Node<S, A> | null = node;
  while (current) {
    states.push(current.state);
    current = current.parent;
  }
  return states.reverse();
}
