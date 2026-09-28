import { romaniaDisplay, type RomaniaLabelMode } from "./problems/romania";
import type {
  AnnealEvent,
  BeamEvent,
  ClimbEvent,
  FrontierItem,
  GaEvent,
  StepEvent,
} from "./types";

export function formatTemp(value: number): string {
  return value.toFixed(2);
}

export function formatProb(value: number): string {
  return value.toFixed(3);
}

export function isLocalEvent(
  event: StepEvent,
): event is Extract<StepEvent, { type: "climb" | "anneal" | "beam" | "ga" }> {
  return (
    event.type === "climb" ||
    event.type === "anneal" ||
    event.type === "beam" ||
    event.type === "ga"
  );
}

function place(key: string, mode: RomaniaLabelMode): string {
  return romaniaDisplay(key, mode);
}

function priorityName(kind: "g" | "h" | "g+h"): string {
  if (kind === "g") return "g";
  if (kind === "h") return "h";
  return "f";
}

function priorityValue(event: StepEvent): number | null {
  if (event.vars.scoreKind === null) return null;
  if (event.type === "pop" || event.type === "seed") {
    if (event.vars.scoreKind === "g") return event.g;
    if (event.vars.scoreKind === "h") return event.h;
    return event.f;
  }
  if (
    event.type === "generate" ||
    event.type === "frontier-add" ||
    event.type === "frontier-replace"
  ) {
    if (event.vars.scoreKind === "g") return event.g;
    if (event.vars.scoreKind === "h") return event.h ?? event.f;
    return event.f;
  }
  return null;
}

function focusFormula(event: StepEvent, mode: RomaniaLabelMode): string | null {
  const kind = event.vars.scoreKind;
  if (kind === null) return null;
  if (
    event.type !== "pop" &&
    event.type !== "seed" &&
    event.type !== "generate" &&
    event.type !== "frontier-add" &&
    event.type !== "frontier-replace"
  ) {
    return null;
  }
  const name = place(event.stateKey, mode);
  if (kind === "g+h") {
    if (event.h === null) return null;
    return `f(${name}) = g + h = ${event.g} + ${event.h} = ${event.f}`;
  }
  if (kind === "h") {
    const h = event.h ?? event.f;
    return `h(${name}) = ${h}`;
  }
  if (event.type === "generate" || event.type === "frontier-add") {
    if (event.parentG === null || event.focus === null) {
      return `g(${name}) = PATH-COST = ${event.g}`;
    }
    const step = event.g - event.parentG;
    return `g(${name}) = PATH-COST = g(${place(event.focus, mode)}) + ACTION-COST = ${event.parentG} + ${step} = ${event.g}`;
  }
  return `g(${name}) = PATH-COST = ${event.g}`;
}

function frontierBit(item: FrontierItem, kind: "g" | "h" | "g+h", mode: RomaniaLabelMode): string {
  const name = place(item.stateKey, mode);
  if (kind === "g+h" && item.h !== null) {
    return `${name} f=${item.f} (g ${item.g} + h ${item.h})`;
  }
  if (kind === "g") return `${name} g=${item.g}`;
  return `${name} h=${item.h ?? item.f}`;
}

function leavesFrom(structure: StepEvent["structure"]): string {
  if (structure === "lifo") return "top of the stack";
  if (structure === "fifo") return "front of the queue";
  return "front of the priority queue";
}

function entersAt(structure: StepEvent["structure"]): string {
  if (structure === "lifo") return "top of the stack";
  if (structure === "fifo") return "back of the queue";
  return "priority queue";
}

function names(keys: string[], mode: RomaniaLabelMode): string {
  return keys.length === 0 ? "none" : keys.map((key) => place(key, mode)).join(", ");
}

function climbEnglish(event: ClimbEvent): string {
  if (event.sideways && event.sidewaysLimit !== null) {
    return `equal value ${event.bestValue} → sideways move, ${event.sidewaysCount}/${event.sidewaysLimit}`;
  }
  if (event.moved && event.bestValue !== null) {
    return `Current value ${event.currentValue}. Best neighbor ${event.bestValue} (better) → move.`;
  }
  if (
    event.stuck &&
    event.sidewaysLimit !== null &&
    event.bestValue === event.currentValue
  ) {
    return `equal value ${event.currentValue}, sideways cap ${event.sidewaysLimit}/${event.sidewaysLimit} → stop.`;
  }
  return `No neighbor beats ${event.currentValue} → local maximum, stop.`;
}

function annealEnglish(event: AnnealEvent): string {
  const temperature = formatTemp(event.temperature);
  if (event.stopped || event.deltaE === null || event.neighborValue === null) {
    return `T = ${temperature}. Temperature has reached 0, so annealing stops.`;
  }
  if (event.deltaE > 0) {
    return `ΔE = ${event.deltaE}, T = ${temperature}. ΔE > 0 → accept.`;
  }
  const probability = formatProb(event.acceptProbability ?? 0);
  const draw = formatProb(event.randomDraw ?? 0);
  const verdict = event.accepted ? "accept" : "reject";
  return `ΔE = ${event.deltaE}, T = ${temperature}, P(accept) = e^(ΔE/T) = ${probability}, random = ${draw} → ${verdict}.`;
}

function beamEnglish(event: BeamEvent): string {
  const values = (members: BeamEvent["current"]) =>
    members.map((item) => item.value).join(", ");
  if (event.round === 0) {
    return `Start with k = ${event.k} states, values ${values(event.current)}.`;
  }
  return `Beam of k = ${event.k}, values ${values(event.current)}. Combined pool of ${event.pool.length} successors. Best ${event.k}: ${values(event.chosen)}.`;
}

function gaEnglish(event: GaEvent): string {
  const fitnesses = event.population.map((person) => person.fitness).join(", ");
  if (event.birth === null) {
    return `Initial population fitness ${fitnesses}. Mean ${formatProb(event.meanFitness)}.`;
  }
  const birth = event.birth;
  const mutation =
    birth.mutatedIndex === null
      ? "no mutation"
      : `mutated gene ${birth.mutatedIndex} (${birth.mutatedFrom}→${birth.mutatedTo})`;
  const replacement = event.replaced
    ? ` New generation replaces the old. Mean fitness ${formatProb(event.meanFitness)}.`
    : "";
  return `Fitness ${fitnesses}. Parents ${birth.fitnessA} and ${birth.fitnessB}, crossover at gene ${birth.crossover}, ${mutation}. Child fitness ${birth.childFitness}.${replacement}`;
}

/** Plain-English sentence for one trace step. Uses only fields on the event. */
export function plainEnglish(event: StepEvent, mode: RomaniaLabelMode = "cities"): string {
  if (event.type === "climb") return climbEnglish(event);
  if (event.type === "anneal") return annealEnglish(event);
  if (event.type === "beam") return beamEnglish(event);
  if (event.type === "ga") return gaEnglish(event);
  const focus = event.focus === null ? "the start" : place(event.focus, mode);
  const listed = names(event.examining, mode);
  switch (event.type) {
    case "seed":
      return `Start at ${focus}.`;
    case "pop": {
      const value = priorityValue(event);
      if (event.vars.scoreKind !== null && value !== null) {
        return `Popped ${place(event.stateKey, mode)} (lowest ${priorityName(event.vars.scoreKind)} = ${value}).`;
      }
      return `Popped ${focus} from the ${leavesFrom(event.structure)}.`;
    }
    case "expand":
      if (event.vars.reached === null) {
        return `Examining the neighbors of ${focus}: ${listed}. Tree-like search does not keep a reached table; IS-CYCLE checks ancestors on this path.`;
      }
      return `Examining the neighbors of ${focus}: ${listed}.`;
    case "generate": {
      const formula = focusFormula(event, mode);
      if (event.vars.repeated) {
        return `Generated ${listed} from ${focus}. Not an ancestor on this path, so IS-CYCLE allows it. Tree-like search has no reached table, so this other branch is still explored.`;
      }
      if (formula) return `Generated ${place(event.stateKey, mode)} from ${place(event.focus ?? "", mode)}. ${formula}.`;
      return `Generated ${listed} from ${focus}.`;
    }
    case "goal-check":
      return event.isGoal
        ? `${place(event.stateKey, mode)} is the goal.`
        : `${place(event.stateKey, mode)} is not the goal.`;
    case "frontier-add": {
      const formula = focusFormula(event, mode);
      if (event.vars.repeated) {
        return `Added ${place(event.stateKey, mode)} to the ${entersAt(event.structure)}. No reached table, so this other path is kept. IS-CYCLE only skips a state already on the current path.`;
      }
      if (formula) {
        return `Added ${place(event.stateKey, mode)} to the ${entersAt(event.structure)}. ${formula}.`;
      }
      return `Added ${place(event.stateKey, mode)} to the ${entersAt(event.structure)}.`;
    }
    case "frontier-skip":
      if (event.reason === "cycle") {
        return `Did not add ${place(event.stateKey, mode)}. IS-CYCLE is true: it is already an ancestor on this path. Tree-like search keeps no reached table, so a different branch can still reach it.`;
      }
      if (event.reason === "reached") {
        return `Did not add ${place(event.stateKey, mode)}. It is already in the reached table, so graph search skips this redundant path.`;
      }
      if (event.reason === "in-frontier") {
        return `Did not add ${place(event.stateKey, mode)}. Repeated state: it is already in the frontier, and the first path is kept.`;
      }
      return `Did not add ${place(event.stateKey, mode)}. The path already in the frontier has a better f.`;
    case "frontier-replace":
      return `Relaxed ${place(event.stateKey, mode)}: found cheaper path, updated g from ${event.previousG} to ${event.g}.`;
    case "fail":
      if (event.vars.limit !== null) {
        return `The frontier is empty within limit ${event.vars.limit}. No branch was cut off, so there is no solution (failure).`;
      }
      return "The frontier is empty. There is no path.";
    case "cutoff":
      if (event.reason === "depth") {
        return `The search stopped at limit ${event.vars.limit}. At least one branch reached that depth, so a solution might exist deeper (cutoff).`;
      }
      return "Stopped at the expansion safety cap. IS-CYCLE is what prevents cycles; this cap is only a backstop.";
    case "depth-cutoff":
      return `Node ${place(event.stateKey, mode)} is at depth ${event.depth} = the limit ${event.limit}, so we do not expand it (cutoff).`;
    case "restart":
      return `Iteration restarts from the start with limit ${event.limit}. The previous tree is cleared.`;
  }
}

