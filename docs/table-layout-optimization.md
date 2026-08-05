# Table Layout Optimization Research Note

Hushmark currently uses the browser's automatic, content-sensitive table layout. This note records possible future work; it does not describe an implemented custom layout engine or commit the project to building one.

## Minimum-Height Layout

Allocating width where it produces the largest reduction in text wrapping is an established research problem called minimum-height automatic table layout.

For column widths `w_i` under a fixed available width `W`:

```text
sum(w_i) <= W
```

Each cell has a stepwise height function `h[r,i](w_i)`, determined by where its text wraps. The table height is approximately:

```text
H(w) = sum over rows r of max over columns i of h[r,i](w_i)
```

The objective is to choose widths that minimize `H(w)`.

## Existing Algorithms

The 2011 paper [Optimal Automatic Table Layout](https://research.monash.edu/en/publications/optimal-automatic-table-layout/) addresses this problem directly. It presents three algorithms guaranteed to find a minimum-height layout:

- A* search with an admissible area-based lower bound.
- Traditional constraint-programming search.
- A CP/SAT hybrid using lazy clause generation.

Exact minimum-height layout is NP-hard, so these approaches can take exponential time in the worst case.

The earlier paper [Toward Tighter Tables](https://research.monash.edu/en/publications/toward-tighter-tables/) describes practical approximations:

- Model each cell as approximately constant content area.
- Start every column at its minimum width.
- Repeatedly widen the column that produces the best table-height reduction.
- Combine the continuous approximation with iterative widening.

The iterative approach closely matches the intuition of assigning width where it removes the most vertical wrapping.

## Why It Is Difficult

Cell height is not a smooth function of width. Giving a column another pixel usually does nothing until the width crosses a wrapping breakpoint and an entire line disappears.

Rows add another interaction. Reducing one cell from four lines to three does not reduce table height when another cell in the same row remains five lines tall. Sometimes a column must receive width with no immediate benefit before a later increment reduces the row. A purely greedy algorithm can therefore miss the optimum.

Browsers do not minimize rendered table height. CSS automatic layout computes min-content and preferred widths, then distributes available width among columns. It considers content width but does not use wrapped table height as its objective. [CSS Tables Level 3](https://www.w3.org/TR/css-tables-3/) documents the intrinsic-width model.

## Secondary Objectives

All physical columns have the same table height because they share rows. If "column height" means the combined wrapped content height of a column's cells, a useful lexicographic objective would be:

1. Minimize total table height.
2. Minimize the tallest column-content height.
3. Minimize the second tallest, then the third, and so forth.
4. Minimize total wrapped lines or raggedness.
5. Avoid extreme column-width ratios.

Sorting the column-height vector before comparing it avoids arbitrarily favoring the first column. A constraint solver or A* search can support this objective.

For predictable reader behavior, retain these hard constraints:

- Do not split ordinary words.
- Respect images and intrinsically sized content.
- Give every column its min-content width.
- Use local horizontal scrolling when those minimums do not fit.
- Avoid unstable one-pixel layout changes while resizing.

## Possible Hushmark Approach

A practical implementation could enumerate only widths where a cell changes line count instead of testing every pixel. It could then use branch-and-bound or a carefully designed iterative-widening heuristic.

Such an implementation would require actual WebView text measurements and would need to respond to viewport, zoom, layout, font, image, and print changes. Measurements should be cached and recalculation should avoid visible layout thrashing. Final widths could be applied through generated `colgroup` elements or equivalent controlled column styles.

The 2005 iterative-widening work is the most plausible foundation for a restrained reader. The 2011 A* and constraint approaches are the route to provable optimality. Hushmark should retain the browser algorithm unless real documents demonstrate enough remaining value to justify this complexity.
