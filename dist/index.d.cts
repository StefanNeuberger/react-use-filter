/**
 * A function that tests whether a data row matches a filter value.
 * TData = shape of a row in the dataset
 * TValue = shape of the filter input this function consumes
 */
type FilterFn<TData, TValue> = (row: TData, value: TValue) => boolean;
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
type AsyncFilterFn<TData, TValue> = (rows: TData[], value: TValue) => Promise<TData[]>;
/**
 * A record of filter functions (sync or async). Each key may carry a different TValue.
 * TData is fixed — all functions operate on the same row type.
 *
 * Prefer using createFilterDefs<TData>() to build this object so that row/rows
 * types are inferred without manual annotation.
 */
type FilterDefs<TData> = Record<string, FilterFn<TData, any> | AsyncFilterFn<TData, any>>;
/**
 * Extracts the TValue type from a FilterFn or AsyncFilterFn.
 *
 * FilterValue<FilterFn<Person, string>>                  → string
 * FilterValue<AsyncFilterFn<Person, { query: string }>>  → { query: string }
 */
type FilterValue<TFn> = TFn extends FilterFn<any, infer V> ? V : TFn extends AsyncFilterFn<any, infer V> ? V : never;
/**
 * Maps each key of a filter defs record to its corresponding value type.
 */
type FilterValueMap<TDefs extends Record<string, any>> = {
    [K in keyof TDefs]: FilterValue<TDefs[K]>;
};
/**
 * The shape of the active-filter state.
 * Absent key = filter inactive (no `undefined` sentinels in state).
 */
type ActiveFilters<TDefs extends FilterDefs<any>> = Partial<FilterValueMap<TDefs>>;
/** Options passed to useFilter. */
type UseFilterOptions<TData, TDefs extends FilterDefs<TData>> = {
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
};
/** Everything returned by useFilter. */
type UseFilterReturn<TData, TDefs extends FilterDefs<TData>> = {
    /** Subset of data passing all active filters (sync and async). */
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

/**
 * Headless filtering hook — supports both synchronous and async (API) filters
 * in a single filterDefs object.
 *
 * All active filters compose with AND logic:
 *  1. Sync filters run first (useMemo, instant).
 *  2. Async filters receive the sync-filtered result and run sequentially (useEffect).
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
declare function useFilter<TData, TDefs extends FilterDefs<TData>>(options: UseFilterOptions<TData, TDefs>): UseFilterReturn<TData, TDefs>;

/**
 * Case-insensitive substring match on a string field.
 *
 * @example
 * filterFns.includes((row: Person) => row.name)
 */
declare function includes<TData>(accessor: (row: TData) => string): FilterFn<TData, string>;
/**
 * Strict equality (`===`) on any scalar field.
 *
 * @example
 * filterFns.equals((row: Person) => row.status)
 */
declare function equals<TData, TValue>(accessor: (row: TData) => TValue): FilterFn<TData, TValue>;
/**
 * Numeric range check — both bounds are optional (half-open ranges supported).
 * Bounds are inclusive.
 *
 * @example
 * filterFns.inRange((row: Person) => row.age)
 * // then: setFilter('age', { min: 18, max: 65 })
 * // or:   setFilter('age', { min: 18 })   ← no upper bound
 */
declare function inRange<TData>(accessor: (row: TData) => number): FilterFn<TData, {
    min?: number;
    max?: number;
}>;
/**
 * Checks whether the accessed field value is contained in the filter array.
 * Useful for multi-select / tag filters.
 *
 * @example
 * filterFns.inArray((row: Person) => row.role)
 * // then: setFilter('role', ['admin', 'editor'])
 */
declare function inArray<TData, TValue>(accessor: (row: TData) => TValue): FilterFn<TData, TValue[]>;
/**
 * Case-insensitive prefix match on a string field.
 *
 * @example
 * filterFns.startsWith((row: Person) => row.name)
 */
declare function startsWith<TData>(accessor: (row: TData) => string): FilterFn<TData, string>;
declare const filterFns: {
    readonly includes: typeof includes;
    readonly equals: typeof equals;
    readonly inRange: typeof inRange;
    readonly inArray: typeof inArray;
    readonly startsWith: typeof startsWith;
};

type SyncFilterDefs<TData> = Record<string, FilterFn<TData, any>>;
/**
 * Curried helper that binds TData once so every filter function's parameter
 * is inferred without explicit annotation — similar to TanStack Table's
 * createColumnHelper<TData>().
 *
 * - Sync functions: pass directly → `row` inferred as TData
 * - Async functions: wrap with `def.async(fn)` → `rows` inferred as TData[]
 *
 * @example
 * const def = createFilterDefs<Employee>();
 * export const filterDefs = def({
 *   name:   (row, v: string)          => row.name.includes(v),     // row: Employee ✓
 *   age:    filterFns.inRange(row      => row.age),                 // row: Employee ✓
 *   skills: def.async(async (rows, q: string) => fetch(q, rows)),  // rows: Employee[] ✓
 * });
 */
declare function createFilterDefs<TData>(): {
    <TDefs extends SyncFilterDefs<TData>>(defs: TDefs): TDefs;
    async: <TValue>(fn: AsyncFilterFn<TData, TValue>) => FilterFn<TData, TValue>;
};

export { type ActiveFilters, type AsyncFilterFn, type FilterDefs, type FilterFn, type FilterValue, type FilterValueMap, type UseFilterOptions, type UseFilterReturn, createFilterDefs, filterFns, useFilter };
