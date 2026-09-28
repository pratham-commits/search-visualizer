"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CITIES,
  ROMANIA_SLD,
  ANNEAL_DEMO_SCHEDULE,
  ANNEAL_DEMO_SEED,
  ALGORITHM_FAMILIES,
  BEAM_DEMO_SEED,
  DLS_GRAPH_CAPTION,
  GA_DEMO_SEED,
  GA_GENERATIONS,
  GA_PMUT,
  GA_POP,
  HILL_DEMO_SEED,
  LANDSCAPE_START,
  describeEvent,
  familySpec,
  frameAt,
  enterCost,
  geneticAlgorithm,
  gridProblem,
  hillClimbing,
  isWall,
  landscapeProblem,
  localBeamSearch,
  manhattan,
  queensProblem,
  romaniaDisplay,
  romaniaEdges,
  romaniaProblem,
  runSelection,
  selectionInfo,
  simulatedAnnealing,
  wallGrid,
  type AlgorithmFamily,
  type City,
  type RomaniaLabelMode,
  type VariantKind,
} from "@/lib/search";
import { ColorLegend } from "./ColorLegend";
import { nodeLabels } from "./labels";
import { Explanation } from "./Explanation";
import { FrontierBoard } from "./FrontierBoard";
import { GridSheet } from "./GridSheet";
import { LimitNote } from "./LimitNote";
import { LocalSheet } from "./LocalSheet";
import { RomaniaSheet, type RoadNote } from "./RomaniaSheet";
import { Scrubber } from "./Scrubber";

const QUEENS = queensProblem();
const LANDSCAPE = landscapeProblem();

function isLocalFamily(family: AlgorithmFamily): boolean {
  return (
    family === "hill-climbing" ||
    family === "annealing" ||
    family === "beam" ||
    family === "genetic"
  );
}

const DEMO_SEED: Partial<Record<AlgorithmFamily, number>> = {
  "hill-climbing": HILL_DEMO_SEED,
  annealing: ANNEAL_DEMO_SEED,
  beam: BEAM_DEMO_SEED,
  genetic: GA_DEMO_SEED,
};

const GRID = gridProblem(wallGrid);
const ROMANIA = romaniaProblem();
const EDGES = romaniaEdges();
const ROADS = Object.fromEntries(
  CITIES.map((city) => [
    city,
    ROMANIA.actions(city).map((to) => ({
      to,
      cost: ROMANIA.actionCost(city, to, to),
    })),
  ]),
) as Record<City, RoadNote[]>;

type ProblemId = "grid" | "romania" | "queens" | "landscape";

function problemsFor(family: AlgorithmFamily): Array<[ProblemId, string]> {
  if (family === "ucs" || family === "greedy" || family === "astar") {
    return [["romania", "Romania"]];
  }
  if (family === "beam" || family === "genetic") {
    return [["queens", "8 queens"]];
  }
  if (isLocalFamily(family)) {
    return [
      ["queens", "8 queens"],
      ["landscape", "Landscape"],
    ];
  }
  return [
    ["grid", "Wall grid"],
    ["romania", "Romania"],
  ];
}

type Hover =
  | { kind: "grid"; key: string; wall: boolean; cost: number }
  | {
      kind: "city";
      name: string;
      label: string;
      x: number;
      y: number;
      roads: RoadNote[];
    }
  | null;

