#!/usr/bin/env bash
# Compile every panel's standalone PGFPlots export with LuaLaTeX, and with pdfLaTeX when the
# export has no raster layer (i.e. is under the TeX size threshold). Fails on any error.
#
# Usage: tests/tikz/compile_all.sh <export-all.zip | directory of *_tikz.zip> [workdir]
set -euo pipefail
src="$1"
work="${2:-$(mktemp -d)}"
mkdir -p "$work"
if [[ -f "$src" ]]; then unzip -q -o "$src" -d "$work/all"; else cp "$src"/*_tikz.zip "$work/" ; mkdir -p "$work/all"; mv "$work"/*_tikz.zip "$work/all/"; fi
command -v lualatex >/dev/null || { echo "lualatex not found: install TeX Live (lualatex, pgfplots)"; exit 2; }
pass=0; fail=0; results=()
for z in "$work"/all/*_tikz.zip; do
  name=$(basename "$z" _tikz.zip)
  d="$work/$name"; rm -rf "$d"; mkdir -p "$d"; unzip -q -o "$z" -d "$d"
  tex=$(cd "$d" && ls *-standalone.tex)
  name_stem=${tex%-standalone.tex}
  raster=$(find "$d" -maxdepth 1 -name "*-layer*.png" | wc -l)
  ok=1
  ( cd "$d" && timeout 600 lualatex -interaction=nonstopmode -halt-on-error "$tex" > lualatex.log 2>&1 ) || ok=0
  engine="lualatex"
  pdfok=$(grep -m1 -c '^% points: .*pdflatex: yes' "$d/$name_stem.tex" 2>/dev/null || true)
  if [[ $ok == 1 && "$pdfok" == 1 ]]; then
    mkdir -p "$d/pdf"; cp -r "$d"/*.tex "$d"/data "$d/pdf/" 2>/dev/null || true
    ( cd "$d/pdf" && timeout 600 pdflatex -interaction=nonstopmode -halt-on-error "$tex" > pdflatex.log 2>&1 ) && engine="lualatex+pdflatex" || { ok=0; engine="pdflatex"; }
  fi
  if [[ $ok == 1 ]]; then pass=$((pass+1)); results+=("PASS $name ($engine, raster layers: $raster, $(grep -m1 -o "points: [0-9]*" "$d/$name_stem.tex"))"); else fail=$((fail+1)); msg=$( { grep -h -m1 -A2 '^!' "$d"/lualatex.log "$d"/pdf/pdflatex.log 2>/dev/null || true; } | tr '\n' ' ' | cut -c1-200); results+=("FAIL $name ($engine): $msg"); fi
done
printf '%s\n' "${results[@]}"
echo "compiled: $pass passed, $fail failed (workdir $work)"
[[ $fail == 0 ]]
