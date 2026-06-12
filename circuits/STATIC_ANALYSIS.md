# Circuit Static Analysis Results

Last updated: 2026-05-19

## Default Command

```bash
npm run analyze:circuits
```

This command runs `circomspect` at its default reporting level, `WARNING`.

## Circomspect Warning-Level Results

### `nullification_xor.circom`

```text
circomspect: analyzing template 'NullificationXOR'
circomspect: No issues found.
```

### `nullification.circom`

```text
circomspect: analyzing template 'Nullification'
circomspect: No issues found.
```

### Interpretation

This means `circomspect` found no warning- or error-level findings in either checked-in Votex circuit. It does not mean the circuits have been formally proven correct.

## Circomspect Info-Level Notes

Running `circomspect -l INFO -v` produces informational notes. These are not emitted by the default `WARNING` gate, but they are useful context.

### `nullification_xor.circom`

`circomspect -l INFO -v circuits/nullification_xor.circom` reports 18 informational findings:

| ID | Lines | Meaning |
|----|-------|---------|
| `CS0004` | 65, 79, 84, 85, 100, 110, 118, 120, 142, 146, 151, 162, 170 | Field-element arithmetic could overflow or wrap modulo the field. |
| `CS0003` | 79, 100, 110, 162, 170 | Field-element comparisons greater than `p/2` may produce unexpected results. These are the `for (var i = 0; i < 254; i++)` loop bounds. |

### `nullification.circom`

`circomspect -l INFO -v circuits/nullification.circom` reports 11 informational findings:

| ID | Lines | Meaning |
|----|-------|---------|
| `CS0004` | 43, 61, 69, 70, 88, 101, 115 | Field-element arithmetic could overflow or wrap modulo the field. |
| `CS0003` | 61, 88, 101, 115 | Field-element comparisons greater than `p/2` may produce unexpected results. These are the `for (var i = 0; i < 254; i++)` loop bounds. |

### Interpretation

These `INFO` notes are expected for Circom circuits that intentionally use field arithmetic. They are still worth documenting because they show the gap between a static lint pass and a proof of the intended cryptographic relation.

## Circom Compiler Inspect Results

The local run also used `circom --inspect` because the Circom compiler was installed.

### `nullification_xor.circom`

```text
template instances: 22
warning[CA02]: In template "CompConstant(21888242871839275222246405745257275088548364400416034343698204186575808495616)": Array of subcomponent input/output signals num2bits.out contains a total of 134 signals that do not appear in any constraint of the father component
  = For example: num2bits.out[0], num2bits.out[100].

warning[CA02]: In template "EscalarMulFix(254,[5299619240641551281634865583518297030282874472190772894086521144482721001553,16950150798460657717958625567821834550301663161624707787222815936182638968203])": Array of subcomponent input/output signals segments[1].dbl contains a total of 2 signals that do not appear in any constraint of the father component
  = For example: segments[1].dbl[0], segments[1].dbl[1].

warning[CA02]: In template "EscalarMulAny(254)": Array of subcomponent input/output signals segments[1].dbl contains a total of 2 signals that do not appear in any constraint of the father component
  = For example: segments[1].dbl[0], segments[1].dbl[1].

Everything went okay
```

### `nullification.circom`

```text
template instances: 22
warning[CA02]: In template "CompConstant(21888242871839275222246405745257275088548364400416034343698204186575808495616)": Array of subcomponent input/output signals num2bits.out contains a total of 134 signals that do not appear in any constraint of the father component
  = For example: num2bits.out[0], num2bits.out[100].

warning[CA02]: In template "EscalarMulFix(254,[5299619240641551281634865583518297030282874472190772894086521144482721001553,16950150798460657717958625567821834550301663161624707787222815936182638968203])": Array of subcomponent input/output signals segments[1].dbl contains a total of 2 signals that do not appear in any constraint of the father component
  = For example: segments[1].dbl[0], segments[1].dbl[1].

warning[CA02]: In template "EscalarMulAny(254)": Array of subcomponent input/output signals segments[1].dbl contains a total of 2 signals that do not appear in any constraint of the father component
  = For example: segments[1].dbl[0], segments[1].dbl[1].

Everything went okay
```

## Interpretation

`circomspect` found no warning- or error-level issues in either Votex-owned circuit. The `circom --inspect` warnings are from imported `circomlib` templates, not from `NullificationXOR` or `Nullification`.
