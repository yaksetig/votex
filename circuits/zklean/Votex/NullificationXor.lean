import Mathlib.Tactic.Ring
import zkLean

/-!
# Votex XOR Nullification Model

This file models the active Circom circuit:

* `circuits/nullification_xor.circom`

The model has two layers:

1. A protocol-level specification over field values.
2. A zkLean `ZKBuilder` encoding of the Votex-owned constraints.

The scalar-multiplication gadgets from `circomlib` are represented as explicit
helper outputs. This keeps the first proof target focused: any satisfying
witness for the top-level Votex composition should imply the intended public
nullification relation, assuming the scalar-multiplication helpers are correct.

`BabyAdd` is small enough to model directly, so its algebraic constraints are
included here.
-/

namespace Votex
namespace NullificationXor

open ZKBuilder

/-! ## Protocol-level data model -/

/-- A BabyJubJub affine point represented by its two field coordinates. -/
structure Point (f : Type) where
  x : f
  y : f
deriving Repr

namespace Point

variable {f : Type}

/-- Two points are equal when both coordinates are equal. -/
@[ext]
theorem ext {p q : Point f} (hx : p.x = q.x) (hy : p.y = q.y) : p = q := by
  cases p
  cases q
  simp at hx hy
  subst hx
  subst hy
  rfl

/-- Coordinate-wise equality is often what the circuit enforces. -/
@[simp]
theorem eq_iff {p q : Point f} : p = q ↔ p.x = q.x ∧ p.y = q.y := by
  constructor
  · intro h
    cases h
    exact ⟨rfl, rfl⟩
  · intro h
    rcases h with ⟨hx, hy⟩
    cases p
    cases q
    simp at hx hy
    subst hx
    subst hy
    rfl

end Point

/-- An ElGamal ciphertext represented by two curve points. -/
structure Ciphertext (f : Type) where
  c1 : Point f
  c2 : Point f
deriving Repr

/-- The XOR gate output has the same point-pair shape as a ciphertext. -/
abbrev GateOutput (f : Type) := Ciphertext f

/-- The encrypted running accumulator also has the ciphertext shape. -/
abbrev Accumulator (f : Type) := Ciphertext f

/-- Public inputs in the active `NullificationXOR` Circom template. -/
structure PublicInputs (f : Type) where
  ciphertext : Ciphertext f
  gateOutput : GateOutput f
  accumulator : Accumulator f
  pkVoter : Point f
  pkAuthority : Point f
deriving Repr

/-- Private inputs in the active `NullificationXOR` Circom template. -/
structure PrivateInputs (f : Type) where
  x : f
  r : f
  s : f
  skVoter : f
deriving Repr

/--
Abstract curve operations used by the protocol specification.

The first zkLean target does not prove the internals of scalar multiplication.
Instead, it states the Votex protocol relation in terms of these operations and
then models the top-level circuit constraints that compose their outputs.
-/
structure CurveOps (f : Type) where
  basePoint : Point f
  pointAdd : Point f → Point f → Point f
  scalarMul : f → Point f → Point f

/-- The Circom booleanity constraint for a field element. -/
def IsBinary [Field f] (x : f) : Prop :=
  x * (x - 1) = 0

/-- The XOR sign used by the circuit: `0 ↦ -1`, `1 ↦ 1`. -/
def xorSign [Field f] (x : f) : f :=
  2 * x - 1

/--
Select the identity point or base point using a boolean field element.

This mirrors the optimized Circom encoding:

```circom
x_G_x <== x * Gx;
x_G_y <== x * (Gy - 1) + 1;
```
-/
def selectIdentityOrBase [Field f] (basePoint : Point f) (x : f) : Point f :=
  { x := x * basePoint.x
    y := x * (basePoint.y - 1) + 1 }

/--
Conditional Edwards negation used by the XOR gate.

For BabyJubJub, `-(px, py) = (-px, py)`. When `sigma` is `-1` or `1`, this is
the exact operation used in `nullification_xor.circom`.
-/
def conditionalNegation [Field f] (sigma : f) (p : Point f) : Point f :=
  { x := sigma * p.x
    y := p.y }

/-- Coordinate-level relation implemented by `circomlib`'s `BabyAdd`. -/
def BabyAddRelation [Field f] (a d : f) (p q out : Point f) : Prop :=
  let beta := p.x * q.y
  let gamma := p.y * q.x
  let delta := ((-a) * p.x + p.y) * (q.x + q.y)
  let tau := beta * gamma
  (1 + d * tau) * out.x = beta + gamma ∧
  (1 - d * tau) * out.y = delta + a * beta - gamma

/--
Protocol-level statement for the active XOR nullification circuit.

