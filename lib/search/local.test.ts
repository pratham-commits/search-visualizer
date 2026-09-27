import { describe, expect, it } from "vitest";
import { examNotation, plainEnglish } from "./explain";
import {
  ANNEAL_DEMO_SCHEDULE,
  ANNEAL_DEMO_SEED,
  ANNEAL_FAST_SCHEDULE,
  GA_DEMO_SEED,
  GA_GENERATIONS,
  GA_PMUT,
  GA_POP,
  generationMeans,
  geneticAlgorithm,
  hillClimbing,
  localBeamSearch,
  simulatedAnnealing,
  type LocalProblem,
} from "./local";
import {
  LANDSCAPE_GLOBAL_MAX,
  LANDSCAPE_LOCAL_MAX,
  LANDSCAPE_START,
  LANDSCAPE_VALUES,
  landscapeProblem,
} from "./problems/landscape";
import { attackingPairs, nonAttackingPairs, queensProblem } from "./problems/queens";
import type { StepEvent } from "./types";

function climbs(trace: StepEvent[]) {
  return trace.filter((event): event is Extract<StepEvent, { type: "climb" }> => event.type === "climb");
}

function anneals(trace: StepEvent[]) {
  return trace.filter((event): event is Extract<StepEvent, { type: "anneal" }> => event.type === "anneal");
}

const toy: LocalProblem<string> = {
  kind: "toy",
  neighbors(state) {
    if (state === "A") return ["A1", "A2"];
    if (state === "B") return ["B1"];
    return [];
  },
  value(state) {
    return { A: 0, A1: 10, A2: 9, B: 0, B1: 3 }[state] ?? 0;
  },
  goalTest: () => false,
  key: (state) => state,
  coordinate: () => null,
  queens: () => null,
  random: () => "A",
  genePool: [],
};

