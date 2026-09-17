import { api } from "./api";

export async function fetchAllCursorPages<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<{
      data: T[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(path, { params: { ...params, cursor, take: 100 } });

    rows.push(...response.data.data);
    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return rows;
}
