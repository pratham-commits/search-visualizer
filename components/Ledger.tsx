import type { Frame } from "@/lib/search";

export function Ledger({ frame }: { frame: Frame }) {
  return (
    <aside className="ledger" aria-label="Frontier and reached">
      <section>
        <h2>Frontier</h2>
        <p className="ledger-note">Next pop is the first line.</p>
        {frame.frontier.length === 0 ? (
          <p className="empty">empty</p>
        ) : (
          <ol>
            {frame.frontier.map((item, index) => (
              <li key={item.id} data-frontier-id={item.id}>
                <span className="idx">{index === 0 ? "next" : index + 1}</span>
                <span className="state">{item.stateKey}</span>
                <span className="nums">
                  g {item.g}
                  <span className="dot"> · </span>f {item.f}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h2>Reached</h2>
        <p className="ledger-note">Recorded when a state is reached.</p>
        {frame.reached.length === 0 ? (
          <p className="empty">none yet</p>
        ) : (
          <ol>
            {frame.reached.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