function phaseLabel(event: StepEvent): string {
  switch (event.phase) {
    case "pop":
      return "Pop";
    case "examine-neighbors":
      return "Expand";
    case "generate-child":
      return "Generate";
    case "is-goal":
      return "IS-GOAL";
    case "repeated-state":
      return "Repeated";
    case "cutoff":
      return "Cutoff";
    case "restart":
      return "Restart";
    case "done":
      return "Done";
    case "local":
      return "Local";
  }
}

function climbExam(event: ClimbEvent): string {
  const lines = [
    `VALUE(current) = ${event.currentValue}`,
    `successors: ${event.neighborCount}`,
  ];
  if (event.bestValue === null) {
    lines.push("no successor → return current");
    return lines.join("\n");
  }
  lines.push(`VALUE(best neighbor) = ${event.bestValue}`);
  if (event.sideways && event.sidewaysLimit !== null) {
    lines.push(
      `equal value ${event.bestValue} → sideways move, ${event.sidewaysCount}/${event.sidewaysLimit}`,
    );
  } else if (
    !event.moved &&
    event.sidewaysLimit !== null &&
    event.bestValue === event.currentValue
  ) {
    lines.push(
      `sideways cap ${event.sidewaysLimit}/${event.sidewaysLimit} → return current`,
    );
  } else {
    lines.push(
      event.moved
        ? `${event.bestValue} > ${event.currentValue} → current ← best neighbor`
        : `${event.bestValue} ≤ ${event.currentValue} → local maximum, return current`,
    );
  }
  return lines.join("\n");
}

function annealExam(event: AnnealEvent): string {
  if (event.stopped || event.deltaE === null || event.neighborValue === null) {
    return `T = ${formatTemp(event.temperature)}\nT = 0 → return current`;
  }
  const lines = [
    `T = ${formatTemp(event.temperature)}`,
    `ΔE = VALUE(next) − VALUE(current) = ${event.neighborValue} − ${event.currentValue} = ${event.deltaE}`,
  ];
  if (event.deltaE > 0) {
    lines.push("ΔE > 0 → accept");
    return lines.join("\n");
  }
  lines.push(
    `P(accept) = e^(ΔE/T) = e^(${event.deltaE}/${formatTemp(event.temperature)}) = ${formatProb(event.acceptProbability ?? 0)}`,
  );
  lines.push(`random = ${formatProb(event.randomDraw ?? 0)}`);
  lines.push(
    event.accepted
      ? `${formatProb(event.acceptProbability ?? 0)} > ${formatProb(event.randomDraw ?? 0)} → accept`
      : `${formatProb(event.acceptProbability ?? 0)} > ${formatProb(event.randomDraw ?? 0)}? no → reject`,
  );
  return lines.join("\n");
}

