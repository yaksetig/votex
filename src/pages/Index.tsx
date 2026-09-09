import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Database,
  Fingerprint,
  KeyRound,
  ReceiptText,
  Search,
  ShieldCheck,
  TriangleAlert,
  Vote,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

const Index = () => {
  const navigate = useNavigate();
  const { isWorldIDVerified } = useWallet();
  const [query, setQuery] = useState("");

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(query.trim() ? `/elections?q=${encodeURIComponent(query.trim())}` : "/elections");
  };

  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-outline-variant bg-surface">
        <div className="ledger-grid-glow absolute inset-0 opacity-70" />
        <div className="civic-container relative flex min-h-[620px] flex-col items-center justify-center py-20 text-center">
          <div className="ledger-badge border border-outline-variant bg-surface-container-high text-secondary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Powered by World ID
          </div>
          <h1 className="mt-6 max-w-4xl font-headline text-4xl font-bold tracking-[-0.035em] text-primary sm:text-5xl lg:text-6xl">
            Democratic trust through radical transparency.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-on-surface-variant">
            Prove you are a unique human with World ID, then cast a public pseudonymous ballot that anyone can independently audit.
          </p>
          <div className="mt-8 flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row">
            <Link to={isWorldIDVerified ? "/dashboard" : "/dashboard"} className="ledger-button-primary px-7 py-4">
              {isWorldIDVerified ? "Open Voting Profile" : "Verify Identity with World ID"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/elections" className="ledger-button-secondary px-7 py-4">
              Browse Active Elections
              <Vote className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <div className="civic-container relative z-10 -mt-8">
        <form onSubmit={submitSearch} className="civic-card flex flex-col gap-2 p-2 shadow-ledger md:flex-row">
          <label className="flex min-h-14 flex-1 items-center gap-3 rounded-lg bg-surface-container-low px-4">
            <Search className="h-5 w-5 text-outline" aria-hidden="true" />
            <span className="sr-only">Search elections</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by election title or topic..."
              className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-on-surface-variant"
            />
          </label>
          <button type="submit" className="ledger-button-primary min-h-14 px-7">Find Elections</button>
        </form>
      </div>

      <section className="civic-container py-24 sm:py-32">
        <div className="grid gap-6 md:grid-cols-12">
          <article className="civic-card relative overflow-hidden bg-surface-container-low p-8 md:col-span-8">
            <Database className="h-9 w-9 text-secondary" aria-hidden="true" />
            <h2 className="mt-6 font-headline text-xl font-semibold text-primary">Publicly auditable</h2>
            <p className="mt-3 max-w-xl leading-7 text-on-surface-variant">
              Public receipts expose the election, pseudonymous voter, selected option, signature, and timestamps needed to verify inclusion and reproduce the result.
            </p>
            <div className="mt-8 flex items-center gap-4 rounded-lg border border-outline-variant bg-surface p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-2 w-32 rounded bg-outline-variant" />
                <div className="mt-2 h-2 w-48 max-w-full rounded bg-outline-variant/50" />
              </div>
              <code className="civic-mono hidden text-secondary sm:block">vx_r_82f...a1c</code>
            </div>
          </article>

          <article className="rounded-xl bg-primary p-8 text-on-primary md:col-span-4">
            <Fingerprint className="h-9 w-9 text-secondary-fixed" aria-hidden="true" />
            <h2 className="mt-6 font-headline text-xl font-semibold">Verifiable personhood</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">
              World ID verifies a unique human session without writing a legal name or real-world identity into Votex’s public voting records.
            </p>
            <div className="mt-8 border-t border-white/15 pt-6 text-xs font-semibold uppercase tracking-[0.05em] text-secondary-fixed">
              Proof bound to voting key
            </div>
          </article>

          <article className="civic-card p-8 md:col-span-4">
            <KeyRound className="h-9 w-9 text-secondary" aria-hidden="true" />
            <h2 className="mt-6 font-headline text-xl font-semibold text-primary">Local passkey identity</h2>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Your signing key is reconstructed locally from your Votex passkey only when a cryptographic action needs it.
            </p>
          </article>

          <article className="flex flex-col gap-5 rounded-xl border border-outline-variant bg-surface-container-highest p-8 sm:flex-row sm:items-center md:col-span-8">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-error-container text-on-error-container">
              <TriangleAlert className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-headline text-xl font-semibold text-primary">Public-ballot notice</h2>
              <p className="mt-2 leading-7 text-on-surface-variant">
                Ballots are public under pseudonymous identifiers. This is not a secret-ballot system, and activity may be linkable across elections.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="border-y border-outline-variant bg-surface-container-low py-24">
        <div className="civic-container">
          <div className="text-center">
            <h2 className="civic-section-title">How Votex works</h2>
            <p className="mx-auto mt-3 max-w-xl text-on-surface-variant">Three steps from personhood proof to independently verifiable inclusion.</p>
          </div>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              { icon: Fingerprint, title: "1. Prove personhood", text: "Unlock or create a Votex passkey, then bind it to a verified World ID session." },
              { icon: Vote, title: "2. Cast your ballot", text: "Choose one of two options and sign the public pseudonymous ballot locally." },
              { icon: ReceiptText, title: "3. Verify inclusion", text: "Open your receipt, verify its signature, and inspect the public election ledger." },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-secondary bg-surface text-secondary shadow-sm">
                  <Icon className="h-8 w-8" aria-hidden="true" />
                </div>
                <h3 className="mt-6 font-headline text-xl font-semibold text-primary">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="civic-container py-24">
        <div className="civic-card bg-white/80 p-8 text-center shadow-ledger sm:p-12">
          <h2 className="civic-section-title">Ready to participate?</h2>
          <p className="mx-auto mt-3 max-w-lg text-on-surface-variant">Browse a live election or prepare your passkey-backed voting identity.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/dashboard" className="ledger-button-primary px-8 py-4">Get Started</Link>
            <Link to="/audit-protocol" className="ledger-button-secondary px-8 py-4">View Audit Protocol</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
