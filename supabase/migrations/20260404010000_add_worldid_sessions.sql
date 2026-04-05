create table public.world_id_auth_verifiers (
  nullifier_hash text primary key references public.world_id_keypairs(nullifier_hash) on delete cascade,
  verifier_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.world_id_sessions (
  id uuid primary key default gen_random_uuid(),
  nullifier_hash text not null references public.world_id_keypairs(nullifier_hash) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index idx_world_id_sessions_nullifier_hash
  on public.world_id_sessions (nullifier_hash);

create index idx_world_id_sessions_expires_at
  on public.world_id_sessions (expires_at);

alter table public.world_id_auth_verifiers enable row level security;
alter table public.world_id_sessions enable row level security;

create or replace function public.update_world_id_auth_verifiers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_world_id_auth_verifiers_updated_at
before update on public.world_id_auth_verifiers
for each row
execute function public.update_world_id_auth_verifiers_updated_at();
