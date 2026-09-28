# Search sheet

A graph-paper player for a single search loop. The sheet replays a trace. It does not search on its own.

The sheet picks an algorithm, then a variant. Breadth-first and depth-first toggle tree-like or graph and default to graph. Depth-limited and iterative deepening toggle too and default to tree-like; their graph variant keeps a reached set inside the depth limit. Uniform-cost, greedy best-first, and A* show a fixed “Graph” label. Uniform-cost search is also Dijkstra's algorithm. Hill climbing, simulated annealing, local beam search, and the genetic algorithm hide the variant control. Breadth-first, depth-first, depth-limited, and iterative deepening offer the wall grid and Romania. Uniform-cost, greedy, and A* offer Romania only. Hill climbing and simulated annealing offer 8-queens and the landscape. Local beam search and the genetic algorithm offer 8-queens only. Hill climbing stops at a local maximum unless sideways moves are on, in which case an equal neighbor is allowed up to 100 times in a row.

## Library

`lib/search` is plain TypeScript. It does not import React or touch the DOM.

`Problem` has `initial`, `actions`, `result`, `actionCost` (`ACTION-COST`), `isGoal` (`IS-GOAL`), and `stateKey`. A heuristic is not part of the problem. Callers pass `f` on the policy. `g(n)` is `PATH-COST`. The demo uses `f(n) = g`.

`Node` carries `id`, `state`, `parent`, `action`, `pathCost` (`g`), and `depth`. Ids are per run, so a tree-like search can visit one state as two nodes.

### Frontier

The only data structure that changes:

| Kind | Pop order | Tie break |
| --- | --- | --- |
| `FifoFrontier` | oldest first | insertion |
| `LifoFrontier` | newest first | insertion |
| `PriorityFrontier` | smallest `f(n)` | earlier insertion |

Shared operations: `push`, `pop`, `isEmpty`, `containsState`, `replace`, `toArray` (pop order).

### What else the loop is allowed to vary

A queue cannot express tree-like versus graph search, or IS-GOAL on pop versus on generation. Those sit on `SearchPolicy`:

- `mode`: `tree` or `graph`. Graph search puts the initial state in `reached`, then adds a state when a child is generated and is not already there. That set is the initial state plus every state added to the frontier. Uniform-cost, greedy, and A* also keep `reached` as a table of state → best `PATH-COST`, written when the state is first reached and replaced when a cheaper path is still in the frontier. An already-expanded state is not reopened.
- `isGoalWhen`: `pop` or `generate`. A goal is not expanded. Breadth-first graph search calls IS-GOAL when a child is generated.
- `replaceFrontier`: `never`, or `if-lower-f` (graph mode only). Replacement compares `f`, not `g` alone.
- `f`: defaults to `g` (`PATH-COST`) in the demo. Uniform-cost uses `PATH-COST`, greedy uses `h`, and A* uses `g + h`.
- `depthLimit`: depth-limited search. A popped node at that depth fails IS-GOAL and is not expanded; the result is the `cutoff` sentinel. If the frontier empties with no cutoff, the result is failure. Tree-like search uses IS-CYCLE instead of a reached table. `firstActionFirst` makes the first action the next pop.
- `expansionLimit`: a safety backstop, not part of the algorithm. IS-CYCLE is what stops tree-like search from looping. The sheet still caps depth-first tree-like search at 12 expansions and breadth-first tree-like search at 400.

Breadth-first uses a FIFO queue. Depth-first uses a LIFO stack. Graph search keeps a global `reached` table and skips every redundant path. Tree-like search keeps none: IS-CYCLE(node) walks ancestors and skips a state already on the current path, but another branch can still reach that state. Breadth-first graph search calls IS-GOAL when a child is generated, before the reached check. The other uninformed searches call IS-GOAL on pop. Iterative deepening raises the depth limit from 0 upward and restarts after each cutoff. Uniform-cost, greedy best-first, and A* are BEST-FIRST-SEARCH with `f` equal to PATH-COST, `h`, and `g + h`. EXPAND generates the successors.

### Trace

`search` appends a `StepEvent` for every seed, pop, goal check, expansion, generated child, frontier add, frontier replace, and frontier skip. Pop, add, and replace events include the frontier in pop order, so the panel does not re-sort a heap.

