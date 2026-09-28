import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { aStarSearch } from "@/lib/search/algorithms";
import { examNotation, plainEnglish } from "@/lib/search/explain";
import { frameAt } from "@/lib/search/replay";
import {
  CITIES,
  romaniaProblem,
  ROMANIA_LETTERS,
  ROMANIA_SLD,
  type City,
} from "@/lib/search/problems/romania";
import { SearchBench } from "./SearchBench";

afterEach(() => {
  cleanup();
});

function jump(index: number) {
  const slider = screen.getByRole("slider", { name: "Trace" });
  fireEvent.change(slider, { target: { value: String(index) } });
}

function cellSnapshot() {
  return [...document.querySelectorAll("[data-cell]")].map((node) => ({
    id: node.getAttribute("data-cell"),
    display: node.getAttribute("data-display"),
    g: node.getAttribute("data-g"),
    h: node.getAttribute("data-h"),
    f: node.getAttribute("data-f"),
    path: node.getAttribute("data-path"),
    start: node.getAttribute("data-start"),
    goal: node.getAttribute("data-goal"),
  }));
}

function edgeSnapshot() {
  return [...document.querySelectorAll("[data-edge-cost]")].map((node) => ({
    from: node.getAttribute("data-from"),
    to: node.getAttribute("data-to"),
    cost: node.getAttribute("data-edge-cost"),
  }));
}

describe("Romania display labels", () => {
  it("defaults to letters, shows the h(n) table, and toggling cities changes only the names", () => {
    const problem = romaniaProblem();
    const heuristic = (city: City) => ROMANIA_SLD[city];
    const astar = aStarSearch(problem, heuristic);
    const sibiu = astar.trace.findIndex(
      (event) => event.type === "frontier-add" && event.stateKey === "Sibiu",
    );
    const end = astar.trace.length - 1;

    render(<SearchBench />);
    fireEvent.click(screen.getByRole("button", { name: "Romania" }));
    fireEvent.click(screen.getByRole("button", { name: "A*" }));
    expect(screen.getByRole("button", { name: "Letters" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    const table = document.querySelector("[data-heuristic-table]");
    expect(table?.textContent).toContain("straight-line distance to G");
    const rows = [...document.querySelectorAll("[data-h-node]")];
    expect(rows.map((row) => row.getAttribute("data-h-node"))).toEqual([...CITIES]);
    for (const row of rows) {
      const city = row.getAttribute("data-h-node") as City;
      expect(row.getAttribute("data-h-value")).toBe(String(heuristic(city)));
      expect(row.getAttribute("data-h-value")).toBe(String(ROMANIA_SLD[city]));
      expect(row.textContent).toContain(ROMANIA_LETTERS[city]);
      expect(row.textContent).toContain(String(ROMANIA_SLD[city]));
    }

    const start = document.querySelector('[data-cell="Arad"]');
    const goal = document.querySelector('[data-cell="Bucharest"]');
    expect(start?.getAttribute("data-start")).toBe("true");
    expect(start?.getAttribute("data-display")).toBe("S");
    expect(goal?.getAttribute("data-goal")).toBe("true");
    expect(goal?.getAttribute("data-display")).toBe("G");
    expect(problem.initial).toBe("Arad");
    expect(problem.isGoal("Bucharest")).toBe(true);

    jump(sibiu);
    const sibiuEvent = astar.trace[sibiu];
    expect(screen.getByRole("region", { name: "Plain English" }).textContent).toContain(
      plainEnglish(sibiuEvent, "letters"),
    );
    expect(screen.getByRole("region", { name: "Exam notation" }).textContent).toContain(
      examNotation(sibiuEvent, "letters"),
    );
    expect(examNotation(sibiuEvent, "letters")).toContain(
      `f(${ROMANIA_LETTERS.Sibiu}) = g + h = 140 + 253 = 393`,
    );

    jump(end);
    expect(document.querySelector(".cost-line")?.textContent).toContain("cost 418");
    const solution = frameAt(astar.trace, end);
    expect(solution.path).toEqual(["Arad", "Sibiu", "Rimnicu", "Pitesti", "Bucharest"]);
    expect(solution.cost).toBe(418);
    const path = [...document.querySelectorAll('[data-path="true"]')].map((node) =>
      node.getAttribute("data-cell"),
    );
    expect(path.sort()).toEqual([...solution.path].sort());

    const lettersCells = cellSnapshot();
    const lettersEdges = edgeSnapshot();
    const lettersTable = [...document.querySelectorAll("[data-h-node]")].map((row) =>
      row.getAttribute("data-h-value"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cities" }));
    expect(start?.getAttribute("data-display")).toBe("Arad");
    expect(start?.getAttribute("data-start")).toBe("true");
    expect(goal?.getAttribute("data-display")).toBe("Bucharest");
    expect(goal?.getAttribute("data-goal")).toBe("true");
    expect(document.querySelector(".cost-line")?.textContent).toContain("cost 418");
    expect(
      [...document.querySelectorAll('[data-path="true"]')]
        .map((node) => node.getAttribute("data-cell"))
        .sort(),
    ).toEqual([...path].sort());

    const cityCells = cellSnapshot();
    const identity = (
      cells: ReturnType<typeof cellSnapshot>,
    ) => cells.map(({ id, g, h, f, path: onPath, start: isStart, goal: isGoal }) => ({
      id,
      g,
      h,
      f,
      onPath,
      isStart,
      isGoal,
    }));
    expect(identity(cityCells)).toEqual(identity(lettersCells));
    expect(cityCells.map((cell) => cell.display)).not.toEqual(
      lettersCells.map((cell) => cell.display),
    );
    expect(edgeSnapshot()).toEqual(lettersEdges);
    expect(
      [...document.querySelectorAll("[data-h-node]")].map((row) => row.getAttribute("data-h-value")),
    ).toEqual(lettersTable);
    expect(screen.getByRole("region", { name: "Exam notation" }).textContent).toContain(
      examNotation(astar.trace[end], "cities"),
    );
    expect(screen.getByRole("region", { name: "Plain English" }).textContent).toContain(
      plainEnglish(astar.trace[end], "cities"),
    );
  });
});
