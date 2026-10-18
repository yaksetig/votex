/* eslint-disable react-refresh/only-export-components -- content module: copy sections plus one tiny paragraph helper */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { HOW_IT_WORKS_SECTIONS, ROUTES } from "@/lib/routes";

/**
 * The single source of explanatory copy. The "How Votex works" page renders
 * every section with an anchor; the Privacy and Audit protocol pages render
 * one section each so the same facts are never written twice.
 *
 * Vocabulary (see docs/GLOSSARY.md): passkey (credential), voting key
 * (derived key), ballot (record) / vote (act), nullify, decoy, pseudonym,
 * Election Authority. Never "ledger", never "actual/dummy".
 */

export interface ExplainerSection {
  id: (typeof HOW_IT_WORKS_SECTIONS)[keyof typeof HOW_IT_WORKS_SECTIONS];
  title: string;
  summary: string;
  body: ReactNode;
}

const P = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-on-surface-variant sm:text-base">{children}</p>;

export const EXPLAINER_SECTIONS: ExplainerSection[] = [
  {
    id: HOW_IT_WORKS_SECTIONS.voting,
    title: "Voting with a public ballot",
    summary: "One verified person, one voting key, one ballot that anyone can check.",
    body: (
      <>
        <P>
          World ID confirms that you are a unique person without telling Votex who you are. Your passkey then
          derives a voting key inside this browser. That key is never sent to Votex; it stays in this tab until you
          sign out or close it, and is derived again the next time you unlock your passkey.
        </P>
        <P>
          Casting a vote signs your choice with that key and publishes it as a ballot under your pseudonym. Ballots
          are public on purpose: anyone can read every ballot, check its signature, and recount the result. Votex is
          not a secret-ballot system, and the same pseudonym may be recognisable across elections.
        </P>
        <P>
          A receipt proves that your ballot was accepted. It does not prove that the ballot counts: whether it counts
          is decided at the tally, after nullification requests and delegations are resolved.
        </P>
      </>
    ),
  },
  {
    id: HOW_IT_WORKS_SECTIONS.delegation,
    title: "Delegating your ballot",
    summary: "Hand your ballot to someone you trust; only the Election Authority learns who.",
    body: (
      <>
        <P>
          Instead of voting yourself you can delegate to another registered participant. Everyone can see that you
          delegated; only the Election Authority can see to whom, because the choice is encrypted to the
          authority&apos;s key and is only opened at the tally.
        </P>
        <P>
          Only one hop counts. If the person you delegated to delegates in turn, neither ballot is counted. You can
          revoke a delegation any time before the election closes, and you can delegate again afterwards.
        </P>
      </>
    ),
  },
  {
    id: HOW_IT_WORKS_SECTIONS.nullification,
    title: "Nullifying a ballot, and why decoys matter",
    summary: "A ballot can be cancelled with a request nobody can tell apart from a decoy.",
    body: (
      <>
        <P>
          After voting you may submit a nullification request at any time before the election closes. A request is
          either real, which removes your ballot from the count, or a decoy, which changes nothing. Both look
          identical to Votex, to observers and to anyone looking over your shoulder: only the encrypted request is
          published, and only the Election Authority learns the outcome at the tally.
        </P>
        <P>
          Decoys are what protect voters who need the real thing. If nobody sent decoys, every request would be a real
          nullification and the protection would vanish. Anyone can send as many requests as they like, and sending a
          decoy after you vote is a good habit.
        </P>
        <P>
          Nullifying is final: after a real nullification you cannot cast a new ballot in that election. This is a
          coercion-mitigation measure, not full coercion resistance. The receipt you receive when voting still shows
          how you voted.
        </P>
      </>
    ),
  },
  {
    id: HOW_IT_WORKS_SECTIONS.pressure,
    title: "If you were pressured to vote a certain way",
    summary: "Vote as instructed, then nullify from a device the other person cannot see.",
    body: (
      <>
        <P>
          Cast the ballot you were told to cast, and keep the receipt if you were asked for one. Later, from a device
          and a moment the other person cannot see, open the election and submit a nullification request, choosing
          the real one. Do this before the election closes.
        </P>
        <P>
          Nothing on the screen you use is recorded, and the public record of your request is identical to a decoy.
          Your ballot will be removed at the tally. You will not be able to cast a replacement ballot.
        </P>
      </>
    ),
  },
  {
    id: HOW_IT_WORKS_SECTIONS.privacy,
    title: "Privacy model",
    summary: "What is public, what is hidden, and what this release does not claim.",
    body: (
      <>
        <P>
          World ID supplies a pseudonymous proof of unique humanity. Votex does not ask World ID for your name, email
          or government identity, and none of those are written to the public record.
        </P>
        <P>
          Ballots are intentionally public under a pseudonymous voter identifier. Observers can see the selected
          option, the signature and the timestamps. Pseudonymous activity may be linkable across elections, and the
          receipt is not coercion-resistant on its own.
        </P>
        <P>
          Nullification requests use encrypted accumulators and zero-knowledge proofs so outside observers cannot
          distinguish a real nullification from a decoy. Delegation records reveal that a delegation happened while
          encrypting the chosen delegate for the Election Authority.
        </P>
        <P>
          Full ballot secrecy, unlinkable per-election identities and authority-blind tallying are future work and
          are not claims of this pre-production release.
        </P>
      </>
    ),
  },
  {
    id: HOW_IT_WORKS_SECTIONS.audit,
    title: "Audit protocol",
    summary: "What an independent observer can check, step by step.",
    body: (
      <>
        <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed text-on-surface-variant sm:text-base">
          <li>
            <strong className="text-primary">Election record:</strong> verify the two options, the authority&apos;s
            public key, the creator&apos;s pseudonym and the closing time.
          </li>
          <li>
            <strong className="text-primary">Ballot record:</strong> inspect each public receipt, its pseudonymous
            voter, choice, signature, signed time and acceptance time.
          </li>
          <li>
            <strong className="text-primary">Nullification:</strong> inspect submitted proofs and the encrypted
            accumulator transitions; the server verifies every proof before committing state.
          </li>
          <li>
            <strong className="text-primary">Delegation:</strong> inspect public delegation ciphertexts and the final
            authority-resolved vote weights without learning the chosen delegate from the public record.
          </li>
          <li>
            <strong className="text-primary">Tally:</strong> compare the canonical ballots, final nullification
            states, delegation weights and the published tally run.
          </li>
        </ol>
        <P>
          Each election page has a Public records section with the ballots, participants, delegations, nullification
          proofs and activity trail behind these steps. The cryptographic details, including the current Groth16
          trusted-setup limitation, are documented in the repository&apos;s cryptography guide.
        </P>
        <p className="text-sm text-on-surface-variant">
          See also the <Link to={ROUTES.privacy} className="font-semibold text-secondary underline-offset-4 hover:underline">privacy model</Link>.
        </p>
      </>
    ),
  },
];

export function getExplainerSection(id: ExplainerSection["id"]): ExplainerSection {
  const section = EXPLAINER_SECTIONS.find((candidate) => candidate.id === id);
  if (!section) {
    throw new Error(`Unknown explainer section: ${id}`);
  }
  return section;
}
