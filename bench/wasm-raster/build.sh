#!/usr/bin/env bash
# Rebuild the tiny-skia spike and the benchmark page (decision 0006). Needs Rust with the
# wasm32-unknown-unknown target. Not part of the app build.
set -euo pipefail
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown --manifest-path crate/Cargo.toml
B64=$(base64 -w0 crate/target/wasm32-unknown-unknown/release/pkv_kernels.wasm)
sed "s#__WASM_BASE64__#${B64}#" bench.template.html > bench.html
echo "now: node bench/wasm-raster/run.mjs (from the repository root)"
