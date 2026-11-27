# Getting started

You need a recent Chromium-based browser or Firefox (both are covered by the automated tests;
Safari is not tested). Nothing has to be installed to look at the examples.

## 1. Get the viewer

=== "Live demo"

    Open the [demo](../demo/index.html). Under **Synthetic demo** press `network`,
    `small-protwise` or `network-after-fix`.

=== "Single file (offline)"

    Download `phoskintime-vis-vX.Y.Z.html` from the
    [releases page](https://github.com/BioVisForge/phoskintime-vis/releases) and open it with a
    double click. It works without a network connection. The release zip also holds the example
    bundles.

=== "From source"

    Needs Node 24 and Python 3.13 (Python only to generate the example bundles).

    ```bash
    git clone https://github.com/BioVisForge/phoskintime-vis.git
    cd phoskintime-vis
    npm ci
    python -m pip install -r tests/requirements-dev.txt
    npm run fixtures        # synthetic example bundles in tests/fixtures/out/
    npm run build:single    # dist-single/index.html
    ```

    Open `dist-single/index.html` in your browser.

## 2. Open a bundle

Drop a `<run>.pkt.zip` file or a `<run>.pkt/` folder anywhere in the window, or use **Open zip…**
/ **Open folder…**.

## 3. Check the badge

The inspector on the right shows **✔ sha256 verified** once every file has been checked. If it
shows a mismatch, see [Troubleshooting](troubleshooting.md).

## 4. Look around

- The **Overview** gives the fit headline (R², RMSE), warnings and open known issues.
- The sidebar sections follow scientific questions. The numbers beside them say how many panels
  this bundle can draw.
- Press ++ctrl+k++ (++cmd+k++ on macOS) and type a panel or protein name.

Next: [Explore a run](explore.md).
