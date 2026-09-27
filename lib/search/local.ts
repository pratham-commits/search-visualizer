import { makeRng, type Rng } from "./rng";
import type {
  AnnealEvent,
  BeamEvent,
  BeamMember,
  ClimbEvent,
  GaBirth,
  GaEvent,
  GaIndividual,
  SearchResult,
  StepEvent,
  StepFacts,
} from "./types";

/**
 * Complete-state local search. `value` is maximized, matching aima-python
 * `problem.value` (non-attacking queen pairs, or the landscape height).
 */
export interface LocalProblem<S> {
  kind: "queens" | "landscape" | "toy";
  neighbors(state: S): S[];
  value(state: S): number;
  goalTest(state: S): boolean;
  key(state: S): string;
  coordinate(state: S): number | null;
  queens(state: S): number[] | null;
  random(rng: Rng): S;
  /** Alleles for the genetic algorithm. Empty when the problem has no genes. */
  genePool: number[];
}

export interface Schedule {
  /** Temperature at step t. 0 tells annealing to stop, as in aima `exp_schedule`. */
  at(t: number): number;
  initial: number;
}

/** aima-python `exp_schedule`: k · e^(−λt) until `limit`, then 0. */
export function expSchedule(k = 20, lam = 0.005, limit = 100): Schedule {
  return {
    initial: k,
    at(t: number) {
      if (t >= limit) return 0;
      return k * Math.exp(-lam * t);
    },
  };
}

const QUIET_VARS: StepFacts["vars"] = {
  frontier: [],
  explored: null,
  depth: null,
  repeated: false,
  limit: null,
  iteration: null,
  reexpanded: null,
  scoreKind: null,
};

function pack<E extends { type: StepEvent["type"] }>(
  focus: string,
  event: E,
): E & StepFacts {
  return {
    phase: "local",
    focus,
    examining: [],
    dataStructure: [],
    nextOutId: null,
    structure: "none",
    vars: QUIET_VARS,
    ...event,
  };
}

function done<S>(
  status: SearchResult<S, string>["status"],
  trace: StepEvent[],
  value: number | null,
): SearchResult<S, string> {
  return { status, node: null, path: [], cost: value, trace };
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const order = items.slice();
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  return order;
}

/** aima `argmax_random_tie`: shuffle, then the first maximum. */
function argmaxRandomTie<T>(items: T[], value: (item: T) => number, rng: Rng): T {
  let best = items[0];
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const item of shuffle(items, rng)) {
    const next = value(item);
    if (next > bestValue) {
      best = item;
      bestValue = next;
    }
  }
  return best;
}

export interface HillOptions<S> {
  seed?: number;
  initial?: S;
  maxSteps?: number;
  /** Move to an equal-valued neighbor, up to `sidewaysLimit` in a row. */
  sideways?: boolean;
  /** Consecutive sideways moves allowed. Default 100, the AIMA plateau cap. */
  sidewaysLimit?: number;
}

/**
 * aima-python `hill_climbing`: steepest ascent. Move only when the best
 * neighbor is strictly better. Stop on a local maximum or a plateau.
 * With `sideways`, an equal neighbor is taken until `sidewaysLimit` in a row.
 */
export function hillClimbing<S>(
  problem: LocalProblem<S>,
  options: HillOptions<S> = {},
): SearchResult<S, string> {
  const rng = makeRng(options.seed ?? 1);
  let current = options.initial ?? problem.random(rng);
  const trace: StepEvent[] = [];
  const sideways = options.sideways ?? false;
  const sidewaysLimit = options.sidewaysLimit ?? 100;
  const maxSteps = options.maxSteps ?? (sideways ? 1000 : 100);
  let streak = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    const neighbors = problem.neighbors(current);
    if (neighbors.length === 0) {
      trace.push(
        climb(problem, current, null, 0, false, problem.goalTest(current), false, 0, null),
      );
      return done(problem.goalTest(current) ? "success" : "failure", trace, problem.value(current));
    }
    const best = argmaxRandomTie(neighbors, (state) => problem.value(state), rng);
    const currentValue = problem.value(current);
    const bestValue = problem.value(best);
    const improved = bestValue > currentValue;
    const equal = bestValue === currentValue;
    const takeSideways = sideways && equal && streak < sidewaysLimit;
    const moved = improved || takeSideways;
    const nextStreak = improved ? 0 : takeSideways ? streak + 1 : streak;
    const goal = moved ? problem.goalTest(best) : problem.goalTest(current);
    trace.push(
      climb(
        problem,
        current,
        best,
        neighbors.length,
        moved,
        goal,
        takeSideways,
        takeSideways ? nextStreak : 0,
        sideways ? sidewaysLimit : null,
      ),
    );
    if (!moved) {
      return done(goal ? "success" : "failure", trace, currentValue);
    }
    streak = nextStreak;
    current = best;
    if (goal) return done("success", trace, problem.value(current));
  }
  return done("cutoff", trace, problem.value(current));
}

