#!/bin/bash

# Nullification Circuit Compilation Script
# This script automates the Circom circuit compilation and PLONK setup

set -e  # Exit on any error

echo "=========================================="
echo "Nullification Circuit Compiler"
echo "=========================================="

# Check prerequisites
command -v circom >/dev/null 2>&1 || { echo "Error: circom not installed. See README.md"; exit 1; }
command -v snarkjs >/dev/null 2>&1 || { echo "Error: snarkjs not installed. Run: npm install -g snarkjs"; exit 1; }

# Create build directory
mkdir -p build

# Step 1: Install circomlib if not present
if [ ! -d "node_modules/circomlib" ]; then
    echo ""
    echo "[1/6] Installing circomlib..."
    npm init -y 2>/dev/null || true
    npm install circomlib
else
    echo ""
    echo "[1/6] circomlib already installed ✓"
fi

# Step 2: Compile circuit
echo ""
echo "[2/6] Compiling circuit..."
circom nullification.circom --r1cs --wasm --sym -o build

# Step 3: Download Powers of Tau (if not present)
PTAU_FILE="pot16_final.ptau"
if [ ! -f "$PTAU_FILE" ]; then
    echo ""
    echo "[3/6] Downloading Powers of Tau ceremony file..."
    echo "      This may take a few minutes..."
    wget -q --show-progress https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau -O $PTAU_FILE
else
    echo ""
    echo "[3/6] Powers of Tau file already exists ✓"
fi

# Step 4: Generate PLONK proving key
echo ""
echo "[4/6] Generating PLONK proving key..."
echo "      This may take several minutes and use significant memory..."
snarkjs plonk setup build/nullification.r1cs $PTAU_FILE nullification_final.zkey

# Step 5: Export verification key
echo ""
echo "[5/6] Exporting verification key..."
snarkjs zkey export verificationkey nullification_final.zkey verification_key.json

# Step 6: Copy to public directory
echo ""
echo "[6/6] Copying artifacts to public/circuits/..."
mkdir -p ../public/circuits
cp build/nullification_js/nullification.wasm ../public/circuits/
cp nullification_final.zkey ../public/circuits/
cp verification_key.json ../public/circuits/

# Print summary
echo ""
echo "=========================================="
echo "Compilation Complete!"
echo "=========================================="
echo ""
echo "Generated files:"
ls -lh ../public/circuits/
echo ""
echo "Circuit statistics:"
snarkjs r1cs info build/nullification.r1cs
echo ""
echo "You can now use the nullification feature!"
echo "To test, run: snarkjs plonk prove ..."
