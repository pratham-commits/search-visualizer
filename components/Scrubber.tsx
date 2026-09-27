export function Scrubber({
  index,
  length,
  playing,
  speed,
  label,
  onIndex,
  onPlaying,
  onSpeed,
}: {
  index: number;
  length: number;
  playing: boolean;
  speed: number;
  label: string;
  onIndex: (index: number) => void;
  onPlaying: (playing: boolean) => void;
  onSpeed: (speed: number) => void;
}) {
  const max = Math.max(0, length - 1);
  return (
    <div className="scrubber">
      <div className="transport">
        <button
          type="button"
          className="stamp"
          onClick={() => onIndex(Math.max(0, index - 1))}
          disabled={index <= 0}
        >
          Back
        </button>
        <button
          type="button"
          className="stamp"
          onClick={() => onPlaying(!playing)}
          aria-pressed={playing}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className="stamp"
          onClick={() => onIndex(Math.min(max, index + 1))}
          disabled={index >= max}
        >
          Step
        </button>
        <label className="speed">
          Speed
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={speed}
            aria-label="Speed"
            onChange={(event) => onSpeed(Number(event.target.value))}
          />
        </label>
      </div>
      <label className="timeline">
        <span className="timeline-meta">
          <span>{label}</span>
          <span>
            {index + 1} / {length}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={Math.min(index, max)}
          aria-label="Trace"
          onChange={(event) => onIndex(Number(event.target.value))}
        />
      </label>
    </div>
  );
}
