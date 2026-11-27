# Explore a run

![Fit quality section](../assets/screenshots/fit.png){ .shot }

## The screen

| Area | What it holds |
|---|---|
| Top bar | open bundles, **Open**, **Compare**, command palette, raw lines, density, theme, inspector, help |
| Sidebar | sections with the number of available panels; a workflow filter (protwise, networkmodel) |
| Main area | the protein / psite / layer bar and the panels of the section |
| Inspector | the run's identity and verification, known issues, warnings, and details of the panel you point at |

## Sections

| Section | Question it answers |
|---|---|
| Overview | Is this run intact, and roughly how good is the fit? |
| Fit quality | Where does the model disagree with the observations? |
| Dynamics | What do trajectories, knockouts and kinase activity look like? |
| Parameters | What values were fitted and how do they relate? |
| Uncertainty | How certain are they (posterior, intervals, multistart, profiles, Pareto)? |
| Sensitivity | Which parameters matter? |
| Steady state & network | Where does the system settle, and how is it connected? |
| Compare | How do two runs differ? (appears with two or more bundles) |

## Choose what to look at

The **protein**, **psite** and **layer** selectors drive every panel that depends on them. The
choice is kept in the page address, so a copied link shows the same view. **Copy deep link** in a
panel's menu links straight to that panel.

## Panel menu (⋯)

- **Export PNG / PDF / SVG / CSV / TikZ** and **Export options…** (see [Export](export.md))
- **View data**: the numbers behind the plot, as a table
- **Copy deep link**
- **About this plot**: definition and the PhosKinTime function it corresponds to

The badge on each panel says how it relates to PhosKinTime's own plot: **Full**, **Partial**,
**Substituted** (a more honest chart type is used), **Viewer extra** or **Not available**.

## Keyboard

| Keys | Action |
|---|---|
| ++ctrl+k++ / ++cmd+k++ | command palette: panels, sections, proteins, actions |
| ++question++ | help |
| ++tab++ | move between controls |

## Display

**Raw lines** draws every single series instead of summaries where a panel offers it. The theme
button switches light and dark; the density button switches comfortable and compact spacing.
Exports are always light.
