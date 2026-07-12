export default function AuditProtocol() {
  return (
    <div className="px-4 py-10 sm:px-6">
      <section className="ledger-panel mx-auto max-w-4xl p-6 sm:p-10">
        <p className="ledger-eyebrow">Public verification</p>
        <h1 className="mt-3 font-headline text-4xl font-extrabold text-primary">Audit protocol</h1>
        <ol className="mt-8 space-y-5 text-sm leading-relaxed text-on-surface-variant">
          <li><strong className="text-primary">1. Election record:</strong> verify the binary options, authority public key, creator pseudonym, and closing time.</li>
          <li><strong className="text-primary">2. Ballot ledger:</strong> inspect each public receipt, pseudonymous voter, choice, signature payload, signed time, and acceptance time.</li>
          <li><strong className="text-primary">3. Nullification:</strong> inspect submitted proofs and encrypted XOR accumulator transitions; the server verifies proofs before committing state.</li>
          <li><strong className="text-primary">4. Delegation:</strong> inspect public delegation ciphertexts and final authority-resolved vote weights without learning the selected delegate from the public record.</li>
          <li><strong className="text-primary">5. Tally:</strong> compare canonical ballots, final nullification states, delegation weights, and the persisted tally run.</li>
        </ol>
        <p className="mt-8 rounded-[1.25rem] bg-tertiary-fixed/25 p-4 text-sm text-on-surface-variant">The current Groth16 setup limitation remains documented in the repository’s cryptography guide. This pre-production hardening does not replace cryptographic artifacts.</p>
      </section>
    </div>
  );
}
