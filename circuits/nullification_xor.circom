pragma circom 2.1.6;

include "node_modules/circomlib/circuits/babyjub.circom";
include "node_modules/circomlib/circuits/escalarmulany.circom";
include "node_modules/circomlib/circuits/escalarmulfix.circom";
include "node_modules/circomlib/circuits/bitify.circom";

/**
 * XOR-Based Nullification Circuit
 *
 * Proves correct computation of a single XOR-gate step on an encrypted
 * accumulator, without revealing the voter's nullification bit x.
 *
 * Protocol:
 *   x' = 2x - 1                   maps {0,1} -> {-1,1}
 *   [[x'y]] = (sG + x'*acc_c1, sH + x'*acc_c2)   conditional gate
 *   new_acc = [[x]] - [[x'y]]     XOR accumulator update (done publicly)
 *
 * Since x' in {-1,1}, the operation x'*P on an Edwards curve point P=(px,py)
 * is simply conditional negation: (x'*px, py), because -P = (-px, py).
 *
 * Public inputs:
 *   ciphertext[4]  - fresh ElGamal encryption [[x]] = (rG, xG + rH)
 *   gate_output[4] - conditional gate [[x'y]] = (sG + x'*acc_c1, sH + x'*acc_c2)
 *   accumulator[4] - current XOR accumulator [[y]] = (acc_c1, acc_c2)
 *   pk_voter[2]    - voter's BabyJubJub public key
 *   pk_authority[2] - election authority's public key H
 *
 * Private inputs:
 *   x         - nullification bit (0 = dummy, 1 = actual)
 *   r         - randomness for fresh encryption
 *   s         - randomness for gate computation
 *   sk_voter  - voter's private key
 *
 * Constraints:
 *   1. x is binary
 *   2. If x=1: pk_voter = sk_voter * G (ownership proof)
 *   3. ciphertext = Enc(x; r) under pk_authority
 *   4. gate_output is correctly computed from accumulator with x' and s
 *
 * The new accumulator = ciphertext - gate_output is verified publicly.
 *
 * BabyJubJub base point G:
 *   Gx = 5299619240641551281634865583518297030282874472190772894086521144482721001553
 *   Gy = 16950150798460657717958625567821834550301663161624707787222815936182638968203
 */

