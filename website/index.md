---
title: PhosKinTime-Vis
---

# PhosKinTime-Vis

<div class="hero" markdown>
![PhosKinTime-Vis by BioVisForge](assets/brand/wordmark-light.svg#only-light)
![PhosKinTime-Vis by BioVisForge](assets/brand/wordmark-dark.svg#only-dark)
</div>

**An offline viewer and run-comparison tool for [PhosKinTime](https://github.com/bibymaths/phoskintime) run bundles.**

PhosKinTime fits ODE models of phosphorylation kinetics and transcriptional time series. This
viewer opens the results of a run in your browser, checks that the files are intact, redraws the
plots from the stored data and puts two runs side by side, for example before and after a
scientific fix.

[Try the live demo](demo/index.html){ .md-button .md-button--primary }
[Get started](guide/getting-started.md){ .md-button }

![The run overview: verification, fit headline and sections](assets/screenshots/overview.png){ .shot }

## What you can do

| | |
|---|---|
| **Check a run** | every file's sha256 is recomputed; open known issues of the producing code are shown |
| **Read it by question** | fit quality, dynamics, parameters, uncertainty, sensitivity, steady state and network |
| **Compare runs** | trajectories, differences, parameter changes and a report to attach to a pull request |
| **Publish figures** | PNG, vector PDF, SVG, CSV and TikZ/PGFPlots at journal widths |
| **Work privately** | one HTML file, works offline, nothing is uploaded |

!!! warning "Draft contract"
    PhosKinTime has not published a bundle format yet. The viewer reads a **draft** schema (1.0)
    written in this project, and all example data is synthetic. See
    [Bundle schema](reference/bundle-schema.md).
