import {
  examNotation,
  formatProb,
  formatTemp,
  isLocalEvent,
  plainEnglish,
  romaniaDisplay,
  type RomaniaLabelMode,
  type StepEvent,
} from "@/lib/search";

export function Explanation({
  event,
  labelMode = "cities",
}: {
  event: StepEvent;
  labelMode?: RomaniaLabelMode;
}) {
  if (isLocalEvent(event)) return <LocalExplanation event={event} />;
  const explored =
    event.vars.explored === null
      ? "none — tree search keeps no explored set"
      : event.vars.explored.length === 0
        ? "empty"
        : event.vars.explored.map((key) => romaniaDisplay(key, labelMode)).join(", ");
  return (
    <div className="explain-wrap">
      <div className="explain">
        <section aria-label="Plain English" data-plain="">
          <h2>Plain English</h2>
          <p>{plainEnglish(event, labelMode)}</p>
        </section>
        <section aria-label="Exam notation" data-exam="">
          <h2>Exam notation</h2>
          <pre className="exam">{examNotation(event, labelMode)}</pre>
        </section>
      </div>
      <section className="live-vars" aria-label="Live variables">
        <h2>Live variables</h2>
        <dl>
          <div>
            <dt>Frontier</dt>
            <dd data-live-frontier="">
              {event.vars.frontier.length === 0
                ? "empty"
                : event.vars.frontier.map((key) => romaniaDisplay(key, labelMode)).join(" | ")}
            </dd>
          </div>
          <div>
            <dt>Explored</dt>
            <dd data-live-explored="">{explored}</dd>
          </div>
          <div>
            <dt>Depth</dt>
            <dd data-live-depth="">
              {event.vars.depth === null ? "—" : event.vars.depth}
            </dd>
          </div>
          {event.vars.limit !== null ? (
            <div>
              <dt>Limit</dt>
              <dd data-live-limit="">{event.vars.limit}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}

function LocalExplanation({
  event,
}: {
  event: Extract<StepEvent, { type: "climb" | "anneal" | "beam" | "ga" }>;
}) {
  return (
    <div className="explain-wrap">
      <div className="explain">
        <section aria-label="Plain English" data-plain="">
          <h2>Plain English</h2>
          <p>{plainEnglish(event)}</p>
        </section>
        <section aria-label="Exam notation" data-exam="">
          <h2>Exam notation</h2>
          <pre className="exam">{examNotation(event)}</pre>
        </section>
      </div>
      <section className="live-vars" aria-label="Live variables">
        <h2>Live variables</h2>
        <dl>
          {event.type === "climb" ? (
            <div>
              <dt>Value</dt>
              <dd data-live-value="">{event.moved ? event.bestValue : event.currentValue}</dd>
            </div>
          ) : null}
          {event.type === "anneal" ? (
            <>
              <div>
                <dt>T</dt>
                <dd data-live-t="">{formatTemp(event.temperature)}</dd>
              </div>
              <div>
                <dt>P(accept)</dt>
                <dd data-live-p="">
                  {event.acceptProbability === null ? "—" : formatProb(event.acceptProbability)}
                </dd>
              </div>
            </>
          ) : null}
          {event.type === "beam" ? (
            <div>
              <dt>k</dt>
              <dd data-live-k="">{event.k}</dd>
            </div>
          ) : null}
          {event.type === "ga" ? (
            <div>
              <dt>Mean fitness</dt>
              <dd data-live-mean="">{formatProb(event.meanFitness)}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}