`frameAt(trace, i)` folds events `0..i`. A parent→child edge is recorded only when the child is added to the frontier, and that edge stays for the rest of the trace. Reached and frontier fills come from those sets and do not follow the active node. The solution path is empty until IS-GOAL succeeds. `plainEnglish` and `examNotation` are computed from the event, including the frontier in pop order. The exam line is `Reached: {...}`.

## Fixtures

Wall grid, 4 by 3, `y` growing south. `#` is a wall. Enter cost is 1.

```
S . . .
. # . .
. . . G
```

Manhattan from S `(0,0)` to G `(3,2)` is 5. A route of length 5 still goes around the wall, so 5 is optimal. Actions are N, E, S, W.

Breadth-first graph search expands `0,0 1,0 0,1 2,0 0,2 3,0 2,1 1,2 3,1` and returns

`0,0 → 1,0 → 2,0 → 3,0 → 3,1 → 3,2`

when `(3,2)` is generated. `(3,2)` is not expanded.

Depth-first graph search expands `0,0 0,1 0,2 1,2 2,2` and keeps the first path

`0,0 → 0,1 → 0,2 → 1,2 → 2,2 → 3,2`

Depth-first tree-like search terminates here because IS-CYCLE refuses the step from `1,2` back to `0,2`. It still reaches the goal; the expansion cap is only a backstop. Breadth-first tree-like search also skips that return to a parent. It keeps no reached table, so a later branch can still expand a state the first branch already expanded.

Romania is the aima-python undirected map (Arad–Sibiu 140, Sibiu–Fagaras 99, Fagaras–Bucharest 211, and the rest). Neighbor order follows that file’s `make_undirected`. Straight-line distances to Bucharest are data only.

## Commands

```bash
npm test
npm run test:e2e
npm run dev
```

## Algorithms

| # | Algorithm | Frontier | f(n) | Reached | IS-GOAL | Fixture |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Breadth-first tree-like | FIFO | queue order | none; IS-CYCLE on the path | on pop | wall grid; skips the step back to a parent; another branch may still repeat a state |
| 2 | Breadth-first graph | FIFO | queue order | reached set, written when a state is generated | on generate | wall grid path above, cost 5 |
| 3 | Depth-first tree-like | LIFO | stack order | none; IS-CYCLE on the path | on pop | wall grid; terminates without the safety cap |
| 4 | Depth-first graph | LIFO | stack order | reached set, first path kept | on pop | wall grid path `0,0 0,1 0,2 1,2 2,2 3,2` |
| 5 | Depth-limited tree-like | LIFO, first action popped first | unused | none; IS-CYCLE; `cutoff` at ℓ | on pop, then stop at depth ℓ | wall grid: ℓ=1 cutoff after expanding `0,0`; ℓ=5 path `0,0 1,0 2,0 3,0 3,1 3,2` |
| 5b | Depth-limited graph | same | unused | reached set, each state once | same | same limit; a repeated state is skipped instead of expanded |
| 6 | Iterative deepening tree-like | same, restarted each ℓ | unused | none, cleared every iteration | same as depth-limited | wall grid, ℓ = 0…5, same shallowest path; nodes expanded again are counted |
| 6b | Iterative deepening graph | same | unused | reached set, each state once per iteration | same | a new iteration still starts over; inside one limit a state is expanded once |
| 7 | Uniform-cost (Dijkstra) | priority queue by PATH-COST | g | state → best PATH-COST | on pop | Romania Arad→Bucharest cost 418; a worse frontier node is replaced |
| 8 | Greedy best-first | priority queue by h | h | state → best PATH-COST | on pop | Romania Arad–Sibiu–Fagaras–Bucharest, cost 450 |
| 9 | A* | priority queue by g + h | g + h | state → best PATH-COST | on pop | Romania Arad–Sibiu–Rimnicu Vilcea–Pitesti–Bucharest, cost 418 |
| 10 | Hill climbing | none | — | none | stop at a local maximum | 8-queens. Sideways moves off stops at the first local max; on, an equal neighbor is allowed up to 100 in a row |
| 11 | Simulated annealing | none | — | none | stop when T = 0 | landscape; seed 2 accepts a downhill step off x = 4. Fast cooling stays on that peak |
| 12 | Local beam search | none | — | none | a pooled successor is a goal | k states, one combined successor pool, then the best k |
| 13 | Genetic algorithm | none | — | none | fitness 28 | 8-queens, population 8, seed 36, mean fitness rises for 10 generations |
