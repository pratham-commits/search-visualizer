import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ANNEAL_DEMO_SCHEDULE,
  ANNEAL_DEMO_SEED,
  ANNEAL_FAST_SCHEDULE,
  GA_DEMO_SEED,
  GA_GENERATIONS,
  GA_PMUT,
  GA_POP,
  LANDSCAPE_LOCAL_MAX,
  LANDSCAPE_START,
  examNotation,
  frameAt,
  geneticAlgorithm,
  hillClimbing,
  landscapeProblem,
  localBeamSearch,
  plainEnglish,
  queensProblem,
  simulatedAnnealing,
  type LocalProblem,
} from "@/lib/search";
import { Explanation } from "./Explanation";
import { LocalSheet } from "./LocalSheet";

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
  isGoal: () => false,
  key: (state) => state,
  coordinate: () => null,
  queens: () => null,
  random: () => "A",
  genePool: [],
};

describe("local search rendering", () => {
  afterEach(() => cleanup());
  it("parks the landscape marker on the local peak and draws no g/h/f", () => {
    const result = hillClimbing(landscapeProblem(), { initial: LANDSCAPE_START, seed: 1 });
    const last = result.trace.length - 1;
    const view = render(
      <>
        <LocalSheet frame={frameAt(result.trace, last)} landscape />
        <Explanation event={result.trace[last]} />
      </>,
    );
    const marker = view.container.querySelector("[data-landscape-x]");
    expect(marker?.getAttribute("data-landscape-x")).toBe(String(LANDSCAPE_LOCAL_MAX));
    expect(marker?.getAttribute("data-stuck")).toBe("true");
    expect(view.container.querySelector("[data-h]")).toBeNull();
    expect(view.container.querySelector("[data-g]")).toBeNull();
    expect(view.container.querySelector("[data-f]")).toBeNull();
    expect(view.container.querySelector("[data-live-frontier]")).toBeNull();
    expect(view.getByRole("region", { name: "Plain English" }).textContent).toContain(
      plainEnglish(result.trace[last]),
    );
  });

  it("shows the engine temperature and acceptance probability", () => {
    const result = simulatedAnnealing(landscapeProblem(), {
      seed: ANNEAL_DEMO_SEED,
      initial: LANDSCAPE_START,
      schedule: ANNEAL_DEMO_SCHEDULE,
    });
    const index = result.trace.findIndex(
      (event) => event.type === "anneal" && event.accepted && event.deltaE !== null && event.deltaE < 0,
    );
    const event = result.trace[index];
    if (event.type !== "anneal" || event.acceptProbability === null) {
      throw new Error("expected a downhill accept");
    }
    const view = render(
      <>
        <LocalSheet frame={frameAt(result.trace, index)} landscape />
        <Explanation event={event} />
      </>,
    );
    expect(Number(view.container.querySelector("[data-temperature]")?.getAttribute("data-temperature"))).toBe(
      event.temperature,
    );
    expect(Number(view.container.querySelector("[data-accept-p]")?.getAttribute("data-accept-p"))).toBe(
      event.acceptProbability,
    );
    expect(view.getByRole("region", { name: "Exam notation" }).textContent).toContain(examNotation(event));
    expect(view.container.querySelector("[data-live-frontier]")).toBeNull();
    const fast = simulatedAnnealing(landscapeProblem(), {
      seed: 1,
      initial: LANDSCAPE_START,
      schedule: ANNEAL_FAST_SCHEDULE,
    });
    const end = frameAt(fast.trace, fast.trace.length - 1);
    const parked = render(<LocalSheet frame={end} landscape />);
    expect(parked.container.querySelector("[data-landscape-x]")?.getAttribute("data-landscape-x")).toBe(
      String(LANDSCAPE_LOCAL_MAX),
    );
  });

  it("draws k beam states and the combined pool from the engine", () => {
    const result = localBeamSearch(toy, { k: 2, initial: ["A", "B"], rounds: 1, seed: 1 });
    const index = result.trace.findIndex((event) => event.type === "beam" && event.round === 1);
    const event = result.trace[index];
    if (event.type !== "beam") throw new Error("expected beam");
    const view = render(
      <>
        <LocalSheet frame={frameAt(result.trace, index)} landscape={false} />
        <Explanation event={event} />
      </>,
    );
    const slots = [...view.container.querySelectorAll("[data-beam-value]")].map((element) =>
      Number(element.getAttribute("data-beam-value")),
    );
    expect(slots).toEqual(event.chosen.map((member) => member.value));
    expect(slots).toHaveLength(event.k);
    const pool = [...view.container.querySelectorAll("[data-pool-value]")].map((element) =>
      Number(element.getAttribute("data-pool-value")),
    );
    expect(pool.sort((a, b) => a - b)).toEqual(event.pool.map((member) => member.value).sort((a, b) => a - b));
    expect(view.container.querySelector("[data-live-frontier]")).toBeNull();
  });

  it("draws one fitness bar per individual, matching the engine", () => {
    const result = geneticAlgorithm(queensProblem(), {
      seed: GA_DEMO_SEED,
      pop: GA_POP,
      generations: GA_GENERATIONS,
      pmut: GA_PMUT,
    });
    for (const index of [0, result.trace.length - 1]) {
      const event = result.trace[index];
      if (event.type !== "ga") throw new Error("expected a generation");
      const people = event.replaced ? event.born : event.population;
      const view = render(
        <>
          <LocalSheet frame={frameAt(result.trace, index)} landscape={false} />
          <Explanation event={event} />
        </>,
      );
      const bars = [...view.container.querySelectorAll("[data-fitness]")].map((element) =>
        Number(element.getAttribute("data-fitness")),
      );
      expect(bars).toEqual(people.map((person) => person.fitness));
      expect(bars).toHaveLength(event.popSize);
      view.unmount();
    }
    expect(result.trace[result.trace.length - 1].type === "ga").toBe(true);
  });
});