This is the intended cryptographic relation, stated independently of any
specific Circom or zkLean encoding.
-/
def Relation [Field f] (ops : CurveOps f)
    (pub : PublicInputs f) (priv : PrivateInputs f) : Prop :=
  IsBinary priv.x ∧
  (priv.x = 1 → pub.pkVoter = ops.scalarMul priv.skVoter ops.basePoint) ∧
  pub.ciphertext.c1 = ops.scalarMul priv.r ops.basePoint ∧
  pub.ciphertext.c2 =
    ops.pointAdd
      (selectIdentityOrBase ops.basePoint priv.x)
      (ops.scalarMul priv.r pub.pkAuthority) ∧
  pub.gateOutput.c1 =
    ops.pointAdd
      (ops.scalarMul priv.s ops.basePoint)
      (conditionalNegation (xorSign priv.x) pub.accumulator.c1) ∧
  pub.gateOutput.c2 =
    ops.pointAdd
      (ops.scalarMul priv.s pub.pkAuthority)
      (conditionalNegation (xorSign priv.x) pub.accumulator.c2)

/-! ## Small algebra facts used by the protocol proof layer -/

theorem binary_cases [Field f] {x : f} (h : IsBinary x) : x = 0 ∨ x = 1 := by
  unfold IsBinary at h
  rcases mul_eq_zero.mp h with hx | hxMinusOne
  · exact Or.inl hx
  · exact Or.inr (sub_eq_zero.mp hxMinusOne)

theorem conditional_eq_when_enabled [Field f] {x a b : f}
    (hx : x = 1) (h : x * (a - b) = 0) : a = b := by
  subst x
  have hdiff : a - b = 0 := by simpa using h
  exact sub_eq_zero.mp hdiff

theorem conditional_eq_disabled [Field f] (a b : f) :
    (0 : f) * (a - b) = 0 := by
  simp

@[simp]
theorem xorSign_zero [Field f] : xorSign (0 : f) = -1 := by
  unfold xorSign
  ring

@[simp]
theorem xorSign_one [Field f] : xorSign (1 : f) = 1 := by
  unfold xorSign
  ring

@[simp]
theorem selectIdentityOrBase_zero [Field f] (basePoint : Point f) :
    selectIdentityOrBase basePoint 0 = { x := 0, y := 1 } := by
  ext <;> simp [selectIdentityOrBase]

@[simp]
theorem selectIdentityOrBase_one [Field f] (basePoint : Point f) :
    selectIdentityOrBase basePoint 1 = basePoint := by
  ext <;> simp [selectIdentityOrBase]

@[simp]
theorem conditionalNegation_zero_bit [Field f] (p : Point f) :
    conditionalNegation (xorSign (0 : f)) p = { x := -p.x, y := p.y } := by
  ext <;> simp [conditionalNegation]

@[simp]
theorem conditionalNegation_one_bit [Field f] (p : Point f) :
    conditionalNegation (xorSign (1 : f)) p = p := by
  ext <;> simp [conditionalNegation]

/-! ## zkLean circuit model -/

namespace Circuit

/-- A point whose coordinates are zkLean expressions. -/
structure PointExpr (f : Type) where
  x : ZKExpr f
  y : ZKExpr f

/-- A ciphertext-shaped pair of zkLean point expressions. -/
structure CiphertextExpr (f : Type) where
  c1 : PointExpr f
  c2 : PointExpr f

abbrev GateOutputExpr (f : Type) := CiphertextExpr f
abbrev AccumulatorExpr (f : Type) := CiphertextExpr f

/-- Public inputs represented as zkLean expressions. -/
structure PublicInputsExpr (f : Type) where
  ciphertext : CiphertextExpr f
  gateOutput : GateOutputExpr f
  accumulator : AccumulatorExpr f
  pkVoter : PointExpr f
  pkAuthority : PointExpr f

/-- Private witness values represented as zkLean expressions. -/
structure PrivateInputsExpr (f : Type) where
  x : ZKExpr f
  r : ZKExpr f
  s : ZKExpr f
  skVoter : ZKExpr f

/--
Outputs supplied by scalar-multiplication gadgets.

These correspond to the `circomlib` components in the Circom implementation:

* `pkFromSk = sk_voter * G`
* `rG = r * G`
* `rH = r * pk_authority`
* `sG = s * G`
* `sH = s * pk_authority`

The first zkLean model treats these as helper outputs. A later refinement can
replace them with full zkLean models of `EscalarMulFix` and `EscalarMulAny`.
-/
structure ScalarMulOutputsExpr (f : Type) where
  pkFromSk : PointExpr f
  rG : PointExpr f
  rH : PointExpr f
  sG : PointExpr f
  sH : PointExpr f

instance : Witnessable f (PointExpr f) where
  witness := do
    let x : ZKExpr f ← Witnessable.witness
    let y : ZKExpr f ← Witnessable.witness
    pure { x, y }