function beamExam(event: BeamEvent): string {
  const list = (members: BeamEvent["current"]) => members.map((item) => item.value).join(", ");
  if (event.round === 0) return `k = ${event.k}\ncurrent = [${list(event.current)}]`;
  const pool = [...event.pool].sort((a, b) => b.value - a.value);
  return [
    `k = ${event.k}`,
    `current = [${list(event.current)}]`,
    `combined pool (${event.pool.length}) = [${pool.map((item) => item.value).join(", ")}]`,
    `best k = [${list(event.chosen)}]`,
  ].join("\n");
}

function gaExam(event: GaEvent): string {
  const fitnesses = event.population.map((person) => person.fitness).join(", ");
  if (event.birth === null) {
    return `generation 0\nfitness = [${fitnesses}]\nmean = ${formatProb(event.meanFitness)}`;
  }
  const birth = event.birth;
  const lines = [
    `generation ${event.generation}`,
    `fitness = [${fitnesses}]`,
    `selected parents: ${birth.fitnessA} × ${birth.fitnessB}`,
    `crossover at ${birth.crossover}`,
    birth.mutatedIndex === null
      ? "mutation: none"
      : `mutation: gene ${birth.mutatedIndex} (${birth.mutatedFrom}→${birth.mutatedTo})`,
    `child fitness = ${birth.childFitness}`,
  ];
  if (event.replaced) {
    lines.push(
      `new generation fitness = [${event.born.map((person) => person.fitness).join(", ")}]`,
    );
    lines.push(`mean = ${formatProb(event.meanFitness)}`);
  }
  return lines.join("\n");
}

function formatReached(event: StepEvent, mode: RomaniaLabelMode): string {
  if (event.vars.reachedCost) {
    const parts = Object.entries(event.vars.reachedCost).map(
      ([key, cost]) => `${place(key, mode)} → ${cost}`,
    );
    return `{${parts.join(", ")}}`;
  }
  if (event.vars.reached === null) return "— (tree-like search keeps none)";
  return `{${event.vars.reached.map((key) => place(key, mode)).join(", ")}}`;
}

/** Exam-style lines a student could copy. Uses only fields on the event. */
export function examNotation(event: StepEvent, mode: RomaniaLabelMode = "cities"): string {
  if (event.type === "climb") return climbExam(event);
  if (event.type === "anneal") return annealExam(event);
  if (event.type === "beam") return beamExam(event);
  if (event.type === "ga") return gaExam(event);
  const kind = event.vars.scoreKind;
  const marked =
    kind === null
      ? event.vars.frontier.map((key, index) => {
          const name = place(key, mode);
          return index === 0 ? `→ ${name}` : name;
        })
      : event.dataStructure.map((item, index) => {
          const bit = frontierBit(item, kind, mode);
          return index === 0 ? `→ ${bit}` : bit;
        });
  const frontier = marked.length === 0 ? "[]" : `[${marked.join(", ")}]`;
  const formula = focusFormula(event, mode);
  const reached = formatReached(event, mode);
  const depth = event.vars.depth === null ? "—" : String(event.vars.depth);
  const depthNote =
    event.vars.limit === null
      ? `depth ${depth}`
      : `depth ${depth}, limit ${event.vars.limit}`;
  const who = event.focus === null ? "—" : place(event.focus, mode);
  const heading =
    kind === null
      ? `${phaseLabel(event)}: ${who}  (${depthNote})`
      : `${phaseLabel(event)}: ${who}`;
  const lines = [
    heading,
    ...(formula ? [formula] : []),
    `Frontier: ${frontier}`,
    `Reached: ${reached}`,
  ];
  if (event.phase === "examine-neighbors") {
    lines.push(`Neighbors: {${names(event.examining, mode)}}`);
  }
  if (event.type === "frontier-skip" && event.reason === "cycle") {
    lines.push(
      "IS-CYCLE = true (ancestor on this path). No reached table, so another branch can still reach this state.",
    );
  } else if (event.vars.repeated && event.vars.reached === null) {
    lines.push(
      "Not a cycle on this path. No reached table, so this other branch is still explored.",
    );
  }
  if (event.type === "goal-check") {
    lines.push(`IS-GOAL(${place(event.stateKey, mode)}) = ${event.isGoal}`);
  }
  if (event.type === "depth-cutoff" || (event.type === "cutoff" && event.reason === "depth")) {
    lines.push("Outcome: cutoff");
  }
  if (event.type === "fail") lines.push("Outcome: failure");
  if (event.type === "goal-check" && event.isGoal) lines.push("Outcome: solution");
  if (event.vars.iteration !== null && event.vars.reexpanded !== null) {
    lines.push(`Re-expanded this iteration: ${event.vars.reexpanded}`);
  }
  return lines.join("\n");
}
