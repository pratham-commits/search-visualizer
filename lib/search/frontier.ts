import type { Node } from "./types";

export interface Frontier<S, A> {
  readonly kind: "fifo" | "lifo" | "priority";
  isEmpty(): boolean;
  push(node: Node<S, A>): void;
  pop(): Node<S, A>;
  containsState(stateKey: string): boolean;
  getByState(stateKey: string): Node<S, A> | undefined;
  replace(stateKey: string, node: Node<S, A>): void;
  /** Nodes in the order they would be popped. */
  toArray(): Node<S, A>[];
}

interface Entry<S, A> {
  node: Node<S, A>;
  stateKey: string;
}

export class FifoFrontier<S, A> implements Frontier<S, A> {
  readonly kind = "fifo" as const;
  private items: Entry<S, A>[] = [];

  constructor(private readonly stateKey: (state: S) => string) {}

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(node: Node<S, A>): void {
    this.items.push({ node, stateKey: this.stateKey(node.state) });
  }

  pop(): Node<S, A> {
    const item = this.items.shift();
    if (!item) throw new Error("Frontier is empty");
    return item.node;
  }

  containsState(stateKey: string): boolean {
    return this.items.some((item) => item.stateKey === stateKey);
  }

  getByState(stateKey: string): Node<S, A> | undefined {
    return this.items.find((item) => item.stateKey === stateKey)?.node;
  }

  replace(stateKey: string, node: Node<S, A>): void {
    const index = this.items.findIndex((item) => item.stateKey === stateKey);
    if (index !== -1) this.items.splice(index, 1);
    this.push(node);
  }

  toArray(): Node<S, A>[] {
    return this.items.map((item) => item.node);
  }
}

export class LifoFrontier<S, A> implements Frontier<S, A> {
  readonly kind = "lifo" as const;
  private items: Entry<S, A>[] = [];

  constructor(private readonly stateKey: (state: S) => string) {}

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(node: Node<S, A>): void {
    this.items.push({ node, stateKey: this.stateKey(node.state) });
  }

  pop(): Node<S, A> {
    const item = this.items.pop();
    if (!item) throw new Error("Frontier is empty");
    return item.node;
  }

  containsState(stateKey: string): boolean {
    return this.items.some((item) => item.stateKey === stateKey);
  }

  getByState(stateKey: string): Node<S, A> | undefined {
    return this.items.find((item) => item.stateKey === stateKey)?.node;
  }

  replace(stateKey: string, node: Node<S, A>): void {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      if (this.items[i].stateKey === stateKey) {
        this.items.splice(i, 1);
        break;
      }
    }
    this.push(node);
  }

  toArray(): Node<S, A>[] {
    return this.items.map((item) => item.node).reverse();
  }
}

interface HeapEntry<S, A> {
  node: Node<S, A>;
  stateKey: string;
  f: number;
  seq: number;
}

export class PriorityFrontier<S, A> implements Frontier<S, A> {
  readonly kind = "priority" as const;
  private heap: HeapEntry<S, A>[] = [];
  private seq = 0;

  constructor(
    private readonly stateKey: (state: S) => string,
    private readonly score: (node: Node<S, A>) => number,
  ) {}

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(node: Node<S, A>): void {
    this.heap.push({
      node,
      stateKey: this.stateKey(node.state),
      f: this.score(node),
      seq: this.seq,
    });
    this.seq += 1;
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): Node<S, A> {
    if (this.heap.length === 0) throw new Error("Frontier is empty");
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top.node;
  }

  containsState(stateKey: string): boolean {
    return this.heap.some((entry) => entry.stateKey === stateKey);
  }

  getByState(stateKey: string): Node<S, A> | undefined {
    return this.heap.find((entry) => entry.stateKey === stateKey)?.node;
  }

  replace(stateKey: string, node: Node<S, A>): void {
    const index = this.heap.findIndex((entry) => entry.stateKey === stateKey);
    if (index !== -1) this.removeAt(index);
    this.push(node);
  }

  toArray(): Node<S, A>[] {
    return [...this.heap]
      .sort((a, b) => a.f - b.f || a.seq - b.seq)
      .map((entry) => entry.node);
  }

  private removeAt(index: number): void {
    const last = this.heap.pop()!;
    if (index === this.heap.length) return;
    this.heap[index] = last;
    this.bubbleDown(index);
    this.bubbleUp(index);
  }

  private less(i: number, j: number): boolean {
    const a = this.heap[i];
    const b = this.heap[j];
    if (a.f !== b.f) return a.f < b.f;
    return a.seq < b.seq;
  }

  private bubbleUp(index: number): void {
    let cursor = index;
    while (cursor > 0) {
      const parent = Math.floor((cursor - 1) / 2);
      if (!this.less(cursor, parent)) break;
      this.swap(cursor, parent);
      cursor = parent;
    }
  }

  private bubbleDown(index: number): void {
    let cursor = index;
    const length = this.heap.length;
    while (true) {
      let smallest = cursor;
      const left = cursor * 2 + 1;
      const right = left + 1;
      if (left < length && this.less(left, smallest)) smallest = left;
      if (right < length && this.less(right, smallest)) smallest = right;
      if (smallest === cursor) break;
      this.swap(cursor, smallest);
      cursor = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const tmp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = tmp;
  }
}

export type FrontierKind = "fifo" | "lifo" | "priority";

export function createFrontier<S, A>(
  kind: FrontierKind,
  stateKey: (state: S) => string,
  f: (node: Node<S, A>) => number,
): Frontier<S, A> {
  if (kind === "fifo") return new FifoFrontier(stateKey);
  if (kind === "lifo") return new LifoFrontier(stateKey);
  return new PriorityFrontier(stateKey, f);
}
