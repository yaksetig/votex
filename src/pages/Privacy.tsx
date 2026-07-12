export default function Privacy() {
  return (
    <div className="px-4 py-10 sm:px-6">
      <section className="ledger-panel mx-auto max-w-4xl p-6 sm:p-10">
        <p className="ledger-eyebrow">Votex disclosure</p>
        <h1 className="mt-3 font-headline text-4xl font-extrabold text-primary">Privacy model</h1>
        <div className="mt-6 space-y-5 text-sm leading-relaxed text-on-surface-variant">
          <p>World ID supplies a pseudonymous proof of unique humanity. Votex does not ask World ID to place your name, email, or government identity in the election ledger.</p>
          <p>Ballots are intentionally public under a pseudonymous voter identifier. Observers can see the selected option, signature, and timestamp. Pseudonymous activity may be linkable across elections, and the receipt is not coercion-resistant.</p>
          <p>Nullification requests use encrypted accumulators and zero-knowledge proofs so outside observers cannot distinguish a real nullification from a decoy. Delegation records reveal that delegation occurred while encrypting the selected delegate for the Election Authority.</p>
          <p>Full ballot secrecy, unlinkable election-specific identities, and authority-blind tallying are future work and are not claims of this pre-production release.</p>
        </div>
      </section>
    </div>
  );
}
