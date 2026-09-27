import type { LocalProblem } from "../local";

/**
 * A one-dimensional objective with two peaks.
 * Index 4 is a local maximum (value 5). Index 14 is the global maximum (value 10).
 * Hill climbing from 0 climbs to 4 and stops. The valley at 8 is what annealing has to cross.
 */
export const LANDSCAPE_VALUES = [
  1, 2, 3, 4, 5, 4, 2, 1, 0, 1, 2, 4, 6, 8, 10, 8, 6, 4, 2, 1,
];

export const LANDSCAPE_START = 0;

export const LANDSCAPE_LOCAL_MAX = 4;

export const LANDSCAPE_GLOBAL_MAX = 14;

export function landscapeProblem(): LocalProblem<number> {
  const last = LANDSCAPE_VALUES.length - 1;
  const global = LANDSCAPE_VALUES.indexOf(Math.max(...LANDSCAPE_VALUES));
  return {
    kind: "landscape",
    neighbors(x) {
      const next: number[] = [];
      if (x > 0) next.push(x - 1);
      if (x < last) next.push(x + 1);
      return next;
    },
    value: (x) => LANDSCAPE_VALUES[x],
    goalTest: (x) => x === global,
    key: (x) => `x:${x}`,
    coordinate: (x) => x,
    queens: () => null,
    random: () => LANDSCAPE_START,
    genePool: [],
  };
}
