import { useEffect, useRef } from "react";

interface InfiniteScrollSentinelProps {
  hasNextPage: boolean;
  isFetching: boolean;
  isError: boolean;
  onLoadMore: () => unknown;
}

/** Uses the nearest scrolling ancestor, including modal bodies and the app shell. */
export function InfiniteScrollSentinel({
  hasNextPage,
  isFetching,
  isError,
  onLoadMore,
}: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !hasNextPage || isFetching || isError) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || pending.current) return;
      pending.current = true;
      Promise.resolve(onLoadMore()).finally(() => { pending.current = false; });
    }, { rootMargin: "240px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, isError, onLoadMore]);

  if (!hasNextPage && !isError && !isFetching) return null;
  return (
    <div ref={ref} className="flex min-h-12 items-center justify-center gap-3 py-3 text-sm text-ink-muted" aria-live="polite">
      {isError ? (
        <>
          <button type="button" onClick={() => onLoadMore()} disabled={isFetching}
            className="rounded-lg border border-grey-4 px-3 py-1 text-ink hover:bg-grey-5 disabled:opacity-60">
            Повторить
          </button>
        </>
      ) : isFetching ? "Загрузка…" : (
        <button type="button" onClick={() => onLoadMore()}
          className="rounded-lg border border-grey-4 px-3 py-1 text-ink hover:bg-grey-5">
          Загрузить ещё
        </button>
      )}
    </div>
  );
}