instance : Witnessable f (CiphertextExpr f) where
  witness := do
    let c1 : PointExpr f ← Witnessable.witness
    let c2 : PointExpr f ← Witnessable.witness
    pure { c1, c2 }

instance : Witnessable f (PrivateInputsExpr f) where
  witness := do
    let x : ZKExpr f ← Witnessable.witness
    let r : ZKExpr f ← Witnessable.witness
    let s : ZKExpr f ← Witnessable.witness
    let skVoter : ZKExpr f ← Witnessable.witness
    pure { x, r, s, skVoter }

instance : Witnessable f (ScalarMulOutputsExpr f) where
  witness := do
    let pkFromSk : PointExpr f ← Witnessable.witness
    let rG : PointExpr f ← Witnessable.witness
    let rH : PointExpr f ← Witnessable.witness
    let sG : PointExpr f ← Witnessable.witness
    let sH : PointExpr f ← Witnessable.witness
    pure { pkFromSk, rG, rH, sG, sH }

def babyJubjubA [ZKField f] : ZKExpr f :=
  168700

def babyJubjubD [ZKField f] : ZKExpr f :=
  168696

def constrainPointEq [ZKField f] (lhs rhs : PointExpr f) : ZKBuilder f PUnit := do
  ZKBuilder.constrainEq lhs.x rhs.x
  ZKBuilder.constrainEq lhs.y rhs.y

def constrainBoolean [ZKField f] (x : ZKExpr f) : ZKBuilder f PUnit := do
  ZKBuilder.constrainR1CS x (x - 1) 0

def selectIdentityOrBaseExpr [ZKField f]
    (basePoint : PointExpr f) (x : ZKExpr f) : PointExpr f :=
  { x := x * basePoint.x
    y := x * (basePoint.y - 1) + 1 }

def xorSignExpr [ZKField f] (x : ZKExpr f) : ZKExpr f :=
  2 * x - 1

def conditionalNegationExpr [ZKField f]
    (sigma : ZKExpr f) (p : PointExpr f) : PointExpr f :=
  { x := sigma * p.x
    y := p.y }

/--
zkLean encoding of `circomlib`'s `BabyAdd` constraints.

This mirrors `node_modules/circomlib/circuits/babyjub.circom`:

```circom
beta  <== x1*y2;
gamma <== y1*x2;
delta <== (-a*x1+y1)*(x2 + y2);
tau   <== beta * gamma;

(1 + d*tau) * xout === beta + gamma;
(1 - d*tau) * yout === delta + a*beta - gamma;
```
-/
def constrainBabyAdd [ZKField f]
    (p q out : PointExpr f) : ZKBuilder f PUnit := do
  let a := babyJubjubA (f := f)
  let d := babyJubjubD (f := f)
  let beta := p.x * q.y
  let gamma := p.y * q.x
  let delta := ((-a) * p.x + p.y) * (q.x + q.y)
  let tau := beta * gamma
  ZKBuilder.constrainEq ((1 + d * tau) * out.x) (beta + gamma)
  ZKBuilder.constrainEq ((1 - d * tau) * out.y) (delta + a * beta - gamma)

/--
Top-level zkLean model for `NullificationXOR`.

The public expression values correspond to the Circom public inputs. Private
inputs and scalar-multiplication helper outputs are allocated as witnesses by
the caller and supplied to this function.
-/
def nullificationXor [ZKField f]
    (basePoint : PointExpr f)
    (pub : PublicInputsExpr f)
    (priv : PrivateInputsExpr f)
    (smul : ScalarMulOutputsExpr f) : ZKBuilder f PUnit := do
  constrainBoolean priv.x

  -- Conditional ownership proof:
  -- x * (sk_voter * G - pk_voter) = 0.
  ZKBuilder.constrainEq (priv.x * (smul.pkFromSk.x - pub.pkVoter.x)) 0
  ZKBuilder.constrainEq (priv.x * (smul.pkFromSk.y - pub.pkVoter.y)) 0

  -- Fresh ciphertext C1 = r * G.
  constrainPointEq smul.rG pub.ciphertext.c1

  -- Fresh ciphertext C2 = x * G + r * H.
  let xG := selectIdentityOrBaseExpr basePoint priv.x
  constrainBabyAdd xG smul.rH pub.ciphertext.c2

  -- Gate output uses x' = 2x - 1 and conditional Edwards negation.
  let sigma := xorSignExpr priv.x
  let condAccC1 := conditionalNegationExpr sigma pub.accumulator.c1
  let condAccC2 := conditionalNegationExpr sigma pub.accumulator.c2

  -- gate_c1 = s * G + x' * accumulator.c1.
  constrainBabyAdd smul.sG condAccC1 pub.gateOutput.c1

  -- gate_c2 = s * H + x' * accumulator.c2.
  constrainBabyAdd smul.sH condAccC2 pub.gateOutput.c2

end Circuit

end NullificationXor
end Votex
