# Glossary

Bundle
:   A folder or zip with the manifest, tables and arrays of one model run.

Manifest
:   `manifest.json`: what produced the run, and every file with its sha256.

protwise / networkmodel
:   PhosKinTime's two workflows: one model per protein, or one model of the whole network.

Layer
:   The kind of measurement: mRNA, protein or phosphosite.

Psite
:   A phosphorylation site of a protein.

State
:   One variable of the model, for example a protein or one of its sites.

Observed / predicted
:   Measured values and model values. Missing observations are shown as gaps, never as zero.

R²
:   The squared Pearson correlation between observed and predicted values, as PhosKinTime reports
    it. It is not 1 − residual/total sum of squares.

RMSE
:   Root mean square error about the identity line (predicted = observed).

Robust σ
:   1.4826 × the median absolute deviation of the residuals.

Parity
:   How a panel relates to the PhosKinTime plotting function it replaces.

Known issues
:   Problems PhosKinTime had on record at the commit that produced the run.
