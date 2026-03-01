export type SortDirection = 'asc' | 'desc';

export interface CursorPaginationArgs {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface PageInfo {
  total: number;
  hasNextPage: boolean;
  nextCursor: string | null;
  limit: number;
  offset: number | null;
}
