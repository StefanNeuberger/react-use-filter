import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActiveFilters,
  FilterDefs,
  FilterValueMap,
  UseFilterOptions,
  UseFilterReturn,
} from './types';

// Detect async functions at runtime — `instanceof AsyncFunction` is spec-guaranteed
// and not affected by minification (the AsyncFunction intrinsic is a singleton).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AsyncFunctionCtor = /* @__PURE__ */ (async function () {} as any).constructor as FunctionConstructor;
function isAsyncFn(fn: unknown): boolean {
  return typeof fn === 'function' && fn instanceof AsyncFunctionCtor;
}

/**
 * Headless filtering hook — supports both synchronous and async (API) filters
 * in a single filterDefs object.
 *
 * Active filters compose according to `filterMode` (default: `'and'`):
 *  - `'and'`: a row must pass every active filter (sync then async, sequentially).
 *  - `'or'`: a row is included if it passes any active filter (async runs in parallel, results unioned).
 *
 * Async functions (declared with `async`) are detected automatically at runtime.
 * No need to separate them into a second prop.
 *
 * **Important:** `filterDefs` should be defined outside the component or wrapped
 * in `useMemo` — the hook uses object identity to detect changes, same as
 * TanStack Table's `columns` prop. Use createFilterDefs<TData>() to avoid
 * per-function row type annotations.
 *
 * @example
 * // Sync-only
 * const def = createFilterDefs<Person>();
 * const filterDefs = def({
 *   name: (row, v: string) => row.name.includes(v),
 *   age:  filterFns.inRange(row => row.age),
 * });
 * const { filteredData, setFilter } = useFilter({ data, filterDefs });
 *
 * @example
 * // Mixed sync + async — everything in one object
 * const filterDefs = def({
 *   name:       (row, v: string)        => row.name.includes(v),
 *   authorized: async (rows, userId: string) => {
 *     const ids = await authApi.getAllowedIds(userId);
 *     return rows.filter(r => ids.includes(r.id));
 *   }
 * });
 * const { filteredData, isLoading, filterError, setFilter } =
 *   useFilter({ data, filterDefs });
 */
