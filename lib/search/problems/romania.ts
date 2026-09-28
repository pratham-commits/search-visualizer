import type { Problem } from "../types";

export const CITIES = [
  "Arad",
  "Bucharest",
  "Craiova",
  "Drobeta",
  "Eforie",
  "Fagaras",
  "Giurgiu",
  "Hirsova",
  "Iasi",
  "Lugoj",
  "Mehadia",
  "Neamt",
  "Oradea",
  "Pitesti",
  "Rimnicu",
  "Sibiu",
  "Timisoara",
  "Urziceni",
  "Vaslui",
  "Zerind",
] as const;

export type City = (typeof CITIES)[number];

/**
 * One-way edges in aima-python insertion order. `undirectedRoads` mirrors
 * UndirectedGraph.make_undirected, so neighbor order matches that code.
 */
const ONE_WAY: Record<string, Record<string, number>> = {
  Arad: { Zerind: 75, Sibiu: 140, Timisoara: 118 },
  Bucharest: { Urziceni: 85, Pitesti: 101, Giurgiu: 90, Fagaras: 211 },
  Craiova: { Drobeta: 120, Rimnicu: 146, Pitesti: 138 },
  Drobeta: { Mehadia: 75 },
  Eforie: { Hirsova: 86 },
  Fagaras: { Sibiu: 99 },
  Hirsova: { Urziceni: 98 },
  Iasi: { Vaslui: 92, Neamt: 87 },
  Lugoj: { Timisoara: 111, Mehadia: 70 },
  Oradea: { Zerind: 71, Sibiu: 151 },
  Pitesti: { Rimnicu: 97 },
  Rimnicu: { Sibiu: 80 },
  Urziceni: { Vaslui: 142 },
};

/** Map coordinates from aima-python romania_map.locations. */
export const ROMANIA_LOCATIONS: Record<City, { x: number; y: number }> = {
  Arad: { x: 91, y: 492 },
  Bucharest: { x: 400, y: 327 },
  Craiova: { x: 253, y: 288 },
  Drobeta: { x: 165, y: 299 },
  Eforie: { x: 562, y: 293 },
  Fagaras: { x: 305, y: 449 },
  Giurgiu: { x: 375, y: 270 },
  Hirsova: { x: 534, y: 350 },
  Iasi: { x: 473, y: 506 },
  Lugoj: { x: 165, y: 379 },
  Mehadia: { x: 168, y: 339 },
  Neamt: { x: 406, y: 537 },
  Oradea: { x: 131, y: 571 },
  Pitesti: { x: 320, y: 368 },
  Rimnicu: { x: 233, y: 410 },
  Sibiu: { x: 207, y: 457 },
  Timisoara: { x: 94, y: 410 },
  Urziceni: { x: 456, y: 350 },
  Vaslui: { x: 509, y: 444 },
  Zerind: { x: 108, y: 531 },
};

/** Straight-line distance to Bucharest. Data only; the loop does not use it yet. */
export const ROMANIA_SLD: Record<City, number> = {
  Arad: 366,
  Bucharest: 0,
  Craiova: 160,
  Drobeta: 242,
  Eforie: 161,
  Fagaras: 176,
  Giurgiu: 77,
  Hirsova: 151,
  Iasi: 226,
  Lugoj: 244,
  Mehadia: 241,
  Neamt: 234,
  Oradea: 380,
  Pitesti: 100,
  Rimnicu: 193,
  Sibiu: 253,
  Timisoara: 329,
  Urziceni: 80,
  Vaslui: 199,
  Zerind: 374,
};

export type RomaniaLabelMode = "letters" | "cities";

/**
 * Display-only letters. Arad is S, Bucharest is G, and every other city
 * takes the next letter in `CITIES` order, skipping S and G.
 * This map is not a node id: search, costs, and h(n) still use the city name.
 */
function assignLetters(): Record<City, string> {
  const alphabet = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter(
    (letter) => letter !== "S" && letter !== "G",
  );
  const assigned = {} as Record<City, string>;
  let index = 0;
  for (const city of CITIES) {
    if (city === "Arad") assigned[city] = "S";
    else if (city === "Bucharest") assigned[city] = "G";
    else assigned[city] = alphabet[index++];
  }
  return assigned;
}

export const ROMANIA_LETTERS: Record<City, string> = assignLetters();

export function romaniaDisplay(key: string, mode: RomaniaLabelMode = "cities"): string {
  if (!(key in CITY_LABEL)) return key;
  const city = key as City;
  return mode === "letters" ? ROMANIA_LETTERS[city] : CITY_LABEL[city];
}

export const CITY_LABEL: Record<City, string> = {
  Arad: "Arad",
  Bucharest: "Bucharest",
  Craiova: "Craiova",
  Drobeta: "Drobeta",
  Eforie: "Eforie",
  Fagaras: "Fagaras",
  Giurgiu: "Giurgiu",
  Hirsova: "Hirsova",
  Iasi: "Iasi",
  Lugoj: "Lugoj",
  Mehadia: "Mehadia",
  Neamt: "Neamt",
  Oradea: "Oradea",
  Pitesti: "Pitesti",
  Rimnicu: "Rimnicu Vilcea",
  Sibiu: "Sibiu",
  Timisoara: "Timisoara",
  Urziceni: "Urziceni",
  Vaslui: "Vaslui",
  Zerind: "Zerind",
};

interface Road {
  to: City;
  cost: number;
}

function undirectedRoads(): Record<City, Road[]> {
  const graph = new Map<City, Road[]>();
  const connect = (from: City, to: City, cost: number) => {
    const roads = graph.get(from) ?? [];
    if (!roads.some((road) => road.to === to)) {
      roads.push({ to, cost });
      graph.set(from, roads);
    }
  };

  for (const from of Object.keys(ONE_WAY)) {
    for (const [to, cost] of Object.entries(ONE_WAY[from])) {
      connect(from as City, to as City, cost);
      connect(to as City, from as City, cost);
    }
  }

  return Object.fromEntries(graph) as Record<City, Road[]>;
}

const ROADS = undirectedRoads();

export function romaniaProblem(
  start: City = "Arad",
  goal: City = "Bucharest",
): Problem<City, City> {
  return {
    initial: start,
    actions(state) {
      return (ROADS[state] ?? []).map((road) => road.to);
    },
    result(_state, action) {
      return action;
    },
    actionCost(state, action) {
      const road = (ROADS[state] ?? []).find((item) => item.to === action);
      if (!road) {
        throw new Error(`No road from ${state} to ${action}`);
      }
      return road.cost;
    },
    isGoal(state) {
      return state === goal;
    },
    stateKey(state) {
      return state;
    },
  };
}

export function romaniaEdges(): Array<{ from: City; to: City; cost: number }> {
  const seen = new Set<string>();
  const edges: Array<{ from: City; to: City; cost: number }> = [];
  for (const from of CITIES) {
    for (const road of ROADS[from] ?? []) {
      const key = [from, road.to].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to: road.to, cost: road.cost });
    }
  }
  return edges;
}