template NullificationXOR() {
    // Public inputs
    signal input ciphertext[4];     // Fresh [[x]]: [c1.x, c1.y, c2.x, c2.y]
    signal input gate_output[4];    // [[x'y]]: [g1.x, g1.y, g2.x, g2.y]
    signal input accumulator[4];    // Current [[y]]: [a1.x, a1.y, a2.x, a2.y]
    signal input pk_voter[2];       // Voter's public key [x, y]
    signal input pk_authority[2];   // Authority's public key H [x, y]

    // Private inputs
    signal input x;                 // Nullification bit: 0 or 1
    signal input r;                 // Randomness for fresh encryption
    signal input s;                 // Randomness for gate computation
    signal input sk_voter;          // Voter's private key

    // ================================================
    // Constraint 1: x is binary (0 or 1)
    // ================================================
    x * (x - 1) === 0;

    // ================================================
    // Constraint 2: Conditional keypair verification
    // If x=1: pk_voter = sk_voter * G must hold
    // If x=0: no verification needed (dummy)
    // ================================================
    component sk_bits = Num2Bits_strict();
    sk_bits.in <== sk_voter;

    component pk_from_sk = EscalarMulFix(254, [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ]);
    for (var i = 0; i < 254; i++) {
        pk_from_sk.e[i] <== sk_bits.out[i];
    }

    // m * (computed - declared) === 0
    x * (pk_from_sk.out[0] - pk_voter[0]) === 0;
    x * (pk_from_sk.out[1] - pk_voter[1]) === 0;

    // ================================================
    // Constraint 3: Fresh encryption verification
    // c1 = r * G
    // c2 = x * G + r * H
    // ================================================
    component r_bits = Num2Bits_strict();
    r_bits.in <== r;

    // c1 = r * G (fixed-base)
    component c1_compute = EscalarMulFix(254, [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ]);
    for (var i = 0; i < 254; i++) {
        c1_compute.e[i] <== r_bits.out[i];
    }
    c1_compute.out[0] === ciphertext[0];
    c1_compute.out[1] === ciphertext[1];

    // r * H (any-base, since H = pk_authority is variable)
    component r_h = EscalarMulAny(254);
    r_h.p[0] <== pk_authority[0];
    r_h.p[1] <== pk_authority[1];
    for (var i = 0; i < 254; i++) {
        r_h.e[i] <== r_bits.out[i];
    }

    // Optimized x * G: since x in {0,1}, avoid 254-bit scalar mult.
    // 0*G = (0, 1) = identity;  1*G = (Gx, Gy)
    // x*G = (x * Gx, 1 + x * (Gy - 1))
    signal x_G_x;
    x_G_x <== x * 5299619240641551281634865583518297030282874472190772894086521144482721001553;
    signal x_G_y;
    x_G_y <== x * (16950150798460657717958625567821834550301663161624707787222815936182638968203 - 1) + 1;

    // c2 = x*G + r*H
    component c2_add = BabyAdd();
    c2_add.x1 <== x_G_x;
    c2_add.y1 <== x_G_y;
    c2_add.x2 <== r_h.out[0];
    c2_add.y2 <== r_h.out[1];

    c2_add.xout === ciphertext[2];
    c2_add.yout === ciphertext[3];

    // ================================================
    // Constraint 4: Gate output verification
    // x' = 2x - 1   (maps {0,1} -> {-1,1})
    // Conditional negation: x' * (px, py) = (x'*px, py)
    //   because in Edwards curves: -(px, py) = (-px, py)
    //
    // gate_c1 = s*G + (x'*acc_c1.x, acc_c1.y)
    // gate_c2 = s*H + (x'*acc_c2.x, acc_c2.y)
    // ================================================
    signal x_prime;
    x_prime <== 2 * x - 1;

    // Conditional negation of accumulator c1
    signal cond_acc_c1_x;
    cond_acc_c1_x <== x_prime * accumulator[0];
    // cond_acc_c1 = (cond_acc_c1_x, accumulator[1])

    // Conditional negation of accumulator c2
    signal cond_acc_c2_x;
    cond_acc_c2_x <== x_prime * accumulator[2];
    // cond_acc_c2 = (cond_acc_c2_x, accumulator[3])

    // s * G (fixed-base)
    component s_bits = Num2Bits_strict();
    s_bits.in <== s;

    component s_g = EscalarMulFix(254, [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ]);
    for (var i = 0; i < 254; i++) {
        s_g.e[i] <== s_bits.out[i];
    }

    // s * H (any-base)
    component s_h = EscalarMulAny(254);
    s_h.p[0] <== pk_authority[0];
    s_h.p[1] <== pk_authority[1];
    for (var i = 0; i < 254; i++) {
        s_h.e[i] <== s_bits.out[i];
    }

    // gate_c1 = s*G + cond_acc_c1
    component gate_c1_add = BabyAdd();
    gate_c1_add.x1 <== s_g.out[0];
    gate_c1_add.y1 <== s_g.out[1];
    gate_c1_add.x2 <== cond_acc_c1_x;
    gate_c1_add.y2 <== accumulator[1];

    gate_c1_add.xout === gate_output[0];
    gate_c1_add.yout === gate_output[1];

    // gate_c2 = s*H + cond_acc_c2
    component gate_c2_add = BabyAdd();
    gate_c2_add.x1 <== s_h.out[0];
    gate_c2_add.y1 <== s_h.out[1];
    gate_c2_add.x2 <== cond_acc_c2_x;
    gate_c2_add.y2 <== accumulator[3];

    gate_c2_add.xout === gate_output[2];
    gate_c2_add.yout === gate_output[3];
}

component main {public [ciphertext, gate_output, accumulator, pk_voter, pk_authority]} = NullificationXOR();
