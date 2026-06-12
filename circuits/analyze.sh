#!/bin/bash

# Static-analysis checks for the Circom nullification circuits.

set -euo pipefail

cd "$(dirname "$0")"

CIRCUITS=(
  "nullification_xor.circom"
  "nullification.circom"
)

command -v circomspect >/dev/null 2>&1 || {
  echo "Error: circomspect is not installed. Run: cargo install circomspect"
  exit 1
}

if [ ! -d "node_modules/circomlib" ]; then
  echo "Error: circomlib is not installed. Run: npm ci from the circuits directory."
  exit 1
fi

echo "=========================================="
echo "Circom Static Analysis"
echo "=========================================="

for circuit in "${CIRCUITS[@]}"; do
  echo ""
  echo "[circomspect] ${circuit}"
  circomspect "${circuit}"
done

if command -v circom >/dev/null 2>&1; then
  for circuit in "${CIRCUITS[@]}"; do
    echo ""
    echo "[circom --inspect] ${circuit}"
    circom --inspect "${circuit}"
  done
else
  echo ""
  echo "[circom --inspect] skipped: circom compiler is not installed."
fi

echo ""
echo "Circuit static analysis complete."