function climb<S>(
  problem: LocalProblem<S>,
  current: S,
  best: S | null,
  neighborCount: number,
  moved: boolean,
  goal: boolean,
  sideways: boolean,
  sidewaysCount: number,
  sidewaysLimit: number | null,
): ClimbEvent & StepFacts {
  const currentValue = problem.value(current);
  const bestValue = best === null ? null : problem.value(best);
  const stuck = !moved;
  return pack(problem.key(current), {
    type: "climb",
    currentKey: problem.key(current),
    currentValue,
    currentQueens: problem.queens(current),
    currentX: problem.coordinate(current),
    bestKey: best === null ? null : problem.key(best),
    bestValue,
    bestQueens: best === null ? null : problem.queens(best),
    bestX: best === null ? null : problem.coordinate(best),
    neighborCount,
    moved,
    stuck,
    goal,
    sideways,
    sidewaysCount,
    sidewaysLimit,
  });
}

export interface AnnealOptions<S> {
  seed?: number;
  initial?: S;
  schedule?: Schedule;
}

/**
 * aima-python `simulated_annealing`. A random neighbor is always kept when
 * ΔE > 0. A worse neighbor is kept when e^(ΔE/T) > a uniform draw.
 * At T = 0 the search returns the current state.
 */
export function simulatedAnnealing<S>(
  problem: LocalProblem<S>,
  options: AnnealOptions<S> = {},
): SearchResult<S, string> {
  const rng = makeRng(options.seed ?? 1);
  const schedule = options.schedule ?? expSchedule();
  let current = options.initial ?? problem.random(rng);
  const trace: StepEvent[] = [];

  for (let t = 0; t < 10000; t += 1) {
    const temperature = schedule.at(t);
    if (temperature === 0) {
      trace.push(annealStop(problem, current, t, schedule.initial));
      return done(
        problem.goalTest(current) ? "success" : "failure",
        trace,
        problem.value(current),
      );
    }
    const neighbors = problem.neighbors(current);
    if (neighbors.length === 0) {
      trace.push(annealStop(problem, current, t, schedule.initial));
      return done(
        problem.goalTest(current) ? "success" : "failure",
        trace,
        problem.value(current),
      );
    }
    const next = neighbors[rng.int(neighbors.length)];
    const currentValue = problem.value(current);
    const neighborValue = problem.value(next);
    const deltaE = neighborValue - currentValue;
    let acceptProbability: number | null = null;
    let randomDraw: number | null = null;
    let accepted = deltaE > 0;
    if (!accepted) {
      acceptProbability = Math.exp(deltaE / temperature);
      randomDraw = rng.next();
      accepted = acceptProbability > randomDraw;
    }
    trace.push(
      pack(problem.key(current), {
        type: "anneal",
        currentKey: problem.key(current),
        currentValue,
        currentQueens: problem.queens(current),
        currentX: problem.coordinate(current),
        neighborKey: problem.key(next),
        neighborValue,
        neighborQueens: problem.queens(next),
        neighborX: problem.coordinate(next),
        deltaE,
        temperature,
        temperatureMax: schedule.initial,
        acceptProbability,
        randomDraw,
        accepted,
        stopped: false,
        step: t,
        goal: false,
      } satisfies AnnealEvent),
    );
    if (accepted) current = next;
  }
  return done("cutoff", trace, problem.value(current));
}

function annealStop<S>(
  problem: LocalProblem<S>,
  current: S,
  step: number,
  temperatureMax: number,
): AnnealEvent & StepFacts {
  return pack(problem.key(current), {
    type: "anneal",
    currentKey: problem.key(current),
    currentValue: problem.value(current),
    currentQueens: problem.queens(current),
    currentX: problem.coordinate(current),
    neighborKey: null,
    neighborValue: null,
    neighborQueens: null,
    neighborX: null,
    deltaE: null,
    temperature: 0,
    temperatureMax,
    acceptProbability: null,
    randomDraw: null,
    accepted: false,
    stopped: true,
    step,
    goal: problem.goalTest(current),
  });
}

