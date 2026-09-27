import type { Frame } from "@/lib/search";

export function marksFor(key: string, frame: Frame, wall = false) {
  const explored = frame.explored.includes(key);
  const frontier = frame.frontier.some((item) => item.stateKey === key);
  const solution = frame.path.includes(key);
  const current = frame.focusKey === key;
  const repeated = frame.repeatedKey === key;
  const cutoff = frame.cutoff.includes(key);
  return { explored, frontier, solution, current, repeated, cutoff, wall };
}

export function frontierG(key: string, frame: Frame): number | null {
  const item = frame.frontier.find((entry) => entry.stateKey === key);
  return item ? item.g : null;
}

export function nodeScore(
  key: string,
  frame: Frame,
): { g: number; h: number | null; f: number } | null {
  const item = frame.frontier.find((entry) => entry.stateKey === key);
  if (item) return { g: item.g, h: item.h, f: item.f };
  return frame.scores[key] ?? null;
}
