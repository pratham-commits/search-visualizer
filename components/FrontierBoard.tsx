import { romaniaDisplay, type Frame, type RomaniaLabelMode } from "@/lib/search";
import type { NodeLabels } from "./labels";

function stateLabel(key: string, mode: RomaniaLabelMode): string {
  return romaniaDisplay(key, mode);
}

export function FrontierBoard({
  frame,
  labels,
  labelMode = "cities",
}: {
  frame: Frame;
  labels?: NodeLabels;
  labelMode?: RomaniaLabelMode;
}) {
  const lifo = frame.structure === "lifo";
  const priority = frame.structure === "priority";
  const title = lifo
    ? "Frontier — LIFO stack"
    : priority
      ? "Frontier — priority queue"
      : "Frontier — FIFO queue";
  const note = lifo
    ? "Top is the next pop. Pushes land on the top."
    : priority
      ? "Sorted by the priority key. The minimum, at the top, is the next pop."
      : "Front is the next pop, on the left. New nodes join the back.";
  return (
    <section
      className={lifo || priority ? "board stack" : "board queue"}
      aria-label={title}
      data-frontier-order={priority ? "priority" : lifo ? "lifo" : "fifo"}
    >
      <h2>{title}</h2>
      <p className="ledger-note">{note}</p>
      {frame.frontier.length === 0 ? (
        <p className="empty">empty</p>
      ) : (
        <div className="board-row">
          <span className="end-mark">{lifo ? "top" : priority ? "min" : "front"}</span>
          <ol>
            {frame.frontier.map((item, index) => (
              <li
                key={item.id}
                data-frontier-id={item.id}
                data-state={item.stateKey}
                data-g={labels?.showG === false ? "" : item.g}
                data-h={labels?.showH ? (item.h ?? "") : ""}
                data-f={labels?.showF ? item.f : ""}
                data-priority={item.f}
                data-next={index === 0 ? "true" : "false"}
                data-replaced={
                  frame.replacedKey === item.stateKey ? "true" : "false"
                }
              >
                <span className="state">{stateLabel(item.stateKey, labelMode)}</span>
                {priority ? (
                  <span className="nums">
                    {labels?.orderBy === "h"
                      ? `key h ${item.h ?? item.f}${labels.showG ? ` · g ${item.g}` : ""}`
                      : labels?.orderBy === "g"
                        ? `key g ${item.g}`
                        : `key f ${item.f}${item.h !== null ? ` · g ${item.g} h ${item.h}` : ""}`}
                  </span>
                ) : (
                  <span className="nums">g {item.g}</span>
                )}
              </li>
            ))}
          </ol>
          {priority ? null : (
            <span className="end-mark">{lifo ? "bottom" : "back"}</span>
          )}
        </div>
      )}
    </section>
  );
}
