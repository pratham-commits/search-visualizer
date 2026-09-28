import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { aStarSearch } from "@/lib/search/algorithms";
import { examNotation } from "@/lib/search/explain";
import {
  ROMANIA_SLD,
  romaniaEdges,
  romaniaProblem,
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

describe("edge and node labels", () => {
  it("shows depth for uninformed search and hides h, f, and edge weights", () => {
    render(<SearchBench />);
    expect(screen.queryByRole("checkbox", { name: "show unit costs" })).toBeNull();
    expect(document.querySelector("[data-edge-cost]")).toBeNull();
    expect(document.querySelector('[data-h]:not([data-h=""])')).toBeNull();
    expect(document.querySelector('[data-f]:not([data-f=""])')).toBeNull();
    expect(document.querySelector("[data-heuristic-table]")).toBeNull();
    const start = document.querySelector('[data-cell="0,0"]');
    expect(start?.getAttribute("data-depth")).toBe("0");
    expect(start?.textContent).toContain("d0");

    fireEvent.click(screen.getByRole("button", { name: "Romania" }));
    expect(document.querySelector("[data-edge-cost]")).toBeNull();
    expect(document.querySelector("[data-heuristic-table]")).toBeNull();
    expect(document.querySelector('[data-h]:not([data-h=""])')).toBeNull();
    expect(document.querySelector('[data-f]:not([data-f=""])')).toBeNull();
    const arad = document.querySelector('[data-cell="Arad"]');
    expect(arad?.getAttribute("data-depth")).toBe("0");
    expect(arad?.textContent).toContain("d0");
    expect(arad?.textContent).not.toContain("h");

    fireEvent.click(screen.getByRole("button", { name: "Depth-first" }));
    fireEvent.click(screen.getByRole("button", { name: "Tree-like" }));
    const slider = screen.getByRole("slider", { name: "Trace" });
    fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
    const bucharest = [...document.querySelectorAll("li[data-state='Bucharest']")];
    expect(bucharest.map((card) => card.getAttribute("data-depth")).sort(
      (a, b) => Number(a) - Number(b),
    )).toEqual(["7", "10"]);
    for (const card of bucharest) {
      expect(card.textContent).toContain(`depth ${card.getAttribute("data-depth")}`);
      expect(card.textContent).not.toContain("1119");
      expect(card.textContent).not.toContain("733");
      expect(card.getAttribute("data-g")).toBe("");
    }
  });

  it("draws Romania action costs, static h, and A* f = g + h in sync with the exam line", () => {
    const problem = romaniaProblem();
    const astar = aStarSearch(problem, (city) => ROMANIA_SLD[city]);
    const sibiu = astar.trace.findIndex(
      (event) => event.type === "frontier-add" && event.stateKey === "Sibiu",
    );

    render(<SearchBench />);
    fireEvent.click(screen.getByRole("button", { name: "Romania" }));
    fireEvent.click(screen.getByRole("button", { name: "A*" }));
    fireEvent.click(screen.getByRole("button", { name: "Cities" }));
    expect(screen.queryByRole("checkbox", { name: "show unit costs" })).toBeNull();

    const chips = [...document.querySelectorAll("[data-edge-cost]")];
    expect(chips).toHaveLength(romaniaEdges().length);
    for (const chip of chips) {
      const from = chip.getAttribute("data-from") as City;
      const to = chip.getAttribute("data-to") as City;
      const cost = problem.actionCost(from, to, to);
      expect(chip.getAttribute("data-edge-cost")).toBe(String(cost));
      expect(chip.textContent).toContain(String(cost));
    }

    for (const city of Object.keys(ROMANIA_SLD) as City[]) {
      const node = document.querySelector(`[data-cell="${city}"]`);
      expect(node?.getAttribute("data-h")).toBe(String(ROMANIA_SLD[city]));
      expect(node?.textContent).toContain(String(ROMANIA_SLD[city]));
    }

    jump(sibiu);
    const node = document.querySelector('[data-cell="Sibiu"]');
    const g = Number(node?.getAttribute("data-g"));
    const h = Number(node?.getAttribute("data-h"));
    const f = Number(node?.getAttribute("data-f"));
    expect(h).toBe(ROMANIA_SLD.Sibiu);
    expect(f).toBe(g + h);
    expect(node?.textContent).toContain(`g${g}`);
    expect(node?.textContent).toContain(`f${f}`);
    expect(screen.getByRole("region", { name: "Exam notation" }).textContent).toContain(
      examNotation(astar.trace[sibiu]),
    );
    expect(examNotation(astar.trace[sibiu])).toContain(
      `f(Sibiu) = g + h = ${g} + ${h} = ${f}`,
    );

    for (const reached of document.querySelectorAll('[data-f]:not([data-f=""])')) {
      expect(Number(reached.getAttribute("data-f"))).toBe(
        Number(reached.getAttribute("data-g")) + Number(reached.getAttribute("data-h")),
      );
    }
    const untouched = document.querySelector('[data-cell="Bucharest"]');
    expect(untouched?.getAttribute("data-h")).toBe("0");
    expect(untouched?.getAttribute("data-g")).toBe("");
    expect(untouched?.getAttribute("data-f")).toBe("");
  });

  it("shows g without h or f for uniform-cost, and h plus g without f for greedy", () => {
    render(<SearchBench />);
    fireEvent.click(screen.getByRole("button", { name: "Romania" }));
    fireEvent.click(screen.getByRole("button", { name: "Uniform-cost" }));
    const slider = screen.getByRole("slider", { name: "Trace" });
    fireEvent.change(slider, { target: { value: "8" } });
    const frontierCard = document.querySelector(
      "[data-frontier-order='priority'] li[data-g]:not([data-g=''])",
    );
    expect(frontierCard).toBeTruthy();
    expect(frontierCard?.textContent).toContain(`g ${frontierCard?.getAttribute("data-g")}`);
    expect(frontierCard?.textContent).not.toContain("depth");
    fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
    expect(document.querySelector('[data-cell][data-h]:not([data-h=""])')).toBeNull();
    expect(document.querySelector('[data-cell][data-f]:not([data-f=""])')).toBeNull();
    expect(document.querySelector('[data-cell][data-g]:not([data-g=""])')).not.toBeNull();
    expect(document.querySelectorAll("[data-edge-cost]").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Greedy best-first" }));
    fireEvent.change(screen.getByRole("slider", { name: "Trace" }), {
      target: { value: "8" },
    });
    expect(document.querySelector('[data-cell][data-h]:not([data-h=""])')).not.toBeNull();
    expect(document.querySelector('[data-f]:not([data-f=""])')).toBeNull();
    expect(document.querySelector('[data-cell="Sibiu"]')?.getAttribute("data-h")).toBe(
      String(ROMANIA_SLD.Sibiu),
    );
    expect(document.querySelector("[data-order-note]")?.textContent).toContain(
      "order uses h",
    );
  });

  it("runs A* on Romania and does not offer the wall grid", () => {
    render(<SearchBench />);
    fireEvent.click(screen.getByRole("button", { name: "A*" }));
    expect(screen.queryByRole("button", { name: "Wall grid" })).toBeNull();
    expect(screen.getByRole("button", { name: "Romania" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(document.querySelector('[data-cell="0,0"]')).toBeNull();
    expect(document.querySelector('[data-cell="Arad"]')?.getAttribute("data-h")).toBe(
      String(ROMANIA_SLD.Arad),
    );
  });
});