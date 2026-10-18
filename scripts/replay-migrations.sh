#!/bin/zsh
# Replays every migration on a throwaway local PostgreSQL cluster (TCP 127.0.0.1:54329)
# with stub Supabase roles, auth/storage schemas and the realtime publication, then
# prints the privilege state. Needs initdb/pg_ctl/psql (PostgreSQL 17) on PATH.
# Usage: scripts/replay-migrations.sh
set -e
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=$(mktemp -d /tmp/votex-pg.XXXXXX)
PORT=54329
export PGPASSWORD=postgres
cleanup() { pg_ctl -D "$DIR" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
LC_ALL=en_US.UTF-8 initdb -D "$DIR" -U postgres --auth=trust --locale=en_US.UTF-8 >/dev/null
pg_ctl -D "$DIR" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DIR/log" start >/dev/null
sleep 1
P() { psql -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p $PORT -U postgres "$@"; }
P -d postgres -c "CREATE DATABASE votex;"
P -d votex <<'SQL'
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_admin NOLOGIN SUPERUSER;
CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE PUBLICATION supabase_realtime;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false);
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, bucket_id text, name text, owner uuid);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
SQL
for f in "$REPO"/supabase/migrations/*.sql; do
  echo "applying $(basename $f)"
  P -d votex -f "$f" >/dev/null
done
echo "--- non-SELECT grants to anon/authenticated (expect none):"
P -d votex -c "SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants WHERE grantee IN ('anon','authenticated') AND privilege_type <> 'SELECT' AND table_schema='public';"
echo "--- public_elections columns:"
P -d votex -c "SELECT column_name FROM information_schema.columns WHERE table_name='public_elections' ORDER BY ordinal_position;" | tr -s ' \n' ' '; echo
echo "--- create_election_atomic signatures:"
P -d votex -c "SELECT oid::regprocedure FROM pg_proc WHERE proname='create_election_atomic';"
echo "--- function grants:"
P -d votex -c "SELECT grantee, privilege_type FROM information_schema.role_routine_grants WHERE routine_name='create_election_atomic';"
echo "--- view select grants:"
P -d votex -c "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='public_elections';"