export interface BeamOptions<S> {
  seed?: number;
  k?: number;
  initial?: S[];
  rounds?: number;
}

function member<S>(problem: LocalProblem<S>, state: S, parentKey: string | null): BeamMember {
  return {
    key: problem.key(state),
    value: problem.value(state),
    queens: problem.queens(state),
    x: problem.coordinate(state),
    parentKey,
  };
}

/**
 * Local beam search. Every successor of every one of the k states goes into
 * one pool; the next beam is the best k of that pool. This is not k
 * independent hill climbs.
 */
export function localBeamSearch<S>(
  problem: LocalProblem<S>,
  options: BeamOptions<S> = {},
): SearchResult<S, string> {
  const rng = makeRng(options.seed ?? 1);
  const k = options.k ?? 3;
  const rounds = options.rounds ?? 8;
  let current = options.initial ?? Array.from({ length: k }, () => problem.random(rng));
  const trace: StepEvent[] = [];

  const startedAtGoal = current.some((state) => problem.goalTest(state));
  trace.push(
    beamShell(
      k,
      0,
      current.map((state) => member(problem, state, null)),
      [],
      current.map((state) => member(problem, state, null)),
      startedAtGoal,
    ),
  );
  if (startedAtGoal) {
    return done("success", trace, Math.max(...current.map((state) => problem.value(state))));
  }

  for (let round = 1; round <= rounds; round += 1) {
    const poolStates: Array<{ state: S; parentKey: string }> = [];
    for (const state of current) {
      const parentKey = problem.key(state);
      for (const next of problem.neighbors(state)) {
        poolStates.push({ state: next, parentKey });
      }
    }
    if (poolStates.length === 0) break;
    const pool = poolStates.map((item) => member(problem, item.state, item.parentKey));
    const ranked = pool
      .map((item, index) => ({ item, index }))
      .sort((a, b) => b.item.value - a.item.value || a.index - b.index);
    const picked = ranked.slice(0, Math.min(k, ranked.length));
    const goalInPool = poolStates.some((item) => problem.goalTest(item.state));
    trace.push({
      ...beamShell(k, round, current.map((state) => member(problem, state, null)), pool, picked.map((row) => row.item), goalInPool),
    });
    current = picked.map((row) => poolStates[row.index].state);
    if (goalInPool) {
      return done("success", trace, Math.max(...current.map((state) => problem.value(state))));
    }
  }
  const best = Math.max(...current.map((state) => problem.value(state)));
  const last = trace[trace.length - 1];
  if (last?.type === "beam" && !last.goal) trace[trace.length - 1] = { ...last, stopped: true };
  return done(
    current.some((state) => problem.goalTest(state)) ? "success" : "failure",
    trace,
    best,
  );
}

function beamShell(
  k: number,
  round: number,
  current: BeamMember[],
  pool: BeamMember[],
  chosen: BeamMember[],
  goal: boolean,
  stopped = false,
): BeamEvent & StepFacts {
  return pack(chosen[0]?.key ?? "beam", {
    type: "beam",
    k,
    round,
    current,
    pool,
    chosen,
    goal,
    stopped,
  });
}

export interface GaOptions {
  seed?: number;
  pop?: number;
  generations?: number;
  pmut?: number;
  initial?: number[][];
}

function meanFitness(people: GaIndividual[]): number {
  if (people.length === 0) return 0;
  return people.reduce((sum, person) => sum + person.fitness, 0) / people.length;
}

/** aima `weighted_sampler` with `bisect` (bisect_right) and `random.uniform(0, total)`. */
function weightedPick(population: GaIndividual[], rng: Rng): GaIndividual {
  const totals: number[] = [];
  for (const person of population) {
    const weight = person.fitness;
    totals.push(weight + (totals.length > 0 ? totals[totals.length - 1] : 0));
  }
  const total = totals[totals.length - 1];
  if (total <= 0) return population[rng.int(population.length)];
  const target = rng.next() * total;
  let lo = 0;
  let hi = totals.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (target < totals[mid]) hi = mid;
    else lo = mid + 1;
  }
  return population[Math.min(lo, population.length - 1)];
}

/**
 * aima-python `genetic_algorithm` on 8-queens genes.
 * Each generation replaces the old population. Fitness is non-attacking pairs.
 */
