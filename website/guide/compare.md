# Compare two runs

Use this to see what a change did: a bug fix in PhosKinTime, a new configuration or new data.

1. Open both bundles (drop both at once, or one after the other).
2. Press **Compare** in the top bar.
3. Choose **A (before)** and **B (after)**.

![Compare view](../assets/screenshots/compare.png){ .shot }

## What you get

| Part | Shows |
|---|---|
| Provenance and compatibility | versions, commits, configuration, and how parameters were matched |
| Known issues | which issues were open for A and for B |
| Goodness of fit | R² and RMSE per layer for both runs, with the differences |
| Trajectory overlay | A in grey, B in black; red where B is higher, blue where B is lower |
| Per-state difference | B − A over time |
| Δ heatmap | state × time, colour scale centred on zero |
| Parameter changes | sorted by the size of the fold change |

Parameters are matched by position when both runs have the same parameter order, otherwise by
name. The view says which, and lists parameters present in only one run.

## Keep the result

- **Export comparison report (HTML + CSV)** saves a self-contained report and the differences as
  a table, ready to attach to a pull request.
- Every part has its own PNG, PDF, SVG, CSV and (for plots) TikZ buttons. The two table parts have
  no TikZ button. The side-by-side fit table is wider than a single column, so the export dialog
  asks you to choose a fix.
