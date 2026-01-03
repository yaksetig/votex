pragma circom 2.1.6;

include "node_modules/circomlib/circuits/babyjub.circom";
include "node_modules/circomlib/circuits/escalarmulany.circom";
include "node_modules/circomlib/circuits/escalarmulfix.circom";
include "node_modules/circomlib/circuits/bitify.circom";
include "node_modules/circomlib/circuits/comparators.circom";

/**
 * Nullification Circuit for Anonymous Vote Revocation
 * 
 * This circuit proves that a voter correctly created an ElGamal encryption
 * of their nullification message (0 for dummy, 1 for actual nullification)
 * without revealing whether it's a real or dummy nullification.
 * 
 * The circuit verifies:
 * 1. The message m is binary (0 or 1)
 * 2. IF m=1: The voter's public key matches their private key: pk_voter = sk_voter * G
 *    IF m=0: No keypair verification required (dummy nullification)
 * 3. The ciphertext is a valid ElGamal encryption: 
 *    - C1 = r * G (ephemeral public key)
 *    - C2 = m * G + r * pk_authority (encrypted message)
 * 
 * BabyJubJub Parameters:
 * - Base point G is the standard generator
 * - Curve order: 21888242871839275222246405745257275088614511777268538073601725287587578984328
 */

template Nullification() {
    // Public inputs
    signal input ciphertext[4];     // [c1.x, c1.y, c2.x, c2.y]
    signal input pk_voter[2];       // Voter's public key [x, y]
    signal input pk_authority[2];   // Election authority's public key [x, y]
    
    // Private inputs
    signal input r;                 // Deterministic randomness
    signal input m;                 // Message: 0 (dummy) or 1 (actual nullification)
    signal input sk_voter;          // Voter's private key
    
    // ============================================
    // Constraint 1: Verify m is binary (0 or 1)
    // ============================================
    m * (m - 1) === 0;
    
    // ============================================
    // Constraint 2: Conditionally verify voter's keypair
    // IF m=1: pk_voter = sk_voter * G must hold
    // IF m=0: no verification needed (dummy nullification)
    // ============================================
    
    // Convert sk_voter to bits for scalar multiplication
    component sk_bits = Num2Bits(254);
    sk_bits.in <== sk_voter;
    
    // Compute sk_voter * G using fixed-base scalar multiplication
    component pk_from_sk = EscalarMulFix(254, [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ]);
    
    for (var i = 0; i < 254; i++) {
        pk_from_sk.e[i] <== sk_bits.out[i];
    }
    
    // Conditional verification: only enforce when m=1
    // m * (pk_from_sk - pk_voter) === 0
    // When m=0: 0 * (anything) = 0 ✓ (passes without checking)
    // When m=1: 1 * (pk_from_sk - pk_voter) = 0, so they must be equal ✓
    m * (pk_from_sk.out[0] - pk_voter[0]) === 0;
    m * (pk_from_sk.out[1] - pk_voter[1]) === 0;
    
    // ============================================
    // Constraint 3: Verify ElGamal encryption
    // C1 = r * G
    // C2 = m * G + r * pk_authority
    // ============================================
    
    // Convert r to bits
    component r_bits = Num2Bits(254);
    r_bits.in <== r;
    
    // Compute C1 = r * G
    component c1_compute = EscalarMulFix(254, [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ]);
    
    for (var i = 0; i < 254; i++) {
        c1_compute.e[i] <== r_bits.out[i];
    }
    
    // Verify C1 matches ciphertext
    c1_compute.out[0] === ciphertext[0];
    c1_compute.out[1] === ciphertext[1];
    
    // Compute r * pk_authority using any-base scalar multiplication
    component r_pk_auth = EscalarMulAny(254);
    r_pk_auth.p[0] <== pk_authority[0];
    r_pk_auth.p[1] <== pk_authority[1];
    
    for (var i = 0; i < 254; i++) {
        r_pk_auth.e[i] <== r_bits.out[i];
    }
    
    // Convert m to bits for scalar multiplication
    component m_bits = Num2Bits(254);
    m_bits.in <== m;
    
    // Compute m * G (message encoding)
    component m_g = EscalarMulFix(254, [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ]);
    
    for (var i = 0; i < 254; i++) {
        m_g.e[i] <== m_bits.out[i];
    }
    
    // Compute C2 = m * G + r * pk_authority
    component c2_add = BabyAdd();
    c2_add.x1 <== m_g.out[0];
    c2_add.y1 <== m_g.out[1];
    c2_add.x2 <== r_pk_auth.out[0];
    c2_add.y2 <== r_pk_auth.out[1];
    
    // Verify C2 matches ciphertext
    c2_add.xout === ciphertext[2];
    c2_add.yout === ciphertext[3];
}

component main {public [ciphertext, pk_voter, pk_authority]} = Nullification();
