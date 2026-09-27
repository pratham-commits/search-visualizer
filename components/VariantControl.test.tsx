import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SearchBench } from "./SearchBench";

function treeEdges(): string[] {
  return [...document.querySelectorAll("[data-tree-edge]")]
    .map((element) => element.getAttribute("data-tree-edge"))
    .filter((value): value is string => value !== null)
    .sort();
}

function jumpToEnd() {
  const slider = screen.getByRole("slider", { name: "Trace" });
  fireEvent.change(slider, { target: { value: slider.getAttribute("max") } });
}

afterEach(() => {
  cleanup();
});

describe("variant control", () => {
  it("matches the properties table and the tree to the selected variant", () => {
    render(<SearchBench />);
    expect(document.querySelector("[data-policy-explored]")?.textContent).toBe(
      "on pop",
    );
    jumpToEnd();
    const graphEdges = treeEdges();
    expect(graphEdges.length).toBeGreaterThan(0);
    expect(document.querySelector("[data-live-explored]")?.textContent).not.toContain(
      "tree search keeps no explored set",
    );

    fireEvent.click(screen.getByRole("button", { name: "Tree" }));
    expect(document.querySelector("[data-policy-explored]")?.textContent).toBe(
      "none — tree search",
    );
    jumpToEnd();
    const treeRun = treeEdges();
    expect(treeRun).not.toEqual(graphEdges);
    expect(document.querySelector("[data-live-explored]")?.textContent).toContain(
      "tree search keeps no explored set",
    );
  });

  it("shows a fixed graph label for uniform-cost and A*, and no toggle", () => {
    render(<SearchBench />);
    fireEvent.click(screen.getByRole("button", { name: "Uniform-cost" }));
    expect(document.querySelector("[data-variant-label]")?.textContent).toBe(
      "graph search",
    );
    expect(screen.queryByRole("button", { name: "Tree" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Graph" })).toBeNull();
    expect(document.querySelector("[data-policy-explored]")?.textContent).toBe(
      "on pop",
    );

    fireEvent.click(screen.getByRole("button", { name: "A*" }));
    expect(document.querySelector("[data-variant-label]")?.textContent).toBe(
      "graph search",
    );
    expect(screen.queryByRole("button", { name: "Tree" })).toBeNull();
    expect(document.querySelector("[data-policy-f]")?.textContent).toBe("g + h");
  });

  it("lists only the syllabus algorithms and the problems that fit", () => {
    render(<SearchBench />);
    for (const name of [
      "Breadth-first",
      "Depth-first",
      "Depth-limited",
      "Iterative deepening",
      "Uniform-cost",
      "Greedy best-first",
      "A*",
      "Hill climbing",
      "Simulated annealing",
      "Local beam search",
      "Genetic algorithm",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    const exact = (label: string) =>
      screen.queryByRole("button", { name: (value) => value === label });
    expect(exact("Bidirectional")).toBeNull();
    expect(exact("Best-first")).toBeNull();
    expect(exact("Recursive best-first")).toBeNull();
    expect(exact("And-or")).toBeNull();
    expect(exact("Online DFS")).toBeNull();
    expect(exact("LRTA*")).toBeNull();
    expect(screen.getByRole("button", { name: "Wall grid" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Romania" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "8 queens" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Landscape" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hill climbing" }));
    expect(screen.getByRole("button", { name: "8 queens" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Landscape" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Wall grid" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Romania" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "sideways moves" })).not.toBeChecked();

    for (const name of ["Uniform-cost", "Greedy best-first", "A*"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(screen.queryByRole("button", { name: "Wall grid" })).toBeNull();
      expect(screen.getByRole("button", { name: "Romania" }).getAttribute("aria-pressed")).toBe(
        "true",
      );
    }

    fireEvent.click(screen.getByRole("button", { name: "Hill climbing" }));
    fireEvent.click(screen.getByRole("button", { name: "Landscape" }));
    fireEvent.click(screen.getByRole("button", { name: "Simulated annealing" }));
    expect(screen.getByRole("button", { name: "Landscape" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "8 queens" })).toBeTruthy();
    for (const name of ["Local beam search", "Genetic algorithm"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(screen.queryByRole("button", { name: "Landscape" })).toBeNull();
      expect(screen.getByRole("button", { name: "8 queens" }).getAttribute("aria-pressed")).toBe(
        "true",
      );
    }
  });
});