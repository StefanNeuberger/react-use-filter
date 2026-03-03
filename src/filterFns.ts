import type { FilterFn } from './types';

/**
 * Case-insensitive substring match on a string field.
 *
 * @example
 * filterFns.includes((row: Person) => row.name)
 */
function includes<TData>(
  accessor: (row: TData) => string,
): FilterFn<TData, string> {
  return (row, value) =>
    accessor(row).toLowerCase().includes(value.toLowerCase());
}

/**
 * Strict equality (`===`) on any scalar field.
 *
 * @example
 * filterFns.equals((row: Person) => row.status)
 */
function equals<TData, TValue>(
  accessor: (row: TData) => TValue,
): FilterFn<TData, TValue> {
  return (row, value) => accessor(row) === value;
}

/**
 * Numeric range check — both bounds are optional (half-open ranges supported).
 * Bounds are inclusive.
 *
 * @example
 * filterFns.inRange((row: Person) => row.age)
 * // then: setFilter('age', { min: 18, max: 65 })
 * // or:   setFilter('age', { min: 18 })   ← no upper bound
 */
function inRange<TData>(
  accessor: (row: TData) => number,
): FilterFn<TData, { min?: number; max?: number }> {
  return (row, { min, max }) => {
    const val = accessor(row);
    if (min !== undefined && val < min) return false;
    if (max !== undefined && val > max) return false;
    return true;
  };
}

/**
 * Checks whether the accessed field value is contained in the filter array.
 * Useful for multi-select / tag filters.
 *
 * @example
 * filterFns.inArray((row: Person) => row.role)
 * // then: setFilter('role', ['admin', 'editor'])
 */
function inArray<TData, TValue>(
  accessor: (row: TData) => TValue,
): FilterFn<TData, TValue[]> {
  return (row, value) => value.includes(accessor(row));
}

/**
 * Case-insensitive prefix match on a string field.
 *
 * @example
 * filterFns.startsWith((row: Person) => row.name)
 */
function startsWith<TData>(
  accessor: (row: TData) => string,
): FilterFn<TData, string> {
  return (row, value) =>
    accessor(row).toLowerCase().startsWith(value.toLowerCase());
}

export const filterFns = {
  includes,
  equals,
  inRange,
  inArray,
  startsWith,
} as const;
