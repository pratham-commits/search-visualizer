import type { Frame } from "@/lib/search";

export function LimitNote({ frame }: { frame: Frame }) {
  if (frame.limit === null) return null;
  const label =
    frame.iteration === null
      ? `Limit L = ${frame.limit}`
      : `Iteration: limit = ${frame.limit}`;
  return (
    <p className="limit-note" data-limit={frame.limit}>
      {label}
      {frame.iteration !== null && frame.reexpanded !== null ? (
        <span data-reexpanded={frame.reexpanded}>
          {` · nodes re-expanded this iteration: ${frame.reexpanded}`}
        </span>
      ) : null}
    </p>
  );
}
