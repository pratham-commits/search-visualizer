import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  breadthFirstGraphSearch,
  examNotation,
  frameAt,
  plainEnglish,
} from "@/lib/search";
import { gridProblem } from "@/lib/search/problems/grid";
import {
  WALL_GRID_OPTIMAL_PATH,
  wallGrid,
} from "@/lib/search/problems/fixtures";
import { Explanation } from "./Explanation";
import { GridSheet } from "./GridSheet";

function marked(container: HTMLElement, attr: string): string[] {
  return [...container.querySelectorAll(`[${attr}="true"]`)]
    .map((element) => element.getAttribute("data-cell"))
    .filter((value): value is string => value !== null)
    .sort();
}

function treeKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-tree-edge]")]
    .map((element) => element.getAttribute("data-tree-edge"))
    .filter((value): value is string => value !== null)
    .sort();
}

describe("GridSheet", () => {
  const result = breadthFirstGraphSearch(gridProblem(wallGrid));

  it("draws the solution only at the end, and keeps explored fills", () => {
    const mid = result.trace.findIndex((event) => event.type === "expand");
    const midFrame = frameAt(result.trace, mid);
    const midView = render(
      <GridSheet spec={wallGrid} frame={midFrame} onHover={() => {}} />,
    );
    expect(marked(midView.container, "data-explored")).toEqual(
      [...midFrame.explored].sort(),
    );
    expect(marked(midView.container, "data-path")).toEqual([]);
    expect(marked(midView.container, "data-current")).toEqual([
      midFrame.focusKey,
    ]);

    const end = frameAt(result.trace, result.trace.length - 1);
    const endView = render(
      <GridSheet spec={wallGrid} frame={end} onHover={() => {}} />,
    );
    expect(marked(endView.container, "data-path")).toEqual(
      [...WALL_GRID_OPTIMAL_PATH].sort(),
    );
  });

  it("keeps every discovered tree edge, and the panels quote the engine", () => {
    let previous: string[] = [];
    for (let i = 0; i < result.trace.length; i += 1) {
      const event = result.trace[i];
      const frame = frameAt(result.trace, i);
      const view = render(
        <>
          <GridSheet spec={wallGrid} frame={frame} onHover={() => {}} />
          <Explanation event={event} />
        </>,
      );
      const drawn = treeKeys(view.container);
      expect(drawn).toEqual(frame.treeEdges.map((edge) => edge.key).sort());
      for (const key of previous) expect(drawn).toContain(key);
      previous = drawn;

      const english = view.getByRole("region", { name: "Plain English" });
      const exam = view.getByRole("region", { name: "Exam notation" });
      expect(english.textContent).toContain(plainEnglish(event));
      expect(exam.textContent).toContain(examNotation(event));
      expect(
        view.container.querySelector("[data-live-frontier]")?.textContent,
      ).toContain(
        event.vars.frontier.length === 0
          ? "empty"
          : event.vars.frontier.join(" | "),
      );
      view.unmount();
    }
    expect(previous.length).toBeGreaterThan(0);
  });
});
