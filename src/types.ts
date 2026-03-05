/**
 * A function that tests whether a data row matches a filter value.
 * TData = shape of a row in the dataset
 * TValue = shape of the filter input this function consumes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterFn<TData, TValue> = (row: TData, value: TValue) => boolean;

/**
 * An async filter function — receives the full (sync-filtered) dataset and returns
 * a filtered subset. Designed for API requests: one call per active async filter,
 * not one call per row.
 *
 * @example
 * const def = createFilterDefs<Person>();
 * export const filterDefs = def({
 *   authorized: async (rows, userId: string) => {
 *     const ids = await authApi.getAllowedIds(userId);
 *     return rows.filter(r => ids.includes(r.id));
 *   }
 * });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncFilterFn<TData, TValue> = (rows: TData[], value: TValue) => Promise<TData[]>;

/**
 * A record of filter functions (sync or async). Each key may carry a different TValue.
 * TData is fixed — all functions operate on the same row type.
 *
 * Prefer using createFilterDefs<TData>() to build this object so that row/rows
 * types are inferred without manual annotation.
 */
export type FilterDefs<TData> = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FilterFn<TData, any> | AsyncFilterFn<TData, any>
>;

/**
 * Extracts the TValue type from a FilterFn or AsyncFilterFn.
 *
 * FilterValue<FilterFn<Person, string>>                  → string
 * FilterValue<AsyncFilterFn<Person, { query: string }>>  → { query: string }
 */
export type FilterValue<TFn> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TFn extends FilterFn<any, infer V>
    ? V
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      TFn extends AsyncFilterFn<any, infer V>
      ? V
      : never;

/**
 * Maps each key of a filter defs record to its corresponding value type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterValueMap<TDefs extends Record<string, any>> = {
  [K in keyof TDefs]: FilterValue<TDefs[K]>;
};

/**
 * The shape of the active-filter state.
 * Absent key = filter inactive (no `undefined` sentinels in state).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ActiveFilters<TDefs extends FilterDefs<any>> = Partial<FilterValueMap<TDefs>>;

/** Options passed to useFilter. */
export type UseFilterOptions<TData, TDefs extends FilterDefs<TData>> = {
  data: TData[];
  /**
   * Filter functions — both sync `(row, value) => boolean` and async
   * `(rows, value) => Promise<rows[]>` are accepted in the same object.
   * The hook detects async functions at runtime and routes them through
   * a separate async pipeline automatically.
   *
   * **Important:** Define outside the component or wrap in useMemo — the hook
   * uses object identity to detect changes, same as TanStack Table's `columns`.
   *
   * Use createFilterDefs<TData>() to avoid per-function row type annotations.
   */
  filterDefs: TDefs;
  /**
   * Controls how multiple active filters are composed.
   * - `'and'` (default): a row must pass **every** active filter.
   * - `'or'`: a row is included if it passes **any** active filter.
   */
  filterMode?: 'and' | 'or';
};

/** Everything returned by useFilter. */
export type UseFilterReturn<TData, TDefs extends FilterDefs<TData>> = {
  /** Subset of data passing the active filters according to the current `filterMode`. */
  filteredData: TData[];

  /**
   * Activate or update a single filter.
   * Value type is inferred per key.
   */
  setFilter: <K extends keyof TDefs>(key: K, value: FilterValueMap<TDefs>[K]) => void;

  /** Remove a single active filter. */
  resetFilter: (key: keyof TDefs) => void;

  /** Remove all active filters. */
  resetAllFilters: () => void;

  /** True when at least one filter is active. */
  isFiltered: boolean;

  /** True while any async filter is running. Always false when no async filterDefs are active. */
  isLoading: boolean;

  /** Set when an async filter throws. Cleared on next async run or resetAllFilters. */
  filterError: Error | null;

  /** Read-only snapshot of active filter values. */
  filters: ActiveFilters<TDefs>;
};