export function SearchBench() {
  const [problemId, setProblemId] = useState<ProblemId>("grid");
  const [family, setFamily] = useState<AlgorithmFamily>("bfs");
  const [variant, setVariant] = useState<VariantKind>("graph");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [limit, setLimit] = useState(2);
  const [showUnitCosts, setShowUnitCosts] = useState(false);
  const [romaniaLabels, setRomaniaLabels] = useState<RomaniaLabelMode>("letters");
  const [seed, setSeed] = useState(HILL_DEMO_SEED);
  const [sideways, setSideways] = useState(false);
  const [sidewaysLimit, setSidewaysLimit] = useState(100);
  const [beamK, setBeamK] = useState(3);
  const [hover, setHover] = useState<Hover>(null);
  const local = isLocalFamily(family);

  const spec = familySpec(family);
  const labels = nodeLabels(family);
  const info = selectionInfo(family, variant);
  const run = useMemo(() => {
    if (family === "hill-climbing") {
      return problemId === "landscape"
        ? hillClimbing(LANDSCAPE, { seed, initial: LANDSCAPE_START, sideways, sidewaysLimit })
        : hillClimbing(QUEENS, { seed, sideways, sidewaysLimit });
    }
    if (family === "annealing") {
      return problemId === "landscape"
        ? simulatedAnnealing(LANDSCAPE, {
            seed,
            initial: LANDSCAPE_START,
            schedule: ANNEAL_DEMO_SCHEDULE,
          })
        : simulatedAnnealing(QUEENS, { seed, schedule: ANNEAL_DEMO_SCHEDULE });
    }
    if (family === "beam") return localBeamSearch(QUEENS, { seed, k: beamK, rounds: 6 });
    if (family === "genetic") {
      return geneticAlgorithm(QUEENS, {
        seed,
        pop: GA_POP,
        generations: GA_GENERATIONS,
        pmut: GA_PMUT,
      });
    }
    if (problemId === "romania") {
      return runSelection(ROMANIA, family, variant, {
        limit,
        h: (city) => ROMANIA_SLD[city],
      });
    }
    return runSelection(GRID, family, variant, {
      limit,
      h: (state) => manhattan(state, wallGrid.goal),
    });
  }, [problemId, family, variant, limit, seed, beamK, sideways, sidewaysLimit]);

  const atEnd = !run || index >= run.trace.length - 1;

  useEffect(() => {
    if (!playing || atEnd || !run) return;
    const length = run.trace.length;
    const delay = 900 - speed * 90;
    const id = window.setInterval(() => {
      setIndex((current) => (current >= length - 1 ? current : current + 1));
    }, delay);
    return () => window.clearInterval(id);
  }, [playing, atEnd, speed, run]);

  const safeIndex = run ? Math.min(index, run.trace.length - 1) : 0;
  const frame = run ? frameAt(run.trace, safeIndex) : null;
  const event = run ? run.trace[safeIndex] : null;

  return (
    <div className="notebook">
      <aside className="margin">
        <p className="kicker">AIMA search</p>
        <h1>Search sheet</h1>
        <p className="blurb">{info.line}</p>
        {family === "ucs" ? (
          <p className="ucs-subtitle" data-ucs-subtitle="">
            also known as Dijkstra&apos;s algorithm
          </p>
        ) : null}
        <dl className="policy">
          <div>
            <dt>Frontier</dt>
            <dd>{info.frontier}</dd>
          </div>
          <div>
            <dt>Is-Goal</dt>
            <dd>{info.goalLabel ?? (info.isGoalWhen === "generate" ? "on generate" : "on pop")}</dd>
          </div>
          <div>
            <dt>Reached</dt>
            <dd data-policy-reached="">{info.reached}</dd>
          </div>
          {info.f === "—" ? null : (
            <div>
              <dt>f(n)</dt>
              <dd data-policy-f="">{info.f}</dd>
            </div>
          )}
        </dl>
        <pre className="pseudocode">{info.pseudocode}</pre>
        <div className="readout" aria-live="polite" aria-label="Cell">
          <CellReadout
            cellKey={
              hover?.kind === "grid"
                ? hover.key
                : hover?.kind === "city"
                  ? hover.name
                  : (frame?.focusKey ?? null)
            }
            frame={frame}
            problemId={problemId}
            hover={hover}
            labelMode={romaniaLabels}
            labels={labels}
          />
        </div>
        <p className="cost-line">
          {!frame
            ? "not built yet"
            : local
              ? frame.status === "success"
                ? `goal · value ${frame.objective}`
                : frame.status === "finished"
                  ? `stopped · value ${frame.objective}`
                  : `value ${frame.objective ?? "—"}`
            : frame.status === "success"
            ? `cost ${frame.cost}`
            : frame.status === "cutoff"
              ? "cut off"
              : frame.status === "failure"
                ? "no path"
                : "running"}
        </p>
      </aside>

      <div className="page">
        <div className="choices">
          <fieldset>
            <legend>Problem</legend>
            {problemsFor(family).map(([id, name]) => (
              <button
                key={id}
                type="button"
                className="stamp"
                aria-pressed={problemId === id}
                onClick={() => {
                  setProblemId(id);
                  if ((id === "grid" || id === "romania") && local) {
                    setFamily("bfs");
                    setVariant("graph");
                  }
                  if (id === "queens" && !local) setFamily("hill-climbing");
                  if (id === "landscape" && family !== "hill-climbing" && family !== "annealing") {
                    setFamily("hill-climbing");
                    setSeed(HILL_DEMO_SEED);
                  }
                  setIndex(0);
                  setPlaying(false);
                }}
              >
                {name}
              </button>
            ))}
            {problemId === "grid" && labels.showEdgeCosts ? (
              <label className="unit-toggle">
                <input
                  type="checkbox"
                  checked={showUnitCosts}
                  onChange={(event) => setShowUnitCosts(event.target.checked)}
                />
                show unit costs
              </label>
            ) : null}
          </fieldset>
          {problemId === "romania" ? (
            <fieldset>
              <legend>Labels</legend>
              <button
                type="button"
                className="stamp"
                aria-pressed={romaniaLabels === "letters"}
                onClick={() => setRomaniaLabels("letters")}
              >
                Letters
              </button>
              <button
                type="button"
                className="stamp"
                aria-pressed={romaniaLabels === "cities"}
                onClick={() => setRomaniaLabels("cities")}
              >
                Cities
              </button>
            </fieldset>
          ) : null}
          <fieldset>
            <legend>Algorithm</legend>
            {ALGORITHM_FAMILIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="stamp"
                aria-pressed={family === item.id}
              onClick={() => {
                setFamily(item.id);
                setVariant(item.defaultVariant ?? "graph");
                if (DEMO_SEED[item.id] !== undefined) setSeed(DEMO_SEED[item.id] ?? 1);
                const allowed = problemsFor(item.id).map(([id]) => id);
                if (!allowed.includes(problemId)) setProblemId(allowed[0]);
                setIndex(0);
                setPlaying(false);
              }}
              >
                {item.name}
              </button>
            ))}
          </fieldset>
          {spec.control === "toggle" ? (
            <fieldset aria-label="Search variant">
              <legend>Variant</legend>
              <button
                type="button"
                className="stamp"
                aria-pressed={variant === "tree"}
                onClick={() => {
                  setVariant("tree");
                  setIndex(0);
                  setPlaying(false);
                }}
              >
                Tree-like
              </button>
              <button
                type="button"
                className="stamp"
                aria-pressed={variant === "graph"}
                onClick={() => {
                  setVariant("graph");
                  setIndex(0);
                  setPlaying(false);
                }}
              >
                Graph
              </button>
              {(family === "dls" || family === "ids") && variant === "graph" ? (
                <p className="variant-caption" data-variant-caption="">
                  {DLS_GRAPH_CAPTION}
                </p>
              ) : null}
            </fieldset>
          ) : null}
          {spec.control === "fixed" ? (
            <fieldset>
              <legend>Variant</legend>
              <p className="variant-fixed" data-variant-label="">
                Graph
              </p>
            </fieldset>
          ) : null}
          {local ? (
            <fieldset>
              <legend>Seed</legend>
              <label className="limit-field">
                seed
                <input
                  type="number"
                  min={1}
                  aria-label="Random seed"
                  value={seed}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isInteger(next)) return;
                    setSeed(Math.max(1, next));
                    setIndex(0);
                    setPlaying(false);
                  }}
                />
              </label>
              {family === "hill-climbing" ? (
                <label className="unit-toggle">
                  <input
                    type="checkbox"
                    checked={sideways}
                    aria-label="sideways moves"
                    onChange={(event) => {
                      setSideways(event.target.checked);
                      setIndex(0);
                      setPlaying(false);
                    }}
                  />
                  sideways moves
                </label>
              ) : null}
              {family === "hill-climbing" && sideways ? (
                <label className="limit-field">
                  cap
                  <input
                    type="number"
                    min={1}
                    aria-label="Sideways cap"
                    value={sidewaysLimit}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isInteger(next)) return;
                      setSidewaysLimit(Math.max(1, next));
                      setIndex(0);
                      setPlaying(false);
                    }}
                  />
                </label>
              ) : null}
              {family === "beam" ? (
                <label className="limit-field">
                  k
                  <input
                    type="number"
                    min={2}
                    max={6}
                    aria-label="Beam width"
                    value={beamK}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isInteger(next)) return;
                      setBeamK(Math.min(6, Math.max(2, next)));
                      setIndex(0);
                      setPlaying(false);
                    }}
                  />
                </label>
              ) : null}
            </fieldset>
          ) : null}
          {family === "dls" ? (
            <fieldset>
              <legend>Depth limit L</legend>
              <label className="limit-field">
                L
                <input
                  type="number"
                  min={0}
                  max={12}
                  aria-label="Depth limit"
                  value={limit}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isInteger(next)) return;
                    setLimit(Math.min(12, Math.max(0, next)));
                    setIndex(0);
                    setPlaying(false);
                  }}
                />
              </label>
            </fieldset>
          ) : null}
        </div>

        {frame ? <LimitNote frame={frame} /> : null}

        {run && frame ? (
        <>
        <div className="stage">
          <div className="figure">
            {local && frame ? (
              <LocalSheet frame={frame} landscape={problemId === "landscape"} />
            ) : problemId === "grid" ? (
              <>
                <GridSheet
                  spec={wallGrid}
                  frame={frame}
                  labels={labels}
                  heuristic={(state) => manhattan(state, wallGrid.goal)}
                  showUnitCosts={showUnitCosts}
                  onHover={(info) =>
                    setHover(info ? { kind: "grid", ...info } : null)
                  }
                />
                <ColorLegend />
              </>
            ) : (
              <RomaniaSheet
                frame={frame}
                edges={EDGES}
                roads={ROADS}
                labels={labels}
                heuristic={(city) => ROMANIA_SLD[city]}
                labelMode={romaniaLabels}
                onHover={(next) =>
                  setHover(next ? { kind: "city", ...next } : null)
                }
              />
            )}
          </div>
          {local ? null : (
            <FrontierBoard
              frame={frame}
              labels={labels}
              labelMode={problemId === "romania" ? romaniaLabels : "cities"}
            />
          )}
        </div>
        {labels.orderBy === "h" ? (
          <p className="label-note" data-order-note="">
            Frontier order uses h. g is the cost paid so far.
          </p>
        ) : null}
        </>
        ) : (
          <p className="not-ready">This algorithm is not on the sheet yet.</p>
        )}

        {event ? (
          <Explanation
            event={event}
            labelMode={problemId === "romania" ? romaniaLabels : "cities"}
          />
        ) : null}

        {run ? <Scrubber
          index={safeIndex}
          length={run.trace.length}
          playing={playing && !atEnd}
          speed={speed}
          label={event ? describeEvent(event) : "empty"}
          onIndex={(next) => {
            setPlaying(false);
            setIndex(next);
          }}
          onPlaying={(next) => {
            if (next && atEnd) setIndex(0);
            setPlaying(next);
          }}
          onSpeed={setSpeed}
        /> : null}
      </div>
    </div>
  );
}

