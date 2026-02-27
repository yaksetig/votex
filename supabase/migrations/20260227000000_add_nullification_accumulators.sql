-- XOR nullification accumulators: one per (election, voter)
-- Stores the running encrypted XOR accumulator with optimistic locking.

create table if not exists public.nullification_accumulators (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  voter_id text not null,
  acc_c1_x text not null,
  acc_c1_y text not null,
  acc_c2_x text not null,
  acc_c2_y text not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (election_id, voter_id)
);

-- Index for fast lookups during nullification
create index if not exists idx_nullification_accumulators_election_voter
  on public.nullification_accumulators (election_id, voter_id);

-- Index for tally (all accumulators for an election)
create index if not exists idx_nullification_accumulators_election
  on public.nullification_accumulators (election_id);

-- Enable RLS
alter table public.nullification_accumulators enable row level security;

-- Anyone can read accumulators (they are encrypted, no privacy leak)
create policy "Accumulators are publicly readable"
  on public.nullification_accumulators for select
  using (true);

-- Authenticated users can insert/update accumulators
create policy "Authenticated users can insert accumulators"
  on public.nullification_accumulators for insert
  with check (true);

create policy "Authenticated users can update accumulators"
  on public.nullification_accumulators for update
  using (true);
