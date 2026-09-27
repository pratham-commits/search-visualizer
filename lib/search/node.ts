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
    pathCost: parent.pathCost + problem.stepCost(parent.state, action, state),
    depth: parent.depth + 1,
  };
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