function CellReadout({
  cellKey,
  frame,
  problemId,
  hover,
  labelMode,
  labels,
}: {
  cellKey: string | null;
  frame: ReturnType<typeof frameAt> | null;
  problemId: ProblemId;
  hover: Hover;
  labelMode: RomaniaLabelMode;
  labels: ReturnType<typeof nodeLabels>;
}) {
  if (!frame) {
    return (
      <>
        <p className="readout-title">Cell</p>
        <p>This algorithm is not on the sheet yet.</p>
      </>
    );
  }
  if (!cellKey) {
    if (frame.iteration !== null && frame.status === "running") {
      return (
        <>
          <p className="readout-title">Restart</p>
          <p>Limit {frame.limit}. The tree from the previous iteration is cleared.</p>
        </>
      );
    }
    if (frame.status === "cutoff") {
      return (
        <>
          <p className="readout-title">Cutoff</p>
          <p>
            Limit {frame.limit}. Reached on {frame.cutoff.join(", ") || "no cell"}.
          </p>
        </>
      );
    }
    if (frame.status === "failure") {
      return (
        <>
          <p className="readout-title">Failure</p>
          <p>No branch hit the limit, and there is no solution.</p>
        </>
      );
    }
    if (frame.status === "success") {
      return (
        <>
          <p className="readout-title">Solution</p>
          <p>{frame.path.join(" → ")}</p>
        </>
      );
    }
    return (
      <>
        <p className="readout-title">Cell</p>
        <p>The trace has not focused a cell yet.</p>
      </>
    );
  }
  const depth = frame.depths[cellKey];
  const g = frame.frontier.find((item) => item.stateKey === cellKey)?.g;
  const role = frame.cutoff.includes(cellKey)
    ? "cutoff"
    : frame.frontier.some((item) => item.stateKey === cellKey)
      ? "frontier"
      : frame.reached.includes(cellKey)
        ? "reached"
        : frame.path.includes(cellKey)
          ? "solution"
          : "open";
  if (problemId === "queens" || problemId === "landscape") {
    return (
      <>
        <p className="readout-title">{problemId === "landscape" ? "Landscape" : "8 queens"}</p>
        <p>value {frame.objective ?? "—"}</p>
        <p>No frontier, no reached table, no g/h/f.</p>
      </>
    );
  }
  if (problemId === "romania") {
    const city = cellKey as City;
    const loc = hover?.kind === "city" ? hover : null;
    const sld = ROMANIA_SLD[city];
    return (
      <>
        <p className="readout-title">{romaniaDisplay(city, labelMode)}</p>
        <p>
          {role}
          {depth !== undefined ? ` · depth ${depth}` : ""}
          {labels.showG && g !== undefined ? ` · g ${g}` : ""}
          {frame.limit !== null ? ` · limit ${frame.limit}` : ""}
        </p>
        {loc ? (
          <p>
            {loc.x}, {loc.y}
            {labels.showH && sld !== undefined ? ` · sld ${sld}` : ""}
          </p>
        ) : null}
        <ul>
          {(loc?.roads ?? ROADS[city] ?? []).map((road) => (
            <li key={road.to}>
              {romaniaDisplay(road.to, labelMode)}
              {labels.showEdgeCosts ? ` ${road.cost}` : ""}
            </li>
          ))}
        </ul>
      </>
    );
  }
  const [x, y] = cellKey.split(",").map(Number);
  const state = { x, y };
  const wall = Number.isInteger(x) && isWall(wallGrid, state);
  const cost = wall ? null : enterCost(wallGrid, state);
  return (
    <>
      <p className="readout-title">{cellKey}</p>
      <p>
        {wall ? "wall" : role}
        {depth !== undefined ? ` · depth ${depth}` : ""}
        {labels.showG && g !== undefined ? ` · g ${g}` : ""}
        {frame.limit !== null ? ` · limit ${frame.limit}` : ""}
      </p>
      {labels.showEdgeCosts && cost !== null && !wall ? <p>action cost {cost}</p> : null}
    </>
  );
}
