# What-if preview

!!! warning "Preview only"
    There is no simulation engine yet. This view talks to a **mock** that rescales stored results.
    It does not solve any equations. Do not draw scientific conclusions from it.

The view exists so that the interface can be built before PhosKinTime's engine does.

1. Start the mock on your machine, from a source checkout:

    ```bash
    node scripts/mock-engine.mjs tests/fixtures/out/small-protwise.pkt
    ```

2. Open the viewer with `?engine=mock` added to the address, and open the same bundle.
3. Press **Open What-if**, connect to `http://127.0.0.1:8765`, change a parameter or knock out a
   state and run.

The planned engine interface is described in [Engine API (draft)](../reference/engine-api.md).
