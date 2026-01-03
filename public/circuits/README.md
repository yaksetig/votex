# Nullification Circuit Compilation Guide

This guide walks you through compiling the Circom circuit and generating the **Groth16** proving artifacts.

## Why Groth16?

Groth16 offers significantly faster proof generation compared to PLONK:
- **3-10x faster** proof generation in the browser
- **Smaller proof size** (~200 bytes vs ~1KB)
- **Faster verification** - ideal for on-chain verification

The trade-off is that Groth16 requires a circuit-specific trusted setup (contribution step), while PLONK uses a universal setup.

## Prerequisites

### 1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source ~/.cargo/env
```

### 2. Install Circom
```bash
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
```

### 3. Install snarkjs
```bash
npm install -g snarkjs
```

### 4. Install circomlib (for BabyJubJub components)
```bash
cd circuits
npm init -y
npm install circomlib
```

## Compilation Steps

### Step 1: Compile the Circuit
```bash
mkdir -p build
circom nullification.circom --r1cs --wasm --sym -o build
```

This creates:
- `build/nullification.r1cs` - Constraint system
- `build/nullification_js/nullification.wasm` - WebAssembly witness generator
- `build/nullification.sym` - Symbol file for debugging

### Step 2: Download Powers of Tau
For circuits up to 2^16 constraints:
```bash
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau -O pot16_final.ptau
```

For larger circuits (2^20):
```bash
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau -O pot20_final.ptau
```

### Step 3: Generate Groth16 Proving Key (Phase 2 Setup)
```bash
# Initial setup
snarkjs groth16 setup build/nullification.r1cs pot16_final.ptau nullification_0000.zkey

# Contribute to the ceremony (required for Groth16 security)
snarkjs zkey contribute nullification_0000.zkey nullification_final.zkey \
  --name="Initial contribution" -v -e="some random entropy text"
```

**Note**: The contribution step is required for Groth16. You can add more contributions for stronger security, or use a multi-party ceremony for production.

### Step 4: Export Verification Key
```bash
snarkjs zkey export verificationkey nullification_final.zkey verification_key.json
```

### Step 5: Copy to Public Directory (Local Development)
```bash
cp build/nullification_js/nullification.wasm ../public/circuits/
cp nullification_final.zkey ../public/circuits/
cp verification_key.json ../public/circuits/

# Clean up intermediate file
rm nullification_0000.zkey
```

## Production Deployment: Supabase Storage

For production, host the large circuit files in Supabase Storage to avoid GitHub file size limits.

### Step 1: Upload Files to Supabase Storage

1. Go to [Supabase Dashboard → Storage](https://supabase.com/dashboard/project/uficgolgcwvgxqlubpso/storage/buckets)
2. Find the `circuits` bucket (already created)
3. Upload these files:
   - `nullification.wasm` (~2-5 MB)
   - `nullification_final.zkey` (~20-50 MB for Groth16, smaller than PLONK)
   - `verification_key.json` (~2 KB)

### Step 2: Configure Environment Variable

The app is already configured to use Supabase Storage. The environment variable is set in `.env`:

```
VITE_CIRCUIT_FILES_URL=https://uficgolgcwvgxqlubpso.supabase.co/storage/v1/object/public/circuits
```

If not set, the app falls back to local `/circuits/` path (for development with dev mode).

### Step 3: Verify Files Are Accessible

Test the URLs in your browser:
- `https://uficgolgcwvgxqlubpso.supabase.co/storage/v1/object/public/circuits/nullification.wasm`
- `https://uficgolgcwvgxqlubpso.supabase.co/storage/v1/object/public/circuits/verification_key.json`

## Quick Start (Automated)

Run the compile script:
```bash
cd circuits
chmod +x compile.sh
./compile.sh
```

## File Sizes (Approximate)

| File | Size |
|------|------|
| `nullification.wasm` | ~2-5 MB |
| `nullification_final.zkey` | ~20-50 MB (Groth16 is smaller than PLONK) |
| `verification_key.json` | ~1-2 KB |

**Note**: The `.zkey` file may exceed GitHub's 100MB limit depending on circuit complexity. Use Supabase Storage for production.

## Development Mode

For testing without compiled circuits, enable dev mode in the browser console:
```javascript
localStorage.setItem('DEV_SKIP_ZK_PROOFS', 'true');
```

This returns mock proofs that pass local validation but won't verify on-chain.

## Troubleshooting

### "circom: command not found"
Ensure Circom is in your PATH:
```bash
export PATH="$PATH:$HOME/.cargo/bin"
```

### "Error: File not found circomlib/..."
Install circomlib in the circuits directory:
```bash
cd circuits && npm install circomlib
```

### Circuit constraint count too high
Use a larger Powers of Tau file (pot20 instead of pot16).

### Memory errors during setup
Increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=8192" snarkjs groth16 setup ...
```

### Contribution step fails
Ensure you have enough entropy. Try with explicit random text:
```bash
snarkjs zkey contribute nullification_0000.zkey nullification_final.zkey \
  --name="My contribution" -v -e="type some random text here for entropy"
```

## Groth16 vs PLONK Comparison

| Aspect | Groth16 | PLONK |
|--------|---------|-------|
| Proof Generation | ~1-5 seconds | ~5-30 seconds |
| Proof Size | ~200 bytes | ~1 KB |
| Verification Speed | Fastest | Slower |
| Trusted Setup | Circuit-specific | Universal |
| zkey File Size | Smaller | Larger |

## Circuit Details

### Public Inputs (8 signals)
1. `ciphertext[0]` - c1.x (ElGamal C1 point x-coordinate)
2. `ciphertext[1]` - c1.y (ElGamal C1 point y-coordinate)
3. `ciphertext[2]` - c2.x (ElGamal C2 point x-coordinate)
4. `ciphertext[3]` - c2.y (ElGamal C2 point y-coordinate)
5. `pk_voter[0]` - Voter public key x
6. `pk_voter[1]` - Voter public key y
7. `pk_authority[0]` - Authority public key x
8. `pk_authority[1]` - Authority public key y

### Private Inputs (3 signals)
1. `r` - Deterministic randomness for encryption
2. `m` - Message (0 for dummy, 1 for real nullification)
3. `sk_voter` - Voter's private key

### Constraints
1. Verifies `m` is binary (0 or 1)
2. Verifies `pk_voter = sk_voter * G` (BabyJubJub scalar multiplication)
3. Verifies `ciphertext = ElGamal_Encrypt(pk_authority, m, r)`
