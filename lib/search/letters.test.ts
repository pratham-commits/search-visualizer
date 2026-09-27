import { describe, expect, it } from "vitest";
import { aStarSearch } from "./algorithms";
import { examNotation, plainEnglish } from "./explain";
import {
  CITIES,
  CITY_LABEL,
  romaniaDisplay,
  romaniaProblem,
  ROMANIA_LETTERS,
  ROMANIA_SLD,
  type City,
} from "./problems/romania";

describe("Romania letter labels", () => {
  it("assigns S to Arad, G to Bucharest, and the remaining letters in city order", () => {
    expect(ROMANIA_LETTERS.Arad).toBe("S");
    expect(ROMANIA_LETTERS.Bucharest).toBe("G");
    const letters = CITIES.map((city) => ROMANIA_LETTERS[city]);
    expect(new Set(letters).size).toBe(CITIES.length);
    expect(letters.filter((letter) => letter === "S")).toEqual(["S"]);
    expect(letters.filter((letter) => letter === "G")).toEqual(["G"]);
    const rest = CITIES.filter((city) => city !== "Arad" && city !== "Bucharest").map(
      (city) => ROMANIA_LETTERS[city],
    );
    expect(rest).toEqual(
      [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((letter) => letter !== "S" && letter !== "G").slice(0, rest.length),
    );
    for (const city of CITIES) {
      expect(romaniaDisplay(city, "letters")).toBe(ROMANIA_LETTERS[city]);
      expect(romaniaDisplay(city, "cities")).toBe(CITY_LABEL[city]);
    }
    expect(romaniaDisplay("0,0", "letters")).toBe("0,0");
  });

  it("keeps the optimal path and cost 418, and only the printed name follows the label mode", () => {
    const problem = romaniaProblem();
    const heuristic = (city: City) => ROMANIA_SLD[city];
    expect(problem.initial).toBe("Arad");
    expect(problem.goalTest("Bucharest")).toBe(true);
    expect(romaniaDisplay(problem.initial, "letters")).toBe("S");
    expect(romaniaDisplay("Bucharest", "letters")).toBe("G");
    expect(romaniaDisplay(problem.initial, "cities")).toBe("Arad");
    expect(romaniaDisplay("Bucharest", "cities")).toBe("Bucharest");

    const astar = aStarSearch(problem, heuristic);
    expect(astar.path).toEqual(["Arad", "Sibiu", "Rimnicu", "Pitesti", "Bucharest"]);
    expect(astar.cost).toBe(418);
    for (const city of astar.path) {
      expect(heuristic(city)).toBe(ROMANIA_SLD[city]);
    }

    const sibiu = astar.trace.find(
      (event) => event.type === "frontier-add" && event.stateKey === "Sibiu",
    );
    expect(sibiu).toBeDefined();
    expect(examNotation(sibiu!)).toContain("f(Sibiu) = g + h = 140 + 253 = 393");
    expect(plainEnglish(sibiu!)).toContain("Sibiu");
    expect(examNotation(sibiu!, "letters")).toContain(
      `f(${ROMANIA_LETTERS.Sibiu}) = g + h = 140 + 253 = 393`,
    );
    expect(plainEnglish(sibiu!, "letters")).toContain(ROMANIA_LETTERS.Sibiu);
    expect(examNotation(sibiu!, "letters")).toContain(`Frontier:`);
    expect(examNotation(sibiu!, "cities")).toBe(examNotation(sibiu!));
  });
});
