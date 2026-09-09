import React from "react";
import {
  Eye,
  Fingerprint,
  KeyRound,
  Lock,
  ShieldCheck,
  Vote,
} from "lucide-react";

const HowItWorks = () => {
  return (
    <div className="civic-container pb-28 pt-10 md:pb-12">
      <div className="space-y-10">
        <section className="grid gap-6 border-b border-outline-variant pb-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="py-4 md:py-8">
            <div className="max-w-3xl">
              <span className="ledger-badge bg-secondary-container text-on-secondary-container">
                <ShieldCheck className="h-4 w-4" />
                How it works
              </span>
              <h1 className="mt-5 font-headline text-3xl font-bold tracking-[-0.03em] text-primary sm:text-4xl">
                How Votex Works
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-on-surface-variant">
                A public voting system combining World ID uniqueness checks, passkey-derived signing keys, delegation, and a coercion-mitigation nullification workflow.
              </p>
            </div>
          </div>

          <aside className="rounded-xl bg-primary p-6 text-on-primary sm:p-8">
            <ShieldCheck className="h-10 w-10 text-primary-fixed-dim" />
            <h2 className="mt-5 font-headline text-2xl font-bold text-white">
              Cryptographic Integrity
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/74">
              Every election uses public pseudonymous signed ballots, proof-of-personhood, and tally-side nullification processing. Real-world identities are not written to the public ledger, but ballot choices are public.
            </p>
          </aside>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {[
            {
              icon: ShieldCheck,
              title: "1. Verify unique humanity",
              description:
                "World ID proves that one real person is entering the system without exposing their personal identity to the election ledger.",
            },
            {
              icon: KeyRound,
              title: "2. Derive a voting key locally",
              description:
                "A BabyJubJub keypair is derived from the voter’s passkey. The private key never leaves the device and is used only for signing and nullification workflows.",
            },
            {
              icon: Vote,
              title: "3. Cast a signed ballot",
              description:
                "Each public ballot is tied to a World ID-derived pseudonym and local signing key. Observers can audit the choice without learning the voter’s real-world identity from Votex.",
            },
            {
              icon: Lock,
              title: "4. Preserve coercion resistance",
              description:
                "If a voter is pressured or threatened, they can later nullify their ballot using a zero-knowledge workflow that looks identical to a harmless decoy request.",
            },
          ].map(({ icon: Icon, title, description }) => (
            <article key={title} className="civic-card p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-on-primary">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-6 font-headline text-2xl font-bold text-primary">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{description}</p>
            </article>
          ))}
        </section>

        <section>
          <div className="civic-card p-6 sm:p-8">
            <h2 className="font-headline text-3xl font-bold text-primary">Security guarantees</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                {
                  icon: Lock,
                  title: "Encrypted nullification state",
                  description: "Nullification accumulators and delegate selections remain encrypted until the election authority processes the tally. Ballot choices themselves are public.",
                },
                {
                  icon: Eye,
                  title: "Pseudonymous public ballots",
                  description: "The ledger publishes pseudonymous voter identifiers and choices, not real-world identities. Pseudonymous activity may still be linkable.",
                },
                {
                  icon: ShieldCheck,
                  title: "Coercion resistance",
                  description: "Actual and dummy nullifications are intentionally indistinguishable to outside observers.",
                },
                {
                  icon: Fingerprint,
                  title: "One person, one vote",
                  description: "World ID prevents duplicate participation without placing the voter’s real-world identity in the Votex ledger.",
                },
              ].map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-outline-variant/12 bg-surface-container-low p-5">
                  <Icon className="h-5 w-5 text-surface-tint" />
                  <h3 className="mt-4 font-headline text-xl font-bold text-primary">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HowItWorks;