export function useFilter<TData, TDefs extends FilterDefs<TData>>(
  options: UseFilterOptions<TData, TDefs>,
): UseFilterReturn<TData, TDefs> {
  const { data, filterDefs, filterMode = 'and' } = options;

  const [filters, setFiltersState] = useState<ActiveFilters<TDefs>>({});
  const [asyncResult, setAsyncResult] = useState<TData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterError, setFilterError] = useState<Error | null>(null);

  // Tracks the syncFiltered reference from the previous effect run to detect
  // whether the sync dataset changed (vs only async filter values changing).
  const prevSyncFilteredRef = useRef<TData[] | null>(null);

  // OR-mode: track whether the inputs that actually feed the async phase changed.
  // If only syncFiltered changed (a sync filter was toggled), OR-async result is still
  // valid — data didn't change and async filter state didn't change.
  const prevDataRef = useRef<TData[] | null>(null);
  const prevAsyncKeyRef = useRef<string>('');

  // ── Phase 1: sync filtering ──────────────────────────────────────────────
  // Only considers keys whose filterDef is a sync (non-async) function.
  const syncFiltered = useMemo<TData[]>(() => {
    // Only keep entries with a valid, non-async filterDef — stale keys (removed from
    // filterDefs) are dropped here so the fast-path check below reflects reality.
    const syncEntries = (Object.entries(filters) as [string, unknown][]).filter(([k]) => {
      const fn = filterDefs[k];
      return fn !== undefined && !isAsyncFn(fn);
    });

    // Fast path: no active (valid) sync filters → return original array reference.
    if (syncEntries.length === 0) return data;

    const combineSync = filterMode === 'or' ? 'some' : 'every';
    return data.filter((row) =>
      syncEntries[combineSync](([key, value]) => {
        const fn = filterDefs[key];
        if (!fn) return filterMode !== 'or'; // defensive: stale key slipped through; AND → skip, OR → no match
        return (fn as (row: TData, value: unknown) => boolean)(row, value);
      }),
    );
  }, [data, filterDefs, filters, filterMode]);

  // ── Phase 2: async filtering ─────────────────────────────────────────────
  useEffect(() => {
    const asyncEntries = (Object.entries(filters) as [string, unknown][]).filter(([k]) => {
      const fn = filterDefs[k];
      return fn !== undefined && isAsyncFn(fn);
    });

    // No active async filters — clear previous result and bail out.
    if (asyncEntries.length === 0) {
      setAsyncResult(null);
      setIsLoading(false);
      setFilterError(null);
      prevSyncFilteredRef.current = null;
      return;
    }

    const syncFilteredChanged = prevSyncFilteredRef.current !== syncFiltered;
    prevSyncFilteredRef.current = syncFiltered;

    // OR mode: async runs on `data`, not `syncFiltered`. If only syncFiltered changed
    // (a sync filter was toggled), skip the async re-run — the result is still valid.
    const asyncKey = asyncEntries.map(([k, v]) => `${k}:${JSON.stringify(v)}`).join('\x00');
    const asyncInputChanged = prevDataRef.current !== data || prevAsyncKeyRef.current !== asyncKey;
    prevDataRef.current = data;
    prevAsyncKeyRef.current = asyncKey;

    if (filterMode === 'or' && !asyncInputChanged) {
      return; // syncFiltered changed but async inputs didn't — no re-run needed
    }

    let cancelled = false;
    setIsLoading(true);
    setFilterError(null);

    // AND mode: clear stale asyncResult when the underlying sync dataset changed —
    // showing a result computed from a different set of rows would be incorrect.
    // On async-only re-runs (same syncFiltered), preserve the previous result to
    // avoid a visible flash back to the sync-only view while the new fetch runs.
    // OR mode: asyncResult is computed from `data` (not syncFiltered), so a sync
    // filter change does NOT invalidate the async result — skip the clear.
    if (syncFilteredChanged && filterMode !== 'or') {
      setAsyncResult(null);
    }

    void (async () => {
      try {
        let result: TData[];
        if (filterMode === 'or') {
          // Each async filter runs on the full dataset independently (true OR semantics),
          // then results are unioned preserving original data order.
          const results = await Promise.all(
            asyncEntries.map(([key, value]) => {
              const fn = filterDefs[key];
              if (!fn) return Promise.resolve([] as TData[]);
              return (fn as (rows: TData[], value: unknown) => Promise<TData[]>)(data, value);
            }),
          );
          if (cancelled) return;
          const matchingSet = new Set(results.flat());
          result = data.filter((row) => matchingSet.has(row)); // preserves original order
        } else {
          // AND: sequential pipeline — each async filter narrows further
          result = syncFiltered;
          for (const [key, value] of asyncEntries) {
            const fn = filterDefs[key];
            if (!fn) continue; // handles noUncheckedIndexedAccess; pass rows on stale key
            result = await (fn as (rows: TData[], value: unknown) => Promise<TData[]>)(result, value);
            if (cancelled) return; // check after each await for mid-chain cancellation
          }
        }
        setAsyncResult(result);
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setFilterError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [syncFiltered, filterDefs, filters, filterMode]);

  // ── Final result ─────────────────────────────────────────────────────────
  const filteredData = useMemo<TData[]>(() => {
    if (filterMode === 'or' && asyncResult !== null) {
      // In OR mode: union sync-matched rows and async-matched rows, preserving data order.
      // When no sync filters are active, syncFiltered === data (fast path) — in that case
      // the async result alone is the answer (union with full data would return everything).
      if (syncFiltered !== data) {
        const syncSet = new Set(syncFiltered);
        const asyncSet = new Set(asyncResult);
        return data.filter((row) => syncSet.has(row) || asyncSet.has(row));
      }
      return asyncResult;
    }
    // AND mode (or no async active): asyncResult is null when no async filters are active,
    // in which case syncFiltered is correct.
    return asyncResult ?? syncFiltered;
  }, [data, syncFiltered, asyncResult, filterMode]);

  const isFiltered = Object.keys(filters).length > 0;

  // useCallback deps are empty: setFiltersState from useState has stable identity.
  const setFilter = useCallback(
    <K extends keyof TDefs>(key: K, value: FilterValueMap<TDefs>[K]) => {
      setFiltersState((prev) => ({ ...prev, [key as string]: value }));
    },
    [],
  );

  const resetFilter = useCallback((key: keyof TDefs) => {
    setFiltersState((prev) => {
      const next = { ...prev };
      delete next[key as keyof typeof next];
      return next;
    });
  }, []);

  const resetAllFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  return {
    filteredData,
    setFilter,
    resetFilter,
    resetAllFilters,
    isFiltered,
    isLoading,
    filterError,
    filters,
  };
}
