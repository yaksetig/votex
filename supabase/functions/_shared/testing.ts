// Test-only helpers for the Deno edge-function suites: deterministic
// BabyJubJub keypairs and EdDSA-Poseidon signatures in the exact serialised
// form the browser produces (see src/services/eddsaService.ts). Not imported
// by any function.

// @ts-expect-error: circomlibjs ships no accurate type definitions
import { buildEddsa } from "npm:circomlibjs@0.1.7";
import { hashMessageToField, type PublicKeyStrings } from "./protocol.ts";

// deno-lint-ignore no-explicit-any
type EddsaInstance = any;

let eddsaPromise: Promise<EddsaInstance> | undefined;

function getEddsa(): Promise<EddsaInstance> {
  eddsaPromise ??= buildEddsa() as Promise<EddsaInstance>;
  return eddsaPromise;
}

export interface TestKeypair {
  seed: Uint8Array;
  pk: PublicKeyStrings;
}

function pointToStrings(eddsa: EddsaInstance, point: unknown[]): PublicKeyStrings {
  return {
    x: BigInt(eddsa.F.toObject(point[0])).toString(),
    y: BigInt(eddsa.F.toObject(point[1])).toString(),
  };
}

/** Deterministic keypair from a 32-byte seed filled with `fill`. */
export async function makeTestKeypair(fill: number): Promise<TestKeypair> {
  const eddsa = await getEddsa();
  const seed = new Uint8Array(32).fill(fill);
  return { seed, pk: pointToStrings(eddsa, eddsa.prv2pub(seed)) };
}

/** Sign `message` with the browser's prehash convention; returns the JSON payload string. */
export async function signTestMessage(seed: Uint8Array, message: string): Promise<string> {
  const eddsa = await getEddsa();
  const signature = eddsa.signPoseidon(seed, eddsa.F.e(await hashMessageToField(message)));
  return JSON.stringify({
    R8: pointToStrings(eddsa, signature.R8),
    S: signature.S.toString(),
    message,
  });
}

// ---------------------------------------------------------------------------
// In-memory stand-in for the subset of the supabase-js query builder the edge
// functions use: from().select().eq().in().is().maybeSingle(), insert(),
// update().eq(), upsert(), and rpc(). Tables are plain row arrays; writes are
// recorded so tests can assert on them.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

export interface FakeSupabaseOptions {
  tables?: Record<string, Row[]>;
  /** Called for rpc(name, args); return { data, error }. */
  rpc?: (name: string, args: Row) => { data?: unknown; error?: { message: string; code?: string } | null };
  /** Force an error for select() on a given table. */
  selectErrors?: Record<string, { message: string }>;
}

export interface FakeSupabase {
  // deno-lint-ignore no-explicit-any
  client: any;
  inserts: Array<{ table: string; row: Row }>;
  updates: Array<{ table: string; values: Row; filters: Row }>;
  upserts: Array<{ table: string; row: Row }>;
  rpcCalls: Array<{ name: string; args: Row }>;
}

export function fakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const tables = options.tables ?? {};
  const state: FakeSupabase = { client: null, inserts: [], updates: [], upserts: [], rpcCalls: [] };

  const matches = (row: Row, filters: Array<[string, unknown]>, inFilters: Array<[string, unknown[]]>, isFilters: Array<[string, unknown]>) =>
    filters.every(([k, v]) => row[k] === v) &&
    inFilters.every(([k, vs]) => vs.includes(row[k])) &&
    isFilters.every(([k, v]) => row[k] === v);

  const select = (table: string) => {
    const eqFilters: Array<[string, unknown]> = [];
    const inFilters: Array<[string, unknown[]]> = [];
    const isFilters: Array<[string, unknown]> = [];
    const result = () => {
      const error = options.selectErrors?.[table] ?? null;
      if (error) return { data: null, error };
      const rows = (tables[table] ?? []).filter((row) => matches(row, eqFilters, inFilters, isFilters));
      return { data: rows, error: null };
    };
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      eq(k: string, v: unknown) { eqFilters.push([k, v]); return builder; },
      in(k: string, vs: unknown[]) { inFilters.push([k, vs]); return builder; },
      is(k: string, v: unknown) { isFilters.push([k, v]); return builder; },
      order() { return builder; },
      range() { return builder; },
      maybeSingle() {
        const r = result();
        return Promise.resolve({ data: r.data ? (r.data[0] ?? null) : null, error: r.error });
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(result()).then(resolve, reject);
      },
    };
    return builder;
  };

  state.client = {
    from(table: string) {
      return {
        select() { return select(table); },
        insert(row: Row) { state.inserts.push({ table, row }); return Promise.resolve({ error: null }); },
        upsert(row: Row) { state.upserts.push({ table, row }); return Promise.resolve({ error: null }); },
        update(values: Row) {
          const filters: Row = {};
          // deno-lint-ignore no-explicit-any
          const builder: any = {
            eq(k: string, v: unknown) { filters[k] = v; return builder; },
            is(k: string, v: unknown) { filters[k] = v; return builder; },
            select() { return builder; },
            then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
              state.updates.push({ table, values, filters });
              return Promise.resolve({ data: [{ id: "updated" }], error: null }).then(resolve, reject);
            },
          };
          return builder;
        },
      };
    },
    rpc(name: string, args: Row) {
      state.rpcCalls.push({ name, args });
      const result = options.rpc ? options.rpc(name, args) : { data: null, error: null };
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  };
  return state;
}
