export interface PaginationQuery {
  page?: string;
  pageSize?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export function parsePagination(query: PaginationQuery): PaginationParams {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function paginated<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  return { data, page: params.page, pageSize: params.pageSize, total };
}
