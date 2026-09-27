# Search sheet

A graph-paper player for a single search loop. The sheet replays a trace. It does not search on its own.

The sheet picks an algorithm, then a variant. Breadth-first and depth-first toggle tree or graph and default to graph. Depth-limited and iterative deepening toggle too and default to tree; their graph variant checks repeated states inside the depth limit. Uniform-cost, greedy best-first, and A* show a fixed “graph search” label. Hill climbing, simulated annealing, local beam search, and the genetic algorithm hide the variant control. Breadth-first, depth-first, depth-limited, and iterative deepening offer the wall grid and Romania. Uniform-cost, greedy, and A* offer Romania only. Hill climbing and simulated annealing offer 8-queens and the landscape. Local beam search and the genetic algorithm offer 8-queens only. Hill climbing stops at a local maximum unless sideways moves are on, in which case an equal neighbor is allowed up to 100 times in a row.

## Library

`lib/search` is plain TypeScript. It does not import React or touch the DOM.

`Problem` has `initial`, `actions`, `result`, `stepCost`, `goalTest`, and `stateKey`. A heuristic is not part of the problem. Callers pass `f` on the policy. The demo uses `f(n) = g`.

`Node` carries `id`, `state`, `parent`, `action`, `pathCost` (`g`), and `depth`. Ids are per run, so a tree search can visit one state as two nodes.

### Frontier

The only data structure that changes:

| Kind | Pop order | Tie break |
| --- | --- | --- |
| `FifoFrontier` | oldest first | insertion |
| `LifoFrontier` | newest first | insertion |
| `PriorityFrontier` | smallest `f(n)` | earlier insertion |

Shared operations: `push`, `pop`, `isEmpty`, `containsState`, `replace`, `toArray` (pop order).

### What else the loop is allowed to vary

A queue cannot express tree versus graph, or a goal test on pop versus on generation. Those sit on `SearchPolicy`:

- `mode`: `tree` or `graph`. Graph mode records a state as explored when the node is expanded, and will not push that state again.
- `goalTest`: `pop` or `generate`. A goal is not expanded.
- `replaceFrontier`: `never`, or `if-lower-f` (graph mode only). Replacement compares `f`, not `g` alone.
- `f`: defaults to `g` in the demo.
- `depthLimit`: depth-limited search. A popped node at that depth is goal-tested and not expanded. If any branch hits the limit and no goal is found, the result is cutoff. If the frontier empties with no cutoff, the result is failure. `firstActionFirst` makes the first action the next pop, matching aima-python’s recursive depth-limited search.
- `expansionLimit`: a safety stop so tree search on a cyclic grid can be replayed. It is not part of BFS or DFS. The sheet caps depth-first tree search at 12 expansions and breadth-first tree search at 400.

The four algorithms are thin wrappers. Breadth-first uses a FIFO queue. Depth-first uses a LIFO stack. Graph search marks a node explored when it is popped (after a failed on-pop goal test) and will not push a state that is explored or already in the frontier. Tree search has no explored set. Breadth-first graph search goal-tests a child when it is generated, matching aima-python `breadth_first_graph_search`. The other three goal-test on pop.

### Trace

`search` appends a `StepEvent` for every seed, pop, goal check, expansion, generated child, frontier add, frontier replace, and frontier skip. Pop, add, and replace events include the frontier in pop order, so the panel does not re-sort a heap.

`frameAt(trace, i)` folds events `0..i`. A parent→child edge is recorded only when the child is added to the frontier, and that edge stays for the rest of the trace. Explored and frontier fills come from those sets and do not follow the active node. The solution path is empty until a goal check succeeds. `plainEnglish` and `examNotation` are computed from the event, including the frontier in pop order.

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

Depth-first tree search does not terminate on this grid: after `0,0 0,1 0,2 1,2` it expands `0,2` again. The player stops it at the expansion cap and flags the repeated state. Breadth-first tree search matches the graph prefix for four expansions, then generates `(0,0)` again, and does reach the goal because every depth is finite.

Romania is the aima-python undirected map (Arad–Sibiu 140, Sibiu–Fagaras 99, Fagaras–Bucharest 211, and the rest). Neighbor order follows that file’s `make_undirected`. Straight-line distances to Bucharest are data only.

## Commands

```bash
npm test
npm run test:e2e
npm run dev
```

## Algorithms

| # | Algorithm | Frontier | f(n) | Explored when | Goal test | Fixture |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Breadth-first tree | FIFO | queue order | none | on pop | wall grid; prefix `0,0 1,0 0,1 2,0`, then `0,0` again |
| 2 | Breadth-first graph | FIFO | queue order | on pop | on generate | wall grid path above, cost 5 |
| 3 | Depth-first tree | LIFO | stack order | none | on pop | does not terminate; prefix `0,0 0,1 0,2 1,2 0,2` |
| 4 | Depth-first graph | LIFO | stack order | on pop, first path kept | on pop | wall grid path `0,0 0,1 0,2 1,2 2,2 3,2` |
| 5 | Depth-limited tree | LIFO, first action popped first | queue order is unused | none | on pop, then stop at depth L | wall grid: L=1 cutoff after expanding `0,0`; L=5 path `0,0 1,0 2,0 3,0 3,1 3,2` |
| 5b | Depth-limited graph | same | unused | on pop, each state once | same | same limit; a repeated state is skipped instead of expanded |
| 6 | Iterative deepening tree | same, restarted each L | unused | none, cleared every iteration | same as depth-limited | wall grid, L = 0…5, same shallowest path; nodes expanded again are counted |
| 6b | Iterative deepening graph | same | unused | on pop, each state once per iteration | same | a new iteration still starts over; inside one limit a state is expanded once |
| 7 | Uniform-cost | priority queue by g | g | on pop | on pop | Romania Arad→Bucharest cost 418; a worse frontier node is replaced |
| 8 | Greedy best-first | priority queue by h | h | on pop | on pop | Romania Arad–Sibiu–Fagaras–Bucharest, cost 450 |
| 9 | A* | priority queue by g + h | g + h | on pop | on pop | Romania Arad–Sibiu–Rimnicu Vilcea–Pitesti–Bucharest, cost 418 |
| 10 | Hill climbing | none | — | none | stop at a local maximum | 8-queens. Sideways moves off stops at the first local max; on, an equal neighbor is allowed up to 100 in a row |
| 11 | Simulated annealing | none | — | none | stop when T = 0 | landscape; seed 2 accepts a downhill step off x = 4. Fast cooling stays on that peak |
| 12 | Local beam search | none | — | none | a pooled successor is a goal | k states, one combined successor pool, then the best k |
| 13 | Genetic algorithm | none | — | none | fitness 28 | 8-queens, population 8, seed 36, mean fitness rises for 10 generations |
