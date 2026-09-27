import { expect, test } from "@playwright/test";
import { WALL_GRID_OPTIMAL_PATH } from "../lib/search/problems/fixtures";

test("final frame highlights the hand-checked path and no contradictory marks", async ({
  page,
}) => {
  await page.goto("/");
  const trace = page.getByRole("slider", { name: "Trace" });
  const max = await trace.getAttribute("max");
  expect(max).toBeTruthy();
  await trace.focus();
  await page.keyboard.press("End");
  await expect(page.getByText(`${Number(max) + 1} / ${Number(max) + 1}`)).toBeVisible();

  const path = await page.locator('[data-path="true"]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-cell")).sort(),
  );
  expect(path).toEqual([...WALL_GRID_OPTIMAL_PATH].sort());
  expect(await page.locator("[data-tree-edge]").count()).toBeGreaterThan(0);
  await expect(page.getByRole("region", { name: "Plain English" })).not.toBeEmpty();
  await expect(page.getByRole("region", { name: "Exam notation" })).not.toBeEmpty();

  const cells = page.locator("[data-cell]");
  const count = await cells.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const cell = cells.nth(i);
    const wall = await cell.getAttribute("data-wall");
    const onPath = await cell.getAttribute("data-path");
    const explored = await cell.getAttribute("data-explored");
    const frontier = await cell.getAttribute("data-frontier");
    if (wall === "true") {
      expect(onPath).not.toBe("true");
      expect(explored).not.toBe("true");
      expect(frontier).not.toBe("true");
    }
    expect(explored === "true" && frontier === "true").toBe(false);
  }
});
