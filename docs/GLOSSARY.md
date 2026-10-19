# Votex glossary

The words the interface uses, and the words it avoids. Copy in `src/` follows
this list; the e2e specs assert on several of these labels, so a rename is a
code change, not a copy tweak.

| Say | Meaning | Never say |
|---|---|---|
| **passkey** | The WebAuthn credential stored in the voter's device or password manager. | "Votex passkey" is fine as the first mention on sign-in; otherwise just "passkey". |
| **voting key** | The key derived from the passkey in the browser. Signs ballots and nullification requests; never sent to Votex. | signing key, ballot key, keypair, BabyJubJub key, cryptographic identity |
| **unlock** | The action that derives the voting key from the passkey in this tab. | derive, re-derive |
| **ballot** | The published record of a vote: pseudonym, choice, signature, timestamps. | vote (as a noun for the record) |
| **vote** (verb) / **cast** | The act of publishing a ballot. | |
| **pseudonym** | The World ID-derived identifier a voter appears under in every public record. | voter id, nullifier (in UI) |
| **nullify** / **nullification request** | Cancelling a ballot at the tally with an encrypted request. A request is either real or a **decoy**. | invalidate, cancel vote, actual/dummy nullification, Type-0 |
| **decoy** | A nullification request that changes nothing and is indistinguishable from a real one. | dummy |
| **delegate** (verb) / **delegation** | Letting another participant's choice count for your ballot. Only one hop counts. | proxy, transfer voting power |
| **participant** | A voter who registered a voting key for an election (whether or not they voted). | |
| **Election Authority** | The role that runs the tally. **Operator** is the person signed in to the **Election Authority console**. | Operator Entrance, Authority Portal, Votex Authority, Admin Panel, command surface |
| **tally** / **run the tally** | Resolving nullifications and delegation weights after close and publishing the result. | process, decrypt the accumulators (in UI) |
| **public record(s)** | The tables anyone can read for an election. | ledger |
| **running count** / **preliminary result** / **tallied result** / **final result** | Ballots as cast while open; ballots as cast after close before the tally; the published tally. | "final" before a tally exists |
| **open** / **closed** / **closed early** / **tally pending** / **tallied** | Election lifecycle, rendered by `StatusPill`. | active, live, expired, manually closed, done, ready |

Style: sentence case for buttons, headings and labels ("Publish election",
"Run tally"); proper nouns keep their capitals (World ID, Election Authority).
Use the ellipsis character "…" in in-progress labels. Technical terms
(Groth16, EdDSA, ElGamal, accumulator, zero-knowledge proof) belong on the
audit protocol page and in CRYPTOGRAPHY.md, not on voter surfaces.
