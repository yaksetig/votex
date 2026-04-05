-- Private vote delegation (Kite-inspired).
--
-- A delegator encrypts their chosen delegate's participant index using
-- the election authority's ElGamal public key.  The ciphertext is stored
-- publicly so observers can see "someone delegated" but NOT to whom.
-- At tally time the authority decrypts the index and applies vote weights.

create table if not exists public.delegations (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  delegator_id text not null,
  -- ElGamal ciphertext encrypting the delegate's participant index
  delegate_ct_c1_x text not null,
  delegate_ct_c1_y text not null,
  delegate_ct_c2_x text not null,
  delegate_ct_c2_y text not null,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Only one active delegation per voter per election
create unique index idx_delegations_active_unique
  on public.delegations (election_id, delegator_id)
  where (status = 'active');

create index idx_delegations_election
  on public.delegations (election_id);

-- RLS
alter table public.delegations enable row level security;

-- Ciphertexts are encrypted so public read is safe
create policy "Delegations are publicly readable"
  on public.delegations for select using (true);

create policy "Authenticated users can insert delegations"
  on public.delegations for insert with check (true);

create policy "Authenticated users can update delegations"
  on public.delegations for update using (true);

-- Add vote_weight to election_tallies for delegation-weighted counts
alter table public.election_tallies
  add column if not exists vote_weight integer not null default 1;
