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
    <div className="px-4 pb-24 pt-10 sm:px-6 md:pb-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="ledger-panel relative overflow-hidden p-8 md:p-12">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-fixed-dim/60 blur-[100px]" />
            <div className="relative z-10 max-w-3xl">
              <span className="ledger-badge bg-secondary-container text-on-secondary-container">
                <ShieldCheck className="h-4 w-4" />
                How it works
              </span>
              <h1 className="mt-5 font-headline text-5xl font-extrabold text-primary">
                How Votex Works
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-on-surface-variant">
                A coercion-resistant voting system that combines World ID uniqueness checks, passkey-derived cryptographic keys, and privacy-preserving nullification.
              </p>
            </div>
          </div>

          <aside className="rounded-[1.5rem] bg-primary-container p-6 text-on-primary shadow-ledger-lg sm:rounded-[2rem] sm:p-8">
            <ShieldCheck className="h-10 w-10 text-primary-fixed-dim" />
            <h2 className="mt-5 font-headline text-2xl font-bold text-white">
              Cryptographic Integrity
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/74">
              Every election uses signed ballots, proof-of-personhood, and tally-side nullification processing to preserve auditability without exposing individual choices.
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
                "Each ballot is tied to a verified voter identity and a local signing key, allowing the system to enforce one-person-one-vote without deanonymizing the voter.",
            },
            {
              icon: Lock,
              title: "4. Preserve coercion resistance",
              description:
                "If a voter is pressured or threatened, they can later nullify their ballot using a zero-knowledge workflow that looks identical to a harmless decoy request.",
            },
          ].map(({ icon: Icon, title, description }) => (
            <article key={title} className="ledger-panel p-7">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-6 font-headline text-2xl font-bold text-primary">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{description}</p>
            </article>
          ))}
        </section>

        <section>
          <div className="ledger-panel p-8">
            <h2 className="font-headline text-3xl font-bold text-primary">Security guarantees</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                {
                  icon: Lock,
                  title: "End-to-end encryption",
                  description: "Nullification payloads remain encrypted until the election authority processes the tally.",
                },
                {
                  icon: Eye,
                  title: "Vote secrecy",
                  description: "The system proves voter eligibility without publishing a direct mapping between a person and a ballot.",
                },
                {
                  icon: ShieldCheck,
                  title: "Coercion resistance",
                  description: "Actual and dummy nullifications are intentionally indistinguishable to outside observers.",
                },
                {
                  icon: Fingerprint,
                  title: "One person, one vote",
                  description: "World ID prevents duplicate voter participation while keeping the ledger anonymous.",
                },
              ].map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-low p-5">
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
