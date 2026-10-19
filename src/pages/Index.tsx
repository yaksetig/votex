import { Link } from "react-router-dom";
import { ArrowRight, Database, Fingerprint, Info, KeyRound, ReceiptText, ShieldCheck, Vote } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ROUTES, howItWorksSection } from "@/lib/routes";

const Index = () => {
  usePageTitle("");
  const { isWorldIDVerified } = useWallet();

  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-outline-variant bg-surface">
        <div className="ledger-grid-glow absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="civic-container relative flex flex-col items-center justify-center py-20 text-center sm:py-28">
          <p className="ledger-badge border border-outline-variant bg-surface-container-high text-secondary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Verified with World ID
          </p>
          <h1 className="mt-6 max-w-4xl font-headline text-4xl font-bold tracking-display text-primary sm:text-5xl lg:text-6xl">
            Public elections anyone can check.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-on-surface-variant">
            Prove you are a unique person with World ID, then cast a ballot under a pseudonym that anyone can audit and
            nobody can trace back to you.
          </p>
          <div className="mt-8 flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row">
            <Link to={isWorldIDVerified ? ROUTES.profile : ROUTES.signIn} className="ledger-button-primary px-7 py-4">
              {isWorldIDVerified ? "Open your profile" : "Sign in with World ID"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to={`${ROUTES.elections}?status=active`} className="ledger-button-secondary px-7 py-4">
              Browse open elections
              <Vote className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="civic-container py-20 sm:py-28" aria-labelledby="pillars-title">
        <h2 id="pillars-title" className="sr-only">
          What makes Votex different
        </h2>
        <div className="grid gap-6 md:grid-cols-12">
          <article className="ledger-panel bg-surface-container-low p-8 md:col-span-8">
            <Database className="h-8 w-8 text-secondary" aria-hidden="true" />
            <h3 className="mt-6 font-headline text-xl font-semibold text-primary">Every ballot is public</h3>
            <p className="mt-3 max-w-xl leading-7 text-on-surface-variant">
              Each ballot is published with the voter&apos;s pseudonym, their choice, a signature and timestamps. Anyone
              can recount an election from the public record and verify any receipt.
            </p>
            <Link to={ROUTES.auditProtocol} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-secondary hover:text-primary">
              How to audit an election <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>

          <article className="rounded-xl bg-primary p-8 text-on-primary md:col-span-4">
            <Fingerprint className="h-8 w-8 text-secondary-fixed" aria-hidden="true" />
            <h3 className="mt-6 font-headline text-xl font-semibold">One person, one voting key</h3>
            <p className="mt-3 text-sm leading-6 text-white/85">
              World ID confirms you are a unique person without telling Votex who you are. Each person registers one
              voting key.
            </p>
          </article>

          <article className="ledger-panel p-8 md:col-span-4">
            <KeyRound className="h-8 w-8 text-secondary" aria-hidden="true" />
            <h3 className="mt-6 font-headline text-xl font-semibold text-primary">Your key stays with you</h3>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Your passkey derives your voting key in this browser whenever a ballot needs signing. It is never sent to
              Votex.
            </p>
          </article>

          <article className="flex flex-col gap-5 rounded-xl border border-outline-variant bg-surface-container-low p-8 sm:flex-row sm:items-center md:col-span-8">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
              <Info className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-headline text-xl font-semibold text-primary">Not a secret ballot</h3>
              <p className="mt-2 leading-7 text-on-surface-variant">
                Ballots are public under pseudonyms, and the same pseudonym may be recognisable across elections. If
                you are pressured to vote a certain way, Votex lets you cancel your ballot later with a request nobody
                can tell apart from a decoy.{" "}
                <Link to={howItWorksSection("pressure")} className="font-semibold text-secondary underline-offset-4 hover:underline">
                  What to do if you were pressured
                </Link>
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="border-y border-outline-variant bg-surface-container-low py-20" aria-labelledby="steps-title">
        <div className="civic-container">
          <div className="text-center">
            <h2 id="steps-title" className="civic-section-title">
              How voting works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-on-surface-variant">Three steps from proving you are a person to checking your ballot in the public record.</p>
          </div>
          <ol className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              { icon: Fingerprint, title: "Sign in", text: "Create or unlock your Votex passkey, then confirm with World ID that you are a unique person." },
              { icon: Vote, title: "Cast your ballot", text: "Choose one of two options. Your choice is signed with your voting key and published under your pseudonym." },
              { icon: ReceiptText, title: "Check it", text: "Open your receipt, confirm its signature, and find your ballot in the election's public records." },
            ].map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-secondary bg-surface text-secondary shadow-sm">
                  <Icon className="h-8 w-8" aria-hidden="true" />
                </div>
                <h3 className="mt-6 font-headline text-xl font-semibold text-primary">
                  <span className="text-secondary">{index + 1}.</span> {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 text-center">
            <Link to={ROUTES.howItWorks} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-secondary hover:text-primary">
              Read how delegation and nullification work <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      <section className="civic-container py-20">
        <div className="ledger-panel p-8 text-center shadow-ledger sm:p-12">
          <h2 className="civic-section-title">Ready to take part?</h2>
          <p className="mx-auto mt-3 max-w-lg text-on-surface-variant">Browse an open election, or sign in to create your own.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to={isWorldIDVerified ? ROUTES.elections : ROUTES.signIn} className="ledger-button-primary px-8 py-4">
              {isWorldIDVerified ? "Browse elections" : "Get started"}
            </Link>
            <Link to={ROUTES.auditProtocol} className="ledger-button-secondary px-8 py-4">
              Read the audit protocol
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
