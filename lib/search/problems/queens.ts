import type { LocalProblem } from "../local";

/** Pairs of queens. C(n, 2). */
export function queenPairs(n: number): number {
  return (n * (n - 1)) / 2;
}

/** Queens that share a column or a diagonal. Rows are distinct by construction. */
export function attackingPairs(queens: readonly number[]): number {
  let attacks = 0;
  for (let row = 0; row < queens.length; row += 1) {
    for (let other = row + 1; other < queens.length; other += 1) {
      const columns = Math.abs(queens[row] - queens[other]);
      if (columns === 0 || columns === other - row) attacks += 1;
    }
  }
  return attacks;
}

/** AIMA's local-search objective: non-attacking pairs. 28 is a solution for n = 8. */
export function nonAttackingPairs(queens: readonly number[]): number {
  return queenPairs(queens.length) - attackingPairs(queens);
}

export function queensKey(queens: readonly number[]): string {
  return queens.join(",");
}

/** True when that queen shares a column or diagonal with another. */
export function queenAttacks(queens: readonly number[]): boolean[] {
  return queens.map((column, row) =>
    queens.some((other, index) => {
      if (index === row) return false;
      const columns = Math.abs(column - other);
      return columns === 0 || columns === Math.abs(index - row);
    }),
  );
}

/**
 * Complete-state 8-queens. One column per row. A neighbor moves a single
 * queen to a different column in its row (8 × 7 = 56 successors).
 */
export function queensProblem(n = 8): LocalProblem<number[]> {
  return {
    kind: "queens",
    neighbors(state) {
      const next: number[][] = [];
      for (let row = 0; row < n; row += 1) {
        for (let column = 0; column < n; column += 1) {
          if (column === state[row]) continue;
          const copy = state.slice();
          copy[row] = column;
          next.push(copy);
        }
      }
      return next;
    },
    value: nonAttackingPairs,
    goalTest: (state) => nonAttackingPairs(state) === queenPairs(n),
    key: queensKey,
    coordinate: () => null,
    queens: (state) => state.slice(),
    random(rng) {
      return Array.from({ length: n }, () => rng.int(n));
    },
    genePool: Array.from({ length: n }, (_, column) => column),
  };
}
