import { formatProb, formatTemp } from "@/lib/search";
import { LANDSCAPE_VALUES } from "@/lib/search/problems/landscape";
import { queenAttacks } from "@/lib/search/problems/queens";
import type { BeamMember, Frame, GaIndividual } from "@/lib/search";

function afterQueens(frame: Frame): number[] | null {
  const event = frame.local;
  if (!event) return null;
  if (event.type === "climb") return event.moved ? event.bestQueens : event.currentQueens;
  if (event.type === "anneal") {
    return event.accepted && event.neighborQueens ? event.neighborQueens : event.currentQueens;
  }
  return null;
}

function afterX(frame: Frame): number | null {
  const event = frame.local;
  if (!event) return null;
  if (event.type === "climb") return event.moved ? event.bestX : event.currentX;
  if (event.type === "anneal") {
    return event.accepted && event.neighborX !== null ? event.neighborX : event.currentX;
  }
  return null;
}

export function LocalSheet({ frame, landscape }: { frame: Frame; landscape: boolean }) {
  const event = frame.local;
  if (!event || (event.type !== "climb" && event.type !== "anneal" && event.type !== "beam" && event.type !== "ga")) {
    return null;
  }

  if (event.type === "beam") {
    return (
      <div className="local-sheet" data-local="beam">
        <p className="local-caption">
          k = {event.k}. One shared pool, then the best {event.k}. Round {event.round}.
        </p>
        <div className="beam-row">
          {event.chosen.map((member, index) => (
            <BeamCard key={`${member.key}-${index}`} member={member} index={index} />
          ))}
        </div>
        {event.pool.length > 0 ? (
          <div className="pool" data-pool-size={event.pool.length}>
            <p>Combined successor pool</p>
            <ol>
              {[...event.pool]
                .sort((a, b) => b.value - a.value)
                .map((member, index) => (
                  <li
                    key={`${member.key}-${member.parentKey}-${index}`}
                    data-pool-value={member.value}
                    data-pool-parent={member.parentKey ?? ""}
                  >
                    {member.value}
                  </li>
                ))}
            </ol>
          </div>
        ) : null}
        <ValueChart points={frame.trail.map((point) => point.value)} label="Best in the beam" />
      </div>
    );
  }

  if (event.type === "ga") {
    const people = event.replaced ? event.born : event.population;
    return (
      <div className="local-sheet" data-local="ga">
        <p className="local-caption">
          Generation {event.generation}. Mean fitness {formatProb(event.meanFitness)}. Population {event.popSize}.
        </p>
        <Population people={people} birth={event.birth} />
        {event.birth ? (
          <p className="birth" data-crossover={event.birth.crossover} data-mutated={event.birth.mutatedIndex ?? ""}>
            Parents fitness {event.birth.fitnessA} and {event.birth.fitnessB}. Crossover at gene {event.birth.crossover}.{" "}
            {event.birth.mutatedIndex === null
              ? "No mutation."
              : `Mutated gene ${event.birth.mutatedIndex} (${event.birth.mutatedFrom}→${event.birth.mutatedTo}).`}{" "}
            Child fitness {event.birth.childFitness}.
          </p>
        ) : null}
        <ValueChart points={frame.means} label="Mean fitness by generation" />
      </div>
    );
  }

  const queens = afterQueens(frame);
  const x = afterX(frame);
  return (
    <div className="local-sheet" data-local={event.type}>
      <div className="local-row">
        {landscape && x !== null ? (
          <LandscapePlot
            x={x}
            proposal={event.type === "anneal" && !event.accepted ? event.neighborX : null}
            stuck={event.type === "climb" && event.stuck}
            trail={frame.trail.map((point) => point.x)}
          />
        ) : null}
        {queens ? (
          <QueensBoard
            queens={queens}
            value={frame.objective}
            label={event.type === "climb" && event.stuck ? "Local maximum" : "Current"}
          />
        ) : null}
        {event.type === "anneal" ? (
          <Thermo
            temperature={event.temperature}
            max={event.temperatureMax}
            acceptProbability={event.acceptProbability}
          />
        ) : null}
      </div>
      <ValueChart points={frame.trail.map((point) => point.value)} label="Value over time" />
    </div>
  );
}

function BeamCard({ member, index }: { member: BeamMember; index: number }) {
  if (!member.queens) {
    return (
      <p className="beam-card" data-beam-slot={index} data-beam-value={member.value}>
        {member.key} · {member.value}
      </p>
    );
  }
  return (
    <div data-beam-slot={index} data-beam-value={member.value}>
      <QueensBoard queens={member.queens} value={member.value} label={`Beam ${index + 1}`} />
    </div>
  );
}