export function geneticAlgorithm(
  problem: LocalProblem<number[]>,
  options: GaOptions = {},
): SearchResult<number[], string> {
  const rng = makeRng(options.seed ?? 1);
  const pop = options.pop ?? 8;
  const generations = options.generations ?? 10;
  const pmut = options.pmut ?? 0.1;
  const pool = problem.genePool;
  let population: GaIndividual[] = (options.initial ??
    Array.from({ length: pop }, () => problem.random(rng))
  ).map((genes) => ({ genes: genes.slice(), fitness: problem.value(genes) }));

  const trace: StepEvent[] = [];
  trace.push(gaEvent(0, population, null, [], false, false, false, pop));

  for (let generation = 1; generation <= generations; generation += 1) {
    const born: GaIndividual[] = [];
    for (let child = 0; child < population.length; child += 1) {
      const birth = reproduce(population, rng, pmut, pool, problem);
      const individual = { genes: birth.child.slice(), fitness: birth.childFitness };
      born.push(individual);
      const replaced = child === population.length - 1;
      const goal = replaced && born.some((person) => problem.goalTest(person.genes));
      const stopped = replaced && generation === generations && !goal;
      trace.push(gaEvent(generation, population, birth, born.map((person) => ({ ...person, genes: person.genes.slice() })), replaced, goal, stopped, pop));
    }
    population = born;
    if (population.some((person) => problem.goalTest(person.genes))) {
      const best = Math.max(...population.map((person) => person.fitness));
      return done("success", trace, best);
    }
  }
  const best = Math.max(...population.map((person) => person.fitness));
  return done("failure", trace, best);
}

function reproduce(
  population: GaIndividual[],
  rng: Rng,
  pmut: number,
  genePool: number[],
  problem: LocalProblem<number[]>,
): GaBirth {
  const parentA = weightedPick(population, rng);
  const parentB = weightedPick(population, rng);
  const point = rng.int(parentA.genes.length);
  const child = parentA.genes.slice(0, point).concat(parentB.genes.slice(point));
  let mutatedIndex: number | null = null;
  let mutatedFrom: number | null = null;
  let mutatedTo: number | null = null;
  if (rng.next() < pmut) {
    mutatedIndex = rng.int(child.length);
    mutatedFrom = child[mutatedIndex];
    mutatedTo = genePool[rng.int(genePool.length)];
    child[mutatedIndex] = mutatedTo;
  }
  return {
    parentA: parentA.genes.slice(),
    parentB: parentB.genes.slice(),
    fitnessA: parentA.fitness,
    fitnessB: parentB.fitness,
    crossover: point,
    mutatedIndex,
    mutatedFrom,
    mutatedTo,
    child,
    childFitness: problem.value(child),
  };
}

function gaEvent(
  generation: number,
  population: GaIndividual[],
  birth: GaBirth | null,
  born: GaIndividual[],
  replaced: boolean,
  goal: boolean,
  stopped: boolean,
  popSize: number,
): GaEvent & StepFacts {
  const shown = replaced ? born : population;
  return pack(birth ? birth.child.join(",") : "population", {
    type: "ga",
    generation,
    population: population.map((person) => ({ genes: person.genes.slice(), fitness: person.fitness })),
    meanFitness: meanFitness(shown),
    birth,
    born: born.map((person) => ({ genes: person.genes.slice(), fitness: person.fitness })),
    replaced,
    goal,
    stopped,
    popSize,
  });
}

/** Landscape annealing demo: warm enough to leave the local peak, then cools to 0. */
export const ANNEAL_DEMO_SCHEDULE = expSchedule(3, 0.05, 80);

/** Cools so fast that a downhill step is not accepted. Ends like hill climbing. */
export const ANNEAL_FAST_SCHEDULE = expSchedule(0.15, 0.35, 40);

export const HILL_DEMO_SEED = 1;
export const ANNEAL_DEMO_SEED = 2;
export const BEAM_DEMO_SEED = 1;
export const GA_DEMO_SEED = 36;
export const GA_POP = 8;
export const GA_GENERATIONS = 10;
export const GA_PMUT = 0.1;

export function generationMeans(trace: StepEvent[]): number[] {
  const means: number[] = [];
  for (const event of trace) {
    if (event.type !== "ga") continue;
    if (event.birth === null || event.replaced) means.push(event.meanFitness);
  }
  return means;
}
