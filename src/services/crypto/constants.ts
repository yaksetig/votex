// BabyJubJub curve parameters, re-exported under the names the browser code
// has always used. The single source of truth is the shared protocol module
// (supabase/functions/_shared/protocol.ts), which must match circomlib.
import {
  BABYJUB_A,
  BABYJUB_BASE_POINT,
  BABYJUB_D,
  BABYJUB_FIELD,
  BABYJUB_SUBGROUP_ORDER,
} from "@protocol";

export const CURVE_ORDER = BABYJUB_SUBGROUP_ORDER;
export const FIELD_SIZE = BABYJUB_FIELD;
export const BABYJUBJUB_D = BABYJUB_D;
export const BABYJUBJUB_A = BABYJUB_A;
export const BASE_POINT = BABYJUB_BASE_POINT;
