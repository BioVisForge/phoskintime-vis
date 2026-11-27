# Open a run bundle

A **run bundle** is a folder `<run>.pkt/`, or the same folder zipped as `<run>.pkt.zip`. It holds
a `manifest.json` and the tables and arrays of one model run. The manifest records what produced
the run (PhosKinTime version and commit, configuration hash) and the sha256 of every file. See
[Bundle schema](../reference/bundle-schema.md).

!!! note
    PhosKinTime does not export bundles yet (`phoskintime bundle` does not exist at the time of
    writing). Until it does, use the synthetic examples (`npm run fixtures`).

## Ways to open

- Drag and drop zips or folders onto the window. Several at once are fine.
- **Open zip…** or **Open folder…** on the start screen.
- The **Open** menu in the top bar, or the command palette.

Each open bundle appears as a chip in the top bar. Click a chip to make it the active run, **×**
to close it.

## What is checked

| Check | Outcome |
|---|---|
| `manifest.json` present and valid for its schema version | otherwise the bundle is refused with a message |
| Schema major version | 1.0 loads; 1.x loads with a notice; 2.0 and newer are refused |
| sha256 of every listed file | badge **verified**, or **mismatch** with the file names |
| Tables and columns each panel needs | panels that lack data say **Not available** and why |

Verification runs after the first panels are drawn, so wait for the badge before you rely on a
figure.

## Your data stays local

Files are read inside your browser tab. Nothing is uploaded. The page's security policy blocks
network access except to its own files and to an engine on your own machine that you connect to.