describe("local search", () => {
  it("counts non-attacking pairs, and a known 4-queens solution scores 6", () => {
    expect(attackingPairs([1, 3, 0, 2])).toBe(0);
    expect(nonAttackingPairs([1, 3, 0, 2])).toBe(6);
    expect(queensProblem(8).neighbors([0, 0, 0, 0, 0, 0, 0, 0])).toHaveLength(56);
  });

  it("hill climbing stops when no neighbor is better, on the local peak", () => {
    const result = hillClimbing(landscapeProblem(), { initial: LANDSCAPE_START, seed: 1 });
    const steps = climbs(result.trace);
    expect(steps.filter((event) => event.moved).map((event) => event.bestX)).toEqual([1, 2, 3, 4]);
    const last = steps[steps.length - 1];
    expect(last.stuck).toBe(true);
    expect(last.currentX).toBe(LANDSCAPE_LOCAL_MAX);
    expect(last.currentValue).toBe(5);
    expect(last.bestValue).toBeLessThanOrEqual(last.currentValue);
    expect(last.goal).toBe(false);
    expect(LANDSCAPE_VALUES[LANDSCAPE_GLOBAL_MAX]).toBeGreaterThan(last.currentValue);
    expect(plainEnglish(last)).toBe("No neighbor beats 5 → local maximum, stop.");
  });

  it("on 8-queens, moves only to a strictly better neighbor and then stops short of 28", () => {
    const problem = queensProblem(8);
    const result = hillClimbing(problem, { seed: 1 });
    const steps = climbs(result.trace);
    for (const event of steps) {
      const state = event.currentQueens;
      if (!state) throw new Error("expected queens");
      const best = Math.max(...problem.neighbors(state).map((next) => problem.value(next)));
      expect(event.neighborCount).toBe(56);
      expect(event.bestValue).toBe(best);
      if (event.moved) expect(event.bestValue).toBeGreaterThan(event.currentValue);
      if (event.stuck) expect(best).toBeLessThanOrEqual(event.currentValue);
    }
    expect(steps[steps.length - 1].stuck).toBe(true);
    expect(steps[steps.length - 1].currentValue).toBeLessThan(28);
    expect(steps.every((event) => event.sideways === false)).toBe(true);
  });

  it("sideways moves cross equal neighbors, stay within the cap, and solve more 8-queens starts", () => {
    const problem = queensProblem(8);
    const trials = 80;
    let strictSolved = 0;
    let sidewaysSolved = 0;
    let demoSeed: number | null = null;
    for (let seed = 1; seed <= trials; seed += 1) {
      const strict = hillClimbing(problem, { seed });
      const relaxed = hillClimbing(problem, { seed, sideways: true, sidewaysLimit: 100 });
      if (strict.status === "success") strictSolved += 1;
      if (relaxed.status === "success") sidewaysSolved += 1;
      const steps = climbs(relaxed.trace);
      let streak = 0;
      for (const event of steps) {
        expect(event.sidewaysCount).toBeLessThanOrEqual(100);
        if (event.sideways) {
          streak += 1;
          expect(event.bestValue).toBe(event.currentValue);
          expect(event.sidewaysCount).toBe(streak);
          expect(plainEnglish(event)).toBe(
            `equal value ${event.bestValue} → sideways move, ${event.sidewaysCount}/100`,
          );
        } else {
          streak = 0;
        }
      }
      expect(streak).toBeLessThanOrEqual(100);
      if (demoSeed === null && strict.status !== "success" && relaxed.status === "success") {
        demoSeed = seed;
      }
    }
    expect(strictSolved / trials).toBeLessThan(0.35);
    expect(sidewaysSolved).toBeGreaterThan(strictSolved);
    expect(sidewaysSolved / trials).toBeGreaterThan(0.8);
    expect(demoSeed).not.toBeNull();

    const shown = hillClimbing(problem, { seed: demoSeed!, sideways: true });
    expect(shown.status).toBe("success");
    expect(shown.cost).toBe(28);
    const off = hillClimbing(problem, { seed: demoSeed! });
    expect(off.status).not.toBe("success");
    expect(climbs(off.trace).at(-1)?.stuck).toBe(true);
  });

  it("fast cooling accepts no downhill step and stops on the hill-climbing peak", () => {
    const problem = landscapeProblem();
    const result = simulatedAnnealing(problem, {
      seed: 1,
      initial: LANDSCAPE_START,
      schedule: ANNEAL_FAST_SCHEDULE,
    });
    const steps = anneals(result.trace);
    const stop = steps[steps.length - 1];
    expect(stop.stopped).toBe(true);
    expect(stop.temperature).toBe(0);
    expect(stop.currentX).toBe(LANDSCAPE_LOCAL_MAX);
    for (const event of steps) {
      if (event.deltaE === null || event.neighborValue === null) continue;
      expect(event.deltaE).toBe(event.neighborValue - event.currentValue);
      if (event.deltaE > 0) {
        expect(event.accepted).toBe(true);
        expect(event.acceptProbability).toBeNull();
      } else {
        expect(event.acceptProbability).toBeCloseTo(Math.exp(event.deltaE / event.temperature), 10);
        expect(event.accepted).toBe((event.acceptProbability ?? 0) > (event.randomDraw ?? 1));
        expect(event.temperature).toBeLessThan(0.2);
        expect(event.accepted).toBe(false);
      }
    }
  });

  it("warm annealing can leave the local peak, and the acceptance arithmetic is the engine's", () => {
    const result = simulatedAnnealing(landscapeProblem(), {
      seed: ANNEAL_DEMO_SEED,
      initial: LANDSCAPE_START,
      schedule: ANNEAL_DEMO_SCHEDULE,
    });
    const leave = result.trace[24];
    if (leave.type !== "anneal") throw new Error("expected an annealing step");
    expect(leave.currentX).toBe(LANDSCAPE_LOCAL_MAX);
    expect(leave.neighborX).toBe(5);
    expect(leave.deltaE).toBe(-1);
    if (leave.deltaE === null) throw new Error("expected ΔE");
    expect(leave.accepted).toBe(true);
    expect(leave.acceptProbability).toBeCloseTo(Math.exp(leave.deltaE / leave.temperature), 10);
    expect(leave.acceptProbability).toBeGreaterThan(leave.randomDraw ?? 1);
    expect(plainEnglish(leave)).toContain("ΔE = -1");
    expect(plainEnglish(leave)).toContain("P(accept) = e^(ΔE/T)");
    expect(plainEnglish(leave)).toContain("→ accept");
    expect(examNotation(leave)).toContain("e^(ΔE/T)");
    const rejected = result.trace.find(
      (event) => event.type === "anneal" && event.deltaE !== null && event.deltaE < 0 && !event.accepted,
    );
    if (rejected?.type !== "anneal" || rejected.acceptProbability === null) {
      throw new Error("expected a rejected downhill step");
    }
    expect(rejected.acceptProbability).toBeLessThanOrEqual(rejected.randomDraw ?? 0);
    expect(plainEnglish(rejected)).toContain("→ reject");
    const higher = result.trace.some(
      (event) => event.type === "anneal" && event.currentValue >= 8,
    );
    expect(higher).toBe(true);
  });

  it("local beam keeps k states chosen from the combined pool, not one child per parent", () => {
    const result = localBeamSearch(toy, { k: 2, initial: ["A", "B"], rounds: 1, seed: 1 });
    const round = result.trace.find((event) => event.type === "beam" && event.round === 1);
    if (round?.type !== "beam") throw new Error("expected a beam round");
    expect(round.k).toBe(2);
    expect(round.chosen).toHaveLength(2);
    expect(round.pool.map((item) => item.key).sort()).toEqual(["A1", "A2", "B1"]);
    expect(round.chosen.map((item) => item.key).sort()).toEqual(["A1", "A2"]);
    expect(round.chosen.every((item) => item.parentKey === "A")).toBe(true);
    expect(round.pool).toHaveLength(3);
    expect(plainEnglish(round)).toContain("Combined pool of 3");
    expect(examNotation(round)).toContain("combined pool (3)");
  });

  it("keeps the population size fixed, and the demo seed's mean fitness never falls", () => {
    const result = geneticAlgorithm(queensProblem(8), {
      seed: GA_DEMO_SEED,
      pop: GA_POP,
      generations: GA_GENERATIONS,
      pmut: GA_PMUT,
    });
    const events = result.trace.filter((event) => event.type === "ga");
    expect(events.every((event) => event.popSize === GA_POP)).toBe(true);
    const replaced = events.filter((event) => event.replaced);
    expect(replaced).toHaveLength(GA_GENERATIONS);
    for (const event of replaced) {
      expect(event.born).toHaveLength(GA_POP);
    }
    const means = generationMeans(result.trace);
    expect(means).toHaveLength(GA_GENERATIONS + 1);
    for (let index = 1; index < means.length; index += 1) {
      expect(means[index]).toBeGreaterThanOrEqual(means[index - 1]);
    }
    expect(means[means.length - 1]).toBeGreaterThan(means[0]);
  });
});
