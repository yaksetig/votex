/**
 * Read every row of a PostgREST query, page by page.
 *
 * Supabase caps a single response at 1000 rows. Every list read in the app
 * needs the complete set (tally inputs, participant lists, audit ledgers),
 * so callers pass a function that builds the query for a given range and
 * this helper walks the pages until a short page arrives.
 */

export const POSTGREST_PAGE_SIZE = 1000;

interface PageResult<Row> {
  data: Row[] | null;
  error: { message: string } | null;
}

export async function fetchAllRows<Row>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  pageSize: number = POSTGREST_PAGE_SIZE
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildPage(offset, offset + pageSize - 1);
    if (error) {
      throw error;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) {
      return rows;
    }
  }
}
