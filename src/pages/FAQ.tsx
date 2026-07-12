import React from "react";
import { CircleHelp } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "Can I change my vote?",
    answer:
      "You cannot directly overwrite a ballot. If coercion, compromise, or regret becomes relevant, the system supports a later nullification flow so the invalidated vote is excluded during tally processing.",
  },
  {
    question: "Who can see my vote?",
    answer:
      "Ballots are public under a World ID-derived pseudonym: observers can see that pseudonymous voter X selected option Y, but the ledger does not contain that voter’s real-world identity. Reuse of a pseudonym may make activity linkable across elections. Full ballot secrecy is future work.",
  },
  {
    question: "Why do I need a passkey?",
    answer:
      "The passkey is used to derive your local cryptographic identity for ballot signing and recovery workflows. The private signing material stays on your device.",
  },
  {
    question: "Can someone vote twice?",
    answer:
      "The system combines World ID uniqueness checks with signed ballot rules to keep duplicate participation from being counted as separate valid votes.",
  },
  {
    question: "What happens after nullification?",
    answer:
      "During tally processing, the election authority resolves nullification accumulators. Votes tied to invalidated states are removed from the final count.",
  },
  {
    question: "What can auditors verify?",
    answer:
      "Auditors can inspect pseudonymous ballot choices, signatures, proof artifacts, nullification state, delegation ciphertexts, and tally output. Delegation hides the selected delegate; nullification hides whether a request is real or a decoy.",
  },
];

const FAQ = () => {
  return (
    <div className="px-4 pb-24 pt-10 sm:px-6 md:pb-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="ledger-panel relative overflow-hidden p-8 md:p-12">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-fixed-dim/60 blur-[100px]" />
          <div className="relative z-10 max-w-3xl">
            <span className="ledger-badge bg-secondary-container text-on-secondary-container">
              <CircleHelp className="h-4 w-4" />
              Frequently asked questions
            </span>
            <h1 className="mt-5 font-headline text-5xl font-extrabold text-primary">
              FAQ
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-on-surface-variant">
              Short answers for the voter-facing questions that do not belong in the deeper protocol walkthrough.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <article key={question} className="ledger-panel p-7">
              <h2 className="font-headline text-2xl font-bold text-primary">{question}</h2>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{answer}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

export default FAQ;
