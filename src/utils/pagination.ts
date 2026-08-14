export interface PaginationResult {
    page: number;
    limit: number;
    skip: number;
    sort: Record<string, 1 | -1>;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toPositiveInt = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/** Shared `?page=`/`?limit=`/`?sort=` parsing for every GET collection endpoint. */
export const parsePagination = (
    query: Record<string, unknown>,
    defaultSortField = "createdAt",
): PaginationResult => {
    const page = toPositiveInt(query.page, DEFAULT_PAGE);
    const limit = Math.min(toPositiveInt(query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const skip = (page - 1) * limit;

    const rawSort = typeof query.sort === "string" ? query.sort : defaultSortField;
    const sortField = rawSort.startsWith("-") ? rawSort.slice(1) : rawSort;
    const sortOrder: 1 | -1 = rawSort.startsWith("-") ? -1 : 1;

    return { page, limit, skip, sort: { [sortField]: sortOrder } };
};
