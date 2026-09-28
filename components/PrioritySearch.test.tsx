import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { aStarSearch } from "@/lib/search/algorithms";
import { examNotation, plainEnglish } from "@/lib/search/explain";
import { ROMANIA_SLD, romaniaProblem, type City } from "@/lib/search/problems/romania";
import { frameAt } from "@/lib/search/replay";
import { SearchBench } from "./SearchBench";

afterEach(() => {
  cleanup();
});

const romania = romaniaProblem();
const h = (city: City) => ROMANIA_SLD[city];

function jump(index: number) {
  const slider = screen.getByRole("slider", { name: "Trace" });
  fireEvent.change(slider, { target: { value: String(index) } });
}

describe("priority queue on the sheet", () => {
  it("renders a sorted queue, g/h/f labels, the f = g + h line, and a relaxation", () => {
    const astar = aStarSearch(romania, h);
    const sibiu = astar.trace.findIndex(
      (event) => event.type === "frontier-add" && event.stateKey === "Sibiu",
    );
    const relaxed = astar.trace.findIndex((event) => event.type === "frontier-replace");
    expect(sibiu).toBeGreaterThan(0);
    expect(relaxed).toBeGreaterThan(sibiu);

    render(<SearchBench />);
    fireEvent.click(screen.getByRole("button", { name: "Romania" }));
    fireEvent.click(screen.getByRole("button", { name: "A*" }));
    fireEvent.click(screen.getByRole("button", { name: "Cities" }));
    expect(document.querySelector("[data-variant-label]")?.textContent).toBe(
      "Graph",
    );
    expect(screen.queryByRole("button", { name: "Tree-like" })).toBeNull();

    jump(sibiu);
    const sibiuEvent = astar.trace[sibiu];
    expect(screen.getByRole("region", { name: "Exam notation" }).textContent).toContain(
      examNotation(sibiuEvent),
    );
    expect(screen.getByRole("region", { name: "Plain English" }).textContent).toContain(
      plainEnglish(sibiuEvent),
    );
    expect(examNotation(sibiuEvent)).toContain("f(Sibiu) = g + h = 140 + 253 = 393");

    const sibiuCity = document.querySelector('[data-cell="Sibiu"]');
    expect(sibiuCity?.getAttribute("data-g")).toBe("140");
    expect(sibiuCity?.getAttribute("data-h")).toBe("253");
    expect(sibiuCity?.getAttribute("data-f")).toBe("393");

    const keys = [...document.querySelectorAll("[data-frontier-order='priority'] li")].map(
      (item) => Number(item.getAttribute("data-priority")),
    );
    expect(keys.length).toBeGreaterThan(1);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    expect(
      document.querySelector("[data-frontier-order='priority'] li[data-next='true']")
        ?.getAttribute("data-state"),
    ).toBe(frameAt(astar.trace, sibiu).frontier[0]?.stateKey);

    jump(relaxed);
    const relaxEvent = astar.trace[relaxed];
    expect(screen.getByRole("region", { name: "Plain English" }).textContent).toContain(
      "Relaxed Bucharest: found cheaper path, updated g from 450 to 418.",
    );
    expect(screen.getByRole("region", { name: "Exam notation" }).textContent).toContain(
      examNotation(relaxEvent),
    );
    const bucharest = document.querySelector('[data-cell="Bucharest"]');
    expect(bucharest?.getAttribute("data-g")).toBe("418");
    expect(bucharest?.getAttribute("data-h")).toBe("0");
    expect(bucharest?.getAttribute("data-f")).toBe("418");
    expect(bucharest?.getAttribute("data-replaced")).toBe("true");
    const card = document.querySelector("li[data-state='Bucharest']");
    expect(card?.getAttribute("data-g")).toBe("418");
    expect(card?.getAttribute("data-replaced")).toBe("true");
    expect(card?.textContent).toContain("418");
  });
});