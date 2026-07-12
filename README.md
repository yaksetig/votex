# Votex

> **Pre-production privacy model:** ballots are public under World ID-derived
> pseudonyms. Observers can see that pseudonymous voter `X` selected option
> `Y`, while Votex does not publish that voter’s real-world identity. Activity
> may be linkable across elections. Full ballot secrecy is future work.

## Abstract
Online voting is hard (I wrote a bit about this [here](https://myaksetig.substack.com/p/on-the-security-of-online-voting)). Essentially, any approach that tries to do online voting has to tackle the following: 

* **Privacy** - How each user votes should be private to external parties (ideally, even to the person running the election). 
* **Verifiability** - External parties should be able to audit and check whether or not the election was run correctly.
* **Coercion Resistance** - The scheme should have an integrated mechanism to prevent users from being bribed and/or coerced to cast their votes in a specific way.


### Real-World Coercion (or Bribing) Examples
 * An abusive person in a relationship can vote on behalf of their partner.
 * A professor running for a Dean position in a university colludes with the IT manager of the university to see how each PhD student cast their vote. (Professor can subsequently work towards cancelling the funding of said students)
 * Blockchain nodes pay users to vote a specific way that favours the nodes. Users, acting rationally, cast the vote and make extra money. 


## How does Votex tackle coercion and bribing? 
We take things a step further and assume that the user that is coerced/bribed actually gives the adversary a copy of their voting key. In other words, the bad actor can vote on behalf of the victim. However, we give users the ability to 'nullify' their vote. As long as the user is able to safely generate and register the initial keypair, they are set. Our mechanism to prevent coercion is different. We allow the adversary to vote on behalf of the user and even have full knowledge of said key and introduce a nullification stage where users can nullify their vote by publishing a ZK-SNARK. There are different ways to go about this nullification and we cover them in thorough detail in our paper (see additional docs section below) 

## Doesn't MACI solve this? 
Not really. Assume the following scenario: Bob generates a voting keypair and votes 'YES'. The coercer/briber forces Bob to cast a specific payload including a key that only they control. Bob is then no longer able to cancel the vote and has successfully been coerced/bribed. If you assume a very strong model where the key is generated correctly and given to the adversary so that the adversary can cast the immediate first vote on behalf of the user, then MACI fails. This may sound very extreme, but it's actually a pretty realistic adversary model (especially for the Web3 world). 

## Blockchain Governance is far from the 'real deal'
DAO Elections are currently the worst of all worlds. Although they do provide auditability (as anyone can go and check the blockchain and the corresponding smart contract for the votes), the votes are public and adversaries can coerce/bribe the voters. It's not infrequent for community members to be revolted after seeing how specific users and/or team members are voting in specific elections. This violates a fundamental human right when it comes to voting. 

## Web App
Our app is live on the following URL: [https://votex.world](https://votex.world)

## How to create an election

### Step I
Create or unlock the passkey that deterministically derives your local voting
key. Votex uses its public key as the signal for the subsequent World ID proof.

### Step II
Complete the World ID proof. The server verifies the proof and binds the World
ID pseudonym, passkey-derived public key, and session verifier. Private key
material is reconstructed locally and is never sent to the server.

### Step III
Go to the Elections tab and click "Create Election". 

### Step IV
Choose the title of the election. This should be short and catchy to ensure people can quickly understand what the election is about. For additional info, you can use the description field right below the title to add further context that users may want to see. 

### Step V
Click "Create Election". Your election is now live for everyone to see. 

## Local Development

Prerequisites: Node 20, [Deno](https://deno.com/) (for the Supabase edge
functions), the [Supabase CLI](https://supabase.com/docs/guides/cli), and
optionally `circom` + `snarkjs` (for circuit work).

```sh
npm install            # install dependencies
npm run dev            # start the Vite dev server (http://localhost:8080)
npm test               # run the browser/node test suite (vitest)
npm run lint           # eslint
npx tsc -b             # typecheck (strict; follows project references)
npm run build          # production build

# Edge functions (Deno):
deno check supabase/functions/*/index.ts
deno test --allow-env supabase/functions/

# Circuit static analysis:
npm run analyze:circuits
```

### Configuration

- Copy `.env.example` to `.env.local` and provide `VITE_SUPABASE_URL` and the
  public `VITE_SUPABASE_ANON_KEY`. Never expose the service-role key through a
  `VITE_` variable.
- `FIXED_AUTHORITY_ID` (edge-function configuration): UUID of the real,
  pre-created fixed Election Authority row. The row must use a non-placeholder
  public key and be linked to one Supabase Auth account before elections can be
  created.
- `ALLOWED_ORIGIN` (Supabase secret): set to the deployed app origin to scope
  edge-function CORS; defaults to `*` for local development.
- `VITE_CIRCUIT_FILES_URL` (optional): overrides where the browser loads circuit
  artifacts from (defaults to `/circuits/`).

The database schema lives in `supabase/migrations/`. Apply it to a linked
project with `supabase db push`; edge functions deploy with
`supabase functions deploy`. See `CRYPTOGRAPHY.md` for the protocol design and
`docs/TRUSTED_SETUP_RUNBOOK.md` for the ZK trusted-setup procedure.

## Additional Docs
* 2022 Short Paper - https://eprint.iacr.org/2022/1212.pdf
* 2024 Main Paper - https://eprint.iacr.org/2024/1354.pdf

## Future Work

Full ballot secrecy, election-specific unlinkable pseudonyms, metadata-hiding
submission, configurable result visibility, and threshold authority custody
remain future work. The current application intentionally exposes public
pseudonymous ballots and a running tally.
