import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  depthLimitedSearch,
  examNotation,
  frameAt,
  iterativeDeepeningSearch,
  plainEnglish,
} from "@/lib/search";
import { gridProblem } from "@/lib/search/problems/grid";
import { wallGrid } from "@/lib/search/problems/fixtures";
import { Explanation } from "./Explanation";
import { GridSheet } from "./GridSheet";
import { LimitNote } from "./LimitNote";

const grid = gridProblem(wallGrid);

function depths(container: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    [...container.querySelectorAll("[data-depth]")]
      .map((element) => [
        element.getAttribute("data-cell"),
        element.getAttribute("data-depth"),
      ])
      .filter((pair): pair is [string, string] => pair[0] !== null && pair[1] !== ""),
  );
}

describe("depth-limited rendering", () => {
  const result = depthLimitedSearch(grid, 1);
  const end = frameAt(result.trace, result.trace.length - 1);

  it("marks cutoff nodes apart from reached nodes and shows L", () => {
    const view = render(
      <>
        <LimitNote frame={end} />
        <GridSheet spec={wallGrid} frame={end} onHover={() => {}} />
        <Explanation event={result.trace.at(-1)!} />
      </>,
    );
    const cutoff = [...view.container.querySelectorAll('[data-cutoff="true"]')]
      .map((element) => element.getAttribute("data-cell"))
      .sort();
    expect(cutoff).toEqual([...end.cutoff].sort());
    expect(cutoff).toEqual(["0,2", "2,0"]);
    for (const key of cutoff) {
      const cell = view.container.querySelector(`[data-cell="${key}"]`);
      expect(cell?.getAttribute("data-reached")).toBe("false");
    }
    expect(view.container.querySelector("[data-limit]")?.textContent).toContain(
      "Limit L = 1",
    );
    expect(depths(view.container)).toEqual(
      Object.fromEntries(
        Object.entries(end.depths).map(([key, depth]) => [key, String(depth)]),
      ),
    );
    expect(view.getByRole("region", { name: "Exam notation" }).textContent).toContain(
      examNotation(result.trace.at(-1)!),
    );
    view.unmount();
    const capped = result.trace.find((event) => event.type === "depth-cutoff");
    const atCap = render(
      <>
        <LimitNote frame={frameAt(result.trace, result.trace.indexOf(capped!))} />
        <Explanation event={capped!} />
      </>,
    );
    expect(atCap.getByRole("region", { name: "Plain English" }).textContent).toContain(
      plainEnglish(capped!),
    );
    expect(atCap.container.querySelector("[data-live-limit]")?.textContent).toBe("1");
  });
});

describe("iterative deepening rendering", () => {
  const result = iterativeDeepeningSearch(grid);
  const restarts = result.trace
    .map((event, index) => (event.type === "restart" ? index : -1))
    .filter((index) => index >= 0);

  it("clears tree edges in the DOM when an iteration restarts", () => {
    const grown = frameAt(result.trace, restarts[2] - 1);
    const cleared = frameAt(result.trace, restarts[2]);
    const grownView = render(
      <>
        <LimitNote frame={grown} />
        <GridSheet spec={wallGrid} frame={grown} onHover={() => {}} />
      </>,
    );
    expect(grownView.container.querySelectorAll("[data-tree-edge]").length).toBe(
      grown.treeEdges.length,
    );
    expect(grown.treeEdges.length).toBeGreaterThan(0);
    grownView.unmount();

    const clearedView = render(
      <>
        <LimitNote frame={cleared} />
        <GridSheet spec={wallGrid} frame={cleared} onHover={() => {}} />
      </>,
    );
    expect(clearedView.container.querySelectorAll("[data-tree-edge]")).toHaveLength(0);
    expect(clearedView.container.querySelector("[data-limit]")?.textContent).toContain(
      "Iteration: limit = 2",
    );
    expect(clearedView.container.querySelector("[data-reexpanded]")?.textContent).toContain(
      "0",
    );
  });
});
