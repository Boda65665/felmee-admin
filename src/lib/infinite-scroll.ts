/** Advance by raw server rows, even when overlapping results are deduplicated. */
export function nextOffset(
  page: { has_more?: boolean; total?: number },
  count: number,
  offset: number,
): number | undefined {
  if (count === 0) return undefined;
  const next = offset + count;
  const more = page.has_more ?? (page.total != null && next < page.total);
  return more ? next : undefined;
}

export function uniqueBy<T>(items: T[], key: (item: T) => string | number): T[] {
  const seen = new Set<string | number>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
