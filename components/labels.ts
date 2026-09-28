import type { AlgorithmFamily } from "@/lib/search";

/** Which numbers a family is allowed to draw on a node. */
export interface NodeLabels {
  showH: boolean;
  showG: boolean;
  showF: boolean;
  showDepth: boolean;
  /** Road or grid action costs. Uninformed search treats every action as equal. */
  showEdgeCosts: boolean;
  /** What the frontier is sorted by, when that is a number on the node. */
  orderBy: "h" | "g" | "f" | "depth";
}

const UNINFORMED: NodeLabels = {
  showH: false,
  showG: false,
  showF: false,
  showDepth: true,
  showEdgeCosts: false,
  orderBy: "depth",
};

export function nodeLabels(family: AlgorithmFamily): NodeLabels {
  switch (family) {
    case "ucs":
      return {
        showH: false,
        showG: true,
        showF: false,
        showDepth: false,
        showEdgeCosts: true,
        orderBy: "g",
      };
    case "greedy":
      return {
        showH: true,
        showG: false,
        showF: false,
        showDepth: false,
        showEdgeCosts: true,
        orderBy: "h",
      };
    case "astar":
      return {
        showH: true,
        showG: true,
        showF: true,
        showDepth: false,
        showEdgeCosts: true,
        orderBy: "f",
      };
    case "hill-climbing":
    case "annealing":
    case "beam":
    case "genetic":
      return {
        showH: false,
        showG: false,
        showF: false,
        showDepth: false,
        showEdgeCosts: false,
        orderBy: "depth",
      };
    default:
      return UNINFORMED;
  }
}
