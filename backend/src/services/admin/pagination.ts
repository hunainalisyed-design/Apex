import type { PaginationQuery } from "../../types/admin.js";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** No pagination convention exists elsewhere in this backend (every other list endpoint is
 * either single-resource or an unfiltered/unpaginated findMany) — this is a deliberately
 * simple page/pageSize scheme rather than cursor pagination, matching this codebase's plain,
 * manual style. Invalid/out-of-range input is clamped rather than rejected — this is an
 * internal admin tool, not a public API surface worth erroring on. */
export function parsePagination(query: PaginationQuery): { skip: number; take: number } {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(query.pageSize)) || DEFAULT_PAGE_SIZE));

  return { skip: (page - 1) * pageSize, take: pageSize };
}
