/** Deterministic [0, 1) generator. Same seed, same sequence, so a trace can be scrubbed. */
export interface Rng {
  next(): number;
  /** Integer in `0 .. n-1`. */
  int(n: number): number;
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n: number) {
      return Math.floor(this.next() * n);
    },
  };
}
