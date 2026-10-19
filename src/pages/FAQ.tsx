import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ROUTES, howItWorksSection } from "@/lib/routes";
import { PageHeader } from "@/components/PageHeader";

const FAQ_ITEMS: Array<{ question: string; answer: string; more?: { label: string; to: string } }> = [
  {
    question: "Can I change my vote?",
    answer:
      "No. A ballot cannot be edited or replaced. If you need it not to count, you can nullify it before the election closes; the ballot is then removed at the tally and you cannot cast a new one.",
    more: { label: "How nullification works", to: howItWorksSection("nullification") },
  },
  {
    question: "Who can see my vote?",
    answer:
      "Everyone. Ballots are public under your pseudonym: anyone can see that a given pseudonym chose a given option. Votex never records your name or real-world identity, but the same pseudonym may be recognisable across elections.",
    more: { label: "Privacy model", to: howItWorksSection("privacy") },
  },
  {
    question: "Why do I need a passkey?",
    answer:
      "Your passkey derives your voting key in this browser. That key signs your ballots and is never sent to Votex. The same passkey derives the same key again on any device, which is how you keep one identity.",
  },
  {
    question: "Can someone vote twice?",
    answer:
      "No. World ID confirms that each person registers once, and each voting key can hold one ballot per election. A second ballot from the same key is rejected.",
  },
  {
    question: "What does delegating do?",
    answer:
      "Your ballot is counted as the delegate's choice, with their ballot counting twice. Everyone can see that you delegated; only the Election Authority learns to whom. Only one hop counts: if your delegate delegates too, neither ballot counts.",
    more: { label: "How delegation works", to: howItWorksSection("delegation") },
  },
  {
    question: "What is a decoy nullification and why would I send one?",
    answer:
      "A decoy is a nullification request that changes nothing, and it is indistinguishable from a real one. Decoys are what make real nullifications safe to send: if nobody sent decoys, every request would reveal itself. Sending one after you vote helps everyone.",
    more: { label: "Why decoys matter", to: howItWorksSection("nullification") },
  },
  {
    question: "What happens after I nullify?",
    answer:
      "Nothing visible, by design. The page does not change and the public record shows a request identical to a decoy. When the election closes, the Election Authority's tally removes nullified ballots from the count.",
  },
  {
    question: "What can auditors verify?",
    answer:
      "Every ballot and its signature, the list of participants, delegation records, nullification proofs and the published tally. Delegation hides the chosen delegate and nullification hides whether a request was real; everything else is open.",
    more: { label: "Audit protocol", to: ROUTES.auditProtocol },
  },
];

const FAQ = () => {
  usePageTitle("FAQ");
  return (
    <div className="civic-container pb-12 pt-10">
      <div className="mx-auto max-w-4xl space-y-10">
        <PageHeader
          eyebrow="Frequently asked questions"
          title="FAQ"
          description={
            <>
              Short answers to the practical questions. For the full picture, read{" "}
              <Link to={ROUTES.howItWorks} className="font-semibold text-secondary underline-offset-4 hover:underline">
                how Votex works
              </Link>
              .
            </>
          }
        />

        <section className="space-y-4" aria-label="Questions">
          {FAQ_ITEMS.map(({ question, answer, more }) => (
            <article key={question} className="ledger-panel p-6">
              <h2 className="font-headline text-xl font-semibold text-primary">{question}</h2>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant sm:text-base">{answer}</p>
              {more ? (
                <Link to={more.to} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-secondary underline-offset-4 hover:underline">
                  {more.label}
                </Link>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

export default FAQ;
