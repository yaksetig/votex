#!/bin/bash

# Nullification Circuit Compilation Script
# This script automates the Circom circuit compilation and Groth16 setup

set -e  # Exit on any error

echo "=========================================="
echo "Nullification Circuit Compiler (Groth16)"
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

# Step 4: Generate Groth16 proving key (Phase 2)
echo ""
echo "[4/7] Generating Groth16 initial proving key..."
snarkjs groth16 setup build/nullification.r1cs $PTAU_FILE nullification_0000.zkey

# Step 5: Contribute to the ceremony (required for Groth16)
echo ""
echo "[5/7] Contributing to Groth16 ceremony..."
snarkjs zkey contribute nullification_0000.zkey nullification_final.zkey \
  --name="Initial contribution" -v -e="$(head -c 64 /dev/urandom | xxd -p -c 256)"

# Step 6: Export verification key
echo ""
echo "[6/7] Exporting verification key..."
snarkjs zkey export verificationkey nullification_final.zkey verification_key.json

# Step 7: Copy to public directory
echo ""
echo "[7/7] Copying artifacts to public/circuits/..."
mkdir -p ../public/circuits
cp build/nullification_js/nullification.wasm ../public/circuits/
cp nullification_final.zkey ../public/circuits/
cp verification_key.json ../public/circuits/

# Cleanup intermediate file
rm -f nullification_0000.zkey

# Print summary
echo ""
echo "=========================================="
echo "Compilation Complete! (Groth16)"
echo "=========================================="
echo ""
echo "Generated files:"
ls -lh ../public/circuits/
echo ""
echo "Circuit statistics:"
snarkjs r1cs info build/nullification.r1cs
echo ""
echo "You can now use the nullification feature!"
echo "To test, run: snarkjs groth16 prove ..."
