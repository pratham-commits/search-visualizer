export function ColorLegend() {
  return (
    <ul className="legend" aria-label="Color legend">
      <li>
        <span className="swatch swatch-empty" /> empty
      </li>
      <li>
        <span className="swatch swatch-wall" data-swatch="wall" /> wall
      </li>
      <li>
        <span className="swatch swatch-frontier" /> frontier
      </li>
      <li>
        <span className="swatch swatch-explored" /> explored
      </li>
      <li>
        <span className="swatch swatch-path" /> path
      </li>
      <li>
        <span className="swatch swatch-current" /> current
      </li>
    </ul>
  );
}
