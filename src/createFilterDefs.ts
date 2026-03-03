import type { AsyncFilterFn, FilterFn } from './types';

// Sync-only record — used as constraint in createFilterDefs so that each
// function's first parameter is contextually typed as TData (not TData|TData[],
// which would happen with a FilterFn|AsyncFilterFn union and break inference).
type SyncFilterDefs<TData> = Record<string, FilterFn<TData, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

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
export function createFilterDefs<TData>() {
  /**
   * Wrap an async filter function so it can be placed alongside sync functions
   * in the same filterDefs object. `rows` is inferred as TData[].
   *
   * The returned value looks like a FilterFn to the type system but is detected
   * as async at runtime by useFilter, which routes it through the async pipeline.
   */
  function asyncDef<TValue>(fn: AsyncFilterFn<TData, TValue>): FilterFn<TData, TValue> {
    // Deliberate type assertion: the value is an async function at runtime;
    // useFilter detects this via isAsyncFn() and routes it to the async pipeline.
    // Typing it as FilterFn avoids the contextual-typing union intersection problem.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fn as unknown as FilterFn<TData, TValue>;
  }

  function def<TDefs extends SyncFilterDefs<TData>>(defs: TDefs): TDefs {
    return defs;
  }

  def.async = asyncDef;

  return def;
}