export function QueensBoard({
  queens,
  value,
  label,
}: {
  queens: number[];
  value: number | null;
  label: string;
}) {
  const attacks = queenAttacks(queens);
  const n = queens.length;
  return (
    <figure className="queens-board" data-queens={queens.join(",")} data-objective={value ?? ""}>
      <figcaption>
        {label}
        {value !== null ? ` · ${value} non-attacking pairs` : ""}
      </figcaption>
      <div className="queens-grid" style={{ gridTemplateColumns: `repeat(${n}, 32px)` }}>
        {Array.from({ length: n * n }, (_, cell) => {
          const row = Math.floor(cell / n);
          const column = cell % n;
          const queen = queens[row] === column;
          return (
            <span
              key={cell}
              className="square"
              data-dark={(row + column) % 2 === 1 ? "true" : "false"}
              data-queen={queen ? "true" : "false"}
              data-attack={queen && attacks[row] ? "true" : "false"}
            >
              {queen ? "Q" : ""}
            </span>
          );
        })}
      </div>
    </figure>
  );
}

function Population({
  people,
  birth,
}: {
  people: GaIndividual[];
  birth: { parentA: number[]; parentB: number[]; child: number[]; mutatedIndex: number | null } | null;
}) {
  const max = 28;
  return (
    <ol className="population" data-population-size={people.length}>
      {people.map((person, index) => {
        const genome = person.genes.join(",");
        const selected =
          birth !== null &&
          (genome === birth.parentA.join(",") || genome === birth.parentB.join(","));
        return (
          <li
            key={`${genome}-${index}`}
            data-fitness={person.fitness}
            data-genome={genome}
            data-selected={selected ? "true" : "false"}
          >
            <span className="genome">{person.genes.join(" ")}</span>
            <span className="fitness-track">
              <span className="fitness-bar" style={{ width: `${(person.fitness / max) * 100}%` }} />
            </span>
            <span className="fitness-num">{person.fitness}</span>
          </li>
        );
      })}
    </ol>
  );
}

function LandscapePlot({
  x,
  proposal,
  stuck,
  trail,
}: {
  x: number;
  proposal: number | null;
  stuck: boolean;
  trail: Array<number | null>;
}) {
  const width = 560;
  const height = 220;
  const pad = 28;
  const max = Math.max(...LANDSCAPE_VALUES);
  const last = LANDSCAPE_VALUES.length - 1;
  const px = (index: number) => pad + (index / last) * (width - pad * 2);
  const py = (value: number) => height - pad - (value / max) * (height - pad * 2);
  const line = LANDSCAPE_VALUES.map((value, index) => `${px(index)},${py(value)}`).join(" ");
  const walked = trail.filter((index): index is number => index !== null);
  return (
    <figure className="landscape">
      <figcaption>
        Objective landscape. Local peak at x = 4 (value 5). Global peak at x = 14 (value 10).
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Objective landscape">
        <polyline points={line} className="landscape-line" />
        {walked.map((index, step) => (
          <circle key={step} cx={px(index)} cy={py(LANDSCAPE_VALUES[index])} r={3} className="landscape-trail" />
        ))}
        {proposal !== null ? (
          <circle
            cx={px(proposal)}
            cy={py(LANDSCAPE_VALUES[proposal])}
            r={6}
            className="landscape-proposal"
            data-proposal-x={proposal}
          />
        ) : null}
        <circle
          cx={px(x)}
          cy={py(LANDSCAPE_VALUES[x])}
          r={7}
          className={stuck ? "landscape-marker stuck" : "landscape-marker"}
          data-landscape-x={x}
          data-stuck={stuck ? "true" : "false"}
        />
      </svg>
    </figure>
  );
}

function ValueChart({ points, label }: { points: number[]; label: string }) {
  if (points.length === 0) return null;
  const width = 560;
  const height = 88;
  const pad = 16;
  const max = Math.max(...points, 1);
  const px = (index: number) =>
    pad + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - pad * 2));
  const py = (value: number) => height - pad - (value / max) * (height - pad * 2);
  const line = points.map((value, index) => `${px(index)},${py(value)}`).join(" ");
  return (
    <figure className="value-chart">
      <figcaption>
        {label}. Now {points[points.length - 1]}.
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} aria-label={label}>
        <polyline points={line} className="landscape-line" />
      </svg>
    </figure>
  );
}

function Thermo({
  temperature,
  max,
  acceptProbability,
}: {
  temperature: number;
  max: number;
  acceptProbability: number | null;
}) {
  const fraction = max <= 0 ? 0 : Math.max(0, Math.min(1, temperature / max));
  return (
    <div
      className="thermo"
      data-temperature={temperature}
      data-accept-p={acceptProbability === null ? "" : String(acceptProbability)}
    >
      <div className="thermo-tube">
        <span className="thermo-fill" style={{ height: `${fraction * 100}%` }} />
      </div>
      <p>T {formatTemp(temperature)}</p>
      <p>{acceptProbability === null ? "P —" : `P ${formatProb(acceptProbability)}`}</p>
    </div>
  );
}
