import type { Frame } from "@/lib/search";
import {
  enterCost,
  gridKey,
  gridProblem,
  isWall,
  type GridAction,
  type GridSpec,
  type GridState,
} from "@/lib/search/problems/grid";
import { nodeLabels, type NodeLabels } from "./labels";
import { marksFor, nodeScore } from "./marks";

const CELL = 76;

function center(key: string): string | null {
  const [x, y] = key.split(",").map(Number);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return `${x * CELL + CELL / 2},${y * CELL + CELL / 2}`;
}

const OPPOSITE: Record<GridAction, GridAction> = {
  N: "S",
  S: "N",
  E: "W",
  W: "E",
};

function gridEdges(spec: GridSpec, showUnitCosts: boolean) {
  const problem = gridProblem(spec);
  const seen = new Set<string>();
  const edges: Array<{
    from: string;
    to: string;
    cost: number;
    mx: number;
    my: number;
  }> = [];
  for (let y = 0; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      const state: GridState = { x, y };
      if (isWall(spec, state)) continue;
      for (const action of problem.actions(state)) {
        const next = problem.result(state, action);
        const from = gridKey(state);
        const to = gridKey(next);
        const undirected = [from, to].sort().join("|");
        if (seen.has(undirected)) continue;
        seen.add(undirected);
        const forward = problem.actionCost(state, action, next);
        const back = problem.actionCost(next, OPPOSITE[action], state);
        const mx = ((x + next.x) / 2) * CELL + CELL / 2;
        const my = ((y + next.y) / 2) * CELL + CELL / 2;
        if (forward === back) {
          if (forward !== 1 || showUnitCosts) {
            edges.push({ from, to, cost: forward, mx, my });
          }
        } else {
          edges.push({ from, to, cost: forward, mx: mx - 8, my });
          edges.push({ from: to, to: from, cost: back, mx: mx + 8, my });
        }
      }
    }
  }
  return edges;
}

export function GridSheet({
  spec,
  frame,
  onHover,
  labels = nodeLabels("bfs"),
  heuristic,
  showUnitCosts = false,
}: {
  spec: GridSpec;
  frame: Frame;
  onHover: (
    info: { key: string; wall: boolean; cost: number } | null,
  ) => void;
  labels?: NodeLabels;
  heuristic?: (state: GridState) => number;
  showUnitCosts?: boolean;
}) {
  const width = spec.width * CELL;
  const height = spec.height * CELL;
  const solution = frame.path
    .map((key) => center(key))
    .filter((point): point is string => point !== null)
    .join(" ");

  return (
    <div
      className="grid-sheet"
      role="grid"
      aria-label="Grid"
      style={{
        gridTemplateColumns: `repeat(${spec.width}, ${CELL}px)`,
        width,
        height,
      }}
    >
      {Array.from({ length: spec.height }, (_, y) =>
        Array.from({ length: spec.width }, (_, x) => {
          const state = { x, y };
          const key = gridKey(state);
          const wall = isWall(spec, state);
          const marks = marksFor(key, frame, wall);
          const start = state.x === spec.start.x && state.y === spec.start.y;
          const goal = state.x === spec.goal.x && state.y === spec.goal.y;
          const score = wall ? null : nodeScore(key, frame);
          const reached = score !== null;
          const h = !wall && labels.showH && heuristic ? heuristic(state) : null;
          const showG = labels.showG && reached && score !== null;
          const showF = labels.showF && marks.frontier && score !== null;
          const label = start ? "S" : goal ? "G" : "";
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className="cell"
              data-cell={key}
              data-reached={marks.reached ? "true" : "false"}
              data-frontier={marks.frontier ? "true" : "false"}
              data-path={marks.solution ? "true" : "false"}
              data-current={marks.current ? "true" : "false"}
              data-repeated={marks.repeated ? "true" : "false"}
              data-cutoff={marks.cutoff ? "true" : "false"}
              data-depth={frame.depths[key] ?? ""}
              data-wall={marks.wall ? "true" : "false"}
              data-start={start ? "true" : "false"}
              data-goal={goal ? "true" : "false"}
              data-replaced={frame.replacedKey === key ? "true" : "false"}
              data-g={showG && score ? String(score.g) : ""}
              data-h={h !== null ? String(h) : ""}
              data-f={showF && score ? String(score.f) : ""}
              aria-label={key}
              onMouseEnter={() =>
                onHover({ key, wall, cost: enterCost(spec, state) })
              }
              onFocus={() => onHover({ key, wall, cost: enterCost(spec, state) })}
              onMouseLeave={() => onHover(null)}
            >
              {label ? <span className="cell-tag">{label}</span> : (
                <span className="cell-name">{key}</span>
              )}
              {h !== null ? <span className="cell-h">h{h}</span> : null}
              {showG && score ? (
                <span
                  className={labels.orderBy === "h" ? "cell-g cell-g-paid" : "cell-g"}
                >
                  g{score.g}
                </span>
              ) : null}
              {showF && score ? (
                <span className={marks.frontier ? "cell-f cell-f-hot" : "cell-f"}>
                  f{score.f}
                </span>
              ) : null}
              {labels.showDepth && frame.depths[key] !== undefined ? (
                <span className="cell-depth">d{frame.depths[key]}</span>
              ) : null}
              {marks.cutoff ? <span className="cutoff-tag">cutoff</span> : null}
              {marks.repeated ? <span className="again">again</span> : null}
            </button>
          );
        }),
      )}
      <svg
        className="ink"
        aria-hidden="true"
        viewBox={`0 0 ${width} ${height}`}
      >
        {frame.treeEdges.map((edge) => {
          const from = center(edge.from);
          const to = center(edge.to);
          if (!from || !to) return null;
          const [x1, y1] = from.split(",");
          const [x2, y2] = to.split(",");
          return (
            <line
              key={edge.key}
              data-tree-edge={edge.key}
              data-repeated={edge.repeated ? "true" : "false"}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={edge.repeated ? "tree-edge tree-edge-repeat" : "tree-edge"}
            />
          );
        })}
        {frame.arrows.map((arrow) => {
          const from = center(arrow.from);
          const to = center(arrow.to);
          if (!from || !to) return null;
          const [x1, y1] = from.split(",");
          const [x2, y2] = to.split(",");
          return (
            <line
              key={`${arrow.from}>${arrow.to}`}
              className="gen-arrow"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          );
        })}
        {frame.path.length > 1 ? (
          <polyline className="solution" points={solution} />
        ) : null}
        {(labels.showEdgeCosts ? gridEdges(spec, showUnitCosts) : []).map((edge) => (
          <g
            key={`${edge.from}>${edge.to}`}
            className="edge-cost"
            data-edge-cost={edge.cost}
            data-from={edge.from}
            data-to={edge.to}
          >
            <rect
              className="cost-chip"
              x={edge.mx - 8}
              y={edge.my - 7}
              width={16}
              height={14}
            />
            <text className="cost-chip-text" x={edge.mx} y={edge.my + 4} textAnchor="middle">
              {edge.cost}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
