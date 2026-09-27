import {
  CITIES,
  romaniaDisplay,
  romaniaProblem,
  ROMANIA_LOCATIONS,
  ROMANIA_SLD,
  type City,
  type Frame,
  type RomaniaLabelMode,
} from "@/lib/search";
import { nodeLabels, type NodeLabels } from "./labels";
import { marksFor, nodeScore } from "./marks";

export interface RoadNote {
  to: string;
  cost: number;
}

function project(loc: { x: number; y: number }) {
  return {
    x: (loc.x - 80) * 1.15 + 24,
    y: (580 - loc.y) * 1.15 + 28,
  };
}

function atCity(name: string) {
  if (!(name in ROMANIA_LOCATIONS)) return null;
  return project(ROMANIA_LOCATIONS[name as City]);
}

export function RomaniaSheet({
  frame,
  edges,
  roads,
  onHover,
  labels = nodeLabels("bfs"),
  heuristic,
  labelMode = "letters",
}: {
  frame: Frame;
  edges: Array<{ from: City; to: City; cost: number }>;
  roads: Record<City, RoadNote[]>;
  onHover: (
    info: {
      name: string;
      label: string;
      x: number;
      y: number;
      roads: RoadNote[];
    } | null,
  ) => void;
  labels?: NodeLabels;
  heuristic?: (city: City) => number;
  labelMode?: RomaniaLabelMode;
}) {
  const problem = romaniaProblem();
  const heuristicOf = heuristic ?? ((city: City) => ROMANIA_SLD[city]);
  return (
    <div className="romania-wrap" data-label-mode={labelMode}>
    <svg
      className="romania"
      viewBox="0 0 640 440"
      role="img"
      aria-label="Romania map"
    >
      {edges.map((edge) => {
        const a = project(ROMANIA_LOCATIONS[edge.from]);
        const b = project(ROMANIA_LOCATIONS[edge.to]);
        const cost = problem.stepCost(edge.from, edge.to, edge.to);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const short = length < 72;
        const lift = short ? 24 : 12;
        let mx = (a.x + b.x) / 2 + (short && Math.abs(dx) < Math.abs(dy) ? -26 : nx * lift);
        let my = (a.y + b.y) / 2 + (short && Math.abs(dx) < Math.abs(dy) ? 0 : ny * lift);
        const hitsCity = (Object.keys(ROMANIA_LOCATIONS) as City[]).some((city) => {
          const at = project(ROMANIA_LOCATIONS[city]);
          return Math.hypot(at.x - mx, at.y - my) < 26;
        });
        if (hitsCity) {
          mx = (a.x + b.x) / 2 - nx * lift;
          my = (a.y + b.y) / 2 - ny * lift;
        }
        const chip = 7 + String(cost).length * 3.4;
        return (
          <g key={`${edge.from}-${edge.to}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="road" />
            {labels.showEdgeCosts ? (
            <g
              className="edge-cost"
              data-edge-cost={cost}
              data-from={edge.from}
              data-to={edge.to}
            >
              <rect
                className="cost-chip"
                x={mx - chip}
                y={my - 7}
                width={chip * 2}
                height={14}
              />
              <text className="cost-chip-text" x={mx} y={my + 3.5} textAnchor="middle">
                {cost}
              </text>
            </g>
            ) : null}
          </g>
        );
      })}
      {frame.treeEdges.map((edge) => {
        const a = atCity(edge.from);
        const b = atCity(edge.to);
        if (!a || !b) return null;
        return (
          <line
            key={edge.key}
            data-tree-edge={edge.key}
            data-repeated={edge.repeated ? "true" : "false"}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className={edge.repeated ? "tree-edge tree-edge-repeat" : "tree-edge"}
          />
        );
      })}
      {frame.arrows.map((arrow) => {
        const a = atCity(arrow.from);
        const b = atCity(arrow.to);
        if (!a || !b) return null;
        return (
          <line
            key={`${arrow.from}>${arrow.to}`}
            className="gen-arrow"
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
          />
        );
      })}
      {frame.path.length > 1
        ? frame.path.slice(0, -1).map((from, index) => {
            const a = atCity(from);
            const b = atCity(frame.path[index + 1]);
            if (!a || !b) return null;
            return (
              <line
                key={`solution-${from}`}
                className="solution"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
              />
            );
          })
        : null}
      {(Object.keys(ROMANIA_LOCATIONS) as City[]).map((city) => {
        const at = project(ROMANIA_LOCATIONS[city]);
        const marks = marksFor(city, frame);
        const score = nodeScore(city, frame);
        const reached = score !== null;
        const h = labels.showH && heuristic ? heuristic(city) : null;
        const showG = labels.showG && reached && score !== null;
        const showF = labels.showF && marks.frontier && score !== null;
        const loc = ROMANIA_LOCATIONS[city];
        const radius = h !== null ? 13 : 8;
        const crowdedBelow = (Object.keys(ROMANIA_LOCATIONS) as City[]).some((other) => {
          if (other === city) return false;
          const there = project(ROMANIA_LOCATIONS[other]);
          return there.y > at.y && there.y - at.y < 54 && Math.abs(there.x - at.x) < 40;
        });
        return (
          <g
            key={city}
            className="city"
            data-cell={city}
            data-explored={marks.explored ? "true" : "false"}
            data-frontier={marks.frontier ? "true" : "false"}
            data-path={marks.solution ? "true" : "false"}
            data-current={marks.current ? "true" : "false"}
            data-repeated={marks.repeated ? "true" : "false"}
            data-cutoff={marks.cutoff ? "true" : "false"}
            data-depth={frame.depths[city] ?? ""}
            data-wall="false"
            data-replaced={frame.replacedKey === city ? "true" : "false"}
            data-start={city === problem.initial ? "true" : "false"}
            data-goal={problem.goalTest(city) ? "true" : "false"}
            data-g={showG && score ? String(score.g) : ""}
            data-h={h !== null ? String(h) : ""}
            data-f={showF && score ? String(score.f) : ""}
            data-display={romaniaDisplay(city, labelMode)}
            tabIndex={0}
            role="button"
            aria-label={romaniaDisplay(city, labelMode)}
            onMouseEnter={() =>
              onHover({
                name: city,
                label: romaniaDisplay(city, labelMode),
                x: loc.x,
                y: loc.y,
                roads: roads[city],
              })
            }
            onFocus={() =>
              onHover({
                name: city,
                label: romaniaDisplay(city, labelMode),
                x: loc.x,
                y: loc.y,
                roads: roads[city],
              })
            }
            onMouseLeave={() => onHover(null)}
          >
            <circle cx={at.x} cy={at.y} r={radius} />
            {h !== null ? (
              <text className="node-h" x={at.x} y={at.y + 3} textAnchor="middle">
                {h}
              </text>
            ) : null}
            <text
              className="city-name"
              x={crowdedBelow ? at.x - radius - 4 : at.x}
              y={crowdedBelow ? at.y + 4 : at.y + radius + 13}
              textAnchor={crowdedBelow ? "end" : "middle"}
            >
              {romaniaDisplay(city, labelMode)}
            </text>
            {showG && score ? (
              <text
                className={labels.orderBy === "h" ? "node-g node-g-paid" : "node-g"}
                x={at.x - radius - 4}
                y={at.y + 3}
                textAnchor="end"
              >
                {`g${score.g}`}
              </text>
            ) : null}
            {showF && score ? (
              <text
                className="node-f node-f-hot"
                x={at.x + radius + 4}
                y={at.y - 3}
                textAnchor="start"
              >
                {`f${score.f}`}
              </text>
            ) : null}
            {labels.showDepth && frame.depths[city] !== undefined ? (
              <text className="node-depth" x={at.x + radius + 2} y={at.y - radius + 2}>
                {`d${frame.depths[city]}`}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
    {labels.showH ? <HeuristicTable mode={labelMode} heuristic={heuristicOf} /> : null}
    </div>
  );
}

function HeuristicTable({
  mode,
  heuristic,
}: {
  mode: RomaniaLabelMode;
  heuristic: (city: City) => number;
}) {
  return (
    <table className="heuristic-table" data-heuristic-table="">
      <caption>
        {mode === "letters"
          ? "h(n) — straight-line distance to G"
          : "h(n) — straight-line distance to Bucharest"}
      </caption>
      <thead>
        <tr>
          <th>Node</th>
          <th>h(n)</th>
        </tr>
      </thead>
      <tbody>
        {CITIES.map((city) => (
          <tr key={city} data-h-node={city} data-h-value={heuristic(city)}>
            <td>{romaniaDisplay(city, mode)}</td>
            <td>{heuristic(city)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
