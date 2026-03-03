import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { filterFns } from '../src/filterFns';
import { useFilter } from '../src/useFilter';

type Person = { name: string; age: number; status: string };

const data: Person[] = [
  { name: 'Alice', age: 28, status: 'active' },
  { name: 'Bob', age: 17, status: 'inactive' },
  { name: 'Carol', age: 35, status: 'active' },
];

// Defined outside render to maintain stable reference (same contract as TanStack Table)
const filterDefs = {
  name: (row: Person, value: string) =>
    row.name.toLowerCase().includes(value.toLowerCase()),
  age: filterFns.inRange((row: Person) => row.age),
  status: filterFns.equals((row: Person) => row.status),
};

describe('useFilter', () => {
  it('returns all data when no filters are active', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    expect(result.current.filteredData).toEqual(data);
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.filters).toEqual({});
  });

  it('returns the exact original data reference when unfiltered (fast path)', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    expect(result.current.filteredData).toBe(data);
  });

  it('filters by a string field', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    act(() => {
      result.current.setFilter('name', 'alice');
    });
    expect(result.current.filteredData).toHaveLength(1);
    expect(result.current.filteredData[0]?.name).toBe('Alice');
    expect(result.current.isFiltered).toBe(true);
  });

  it('filters by inRange', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    act(() => {
      result.current.setFilter('age', { min: 20, max: 30 });
    });
    expect(result.current.filteredData).toHaveLength(1);
    expect(result.current.filteredData[0]?.name).toBe('Alice');
  });

  it('composes multiple filters with AND logic', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    act(() => {
      result.current.setFilter('status', 'active');
      result.current.setFilter('age', { min: 30 });
    });
    // Only Carol is active AND age >= 30
    expect(result.current.filteredData).toHaveLength(1);
    expect(result.current.filteredData[0]?.name).toBe('Carol');
  });

  it('returns no results when no rows pass all filters', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    act(() => {
      result.current.setFilter('status', 'active');
      result.current.setFilter('name', 'xyz');
    });
    expect(result.current.filteredData).toHaveLength(0);
  });

  it('resetFilter removes a single filter', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    act(() => {
      result.current.setFilter('status', 'active');
      result.current.setFilter('name', 'alice');
    });
    act(() => {
      result.current.resetFilter('name');
    });
    // Only status filter remains → Alice and Carol
    expect(result.current.filteredData).toHaveLength(2);
    expect(result.current.filters).not.toHaveProperty('name');
    expect(result.current.isFiltered).toBe(true);
  });

  it('resetAllFilters returns to the unfiltered state', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    act(() => {
      result.current.setFilter('status', 'active');
      result.current.setFilter('age', { min: 20 });
    });
    act(() => {
      result.current.resetAllFilters();
    });
    expect(result.current.filteredData).toEqual(data);
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.filters).toEqual({});
  });

  it('exposes active filter values via filters', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    act(() => {
      result.current.setFilter('status', 'active');
    });
    expect(result.current.filters.status).toBe('active');
    expect(result.current.filters.name).toBeUndefined();
  });

  it('updating an existing filter overwrites the previous value', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    act(() => {
      result.current.setFilter('status', 'active');
    });
    expect(result.current.filteredData).toHaveLength(2);

    act(() => {
      result.current.setFilter('status', 'inactive');
    });
    expect(result.current.filteredData).toHaveLength(1);
    expect(result.current.filteredData[0]?.name).toBe('Bob');
  });

  it('isLoading is always false when no async filterDefs provided', () => {
    const { result } = renderHook(() => useFilter({ data, filterDefs }));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.filterError).toBeNull();
  });
});

// ─── Async filter support ────────────────────────────────────────────────────

describe('useFilter — async filters', () => {
  it('async filter resolves and filters data', async () => {
    const mixedFilterDefs = {
      ...filterDefs,
      authorized: async (rows: Person[], _value: string) =>
        rows.filter((r) => r.name === 'Alice'),
    };

    const { result } = renderHook(() =>
      useFilter({ data, filterDefs: mixedFilterDefs }),
    );

    await act(async () => {
      result.current.setFilter('authorized', 'user1');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.filterError).toBeNull();
    expect(result.current.filteredData).toHaveLength(1);
    expect(result.current.filteredData[0]?.name).toBe('Alice');
    expect(result.current.isFiltered).toBe(true);
  });

  it('isLoading transitions: true while pending, false after resolution', async () => {
    let resolve!: (rows: Person[]) => void;
    const pending = new Promise<Person[]>((r) => {
      resolve = r;
    });

    const mixedFilterDefs = {
      ...filterDefs,
      authorized: async (_rows: Person[], _value: string) => pending,
    };

    const { result } = renderHook(() =>
      useFilter({ data, filterDefs: mixedFilterDefs }),
    );

    act(() => {
      result.current.setFilter('authorized', 'user1');
    });

    // isLoading should be true while the promise is pending
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolve([data[0]!]);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.filteredData).toHaveLength(1);
  });

  it('async filter receives sync-filtered rows (AND composition)', async () => {
    const receivedRows: Person[][] = [];

    const mixedFilterDefs = {
      ...filterDefs,
      authorized: async (rows: Person[], _value: string) => {
        receivedRows.push(rows);
        return rows;
      },
    };

    const { result } = renderHook(() =>
      useFilter({ data, filterDefs: mixedFilterDefs }),
    );

    // Set sync filter first: only active employees pass (Alice + Carol, not Bob)
    act(() => {
      result.current.setFilter('status', 'active');
    });

    await act(async () => {
      result.current.setFilter('authorized', 'user1');
    });

    // Async fn should have received only the sync-filtered rows
    expect(receivedRows[0]).toBeDefined();
    expect(receivedRows[0]).toHaveLength(2);
    expect(receivedRows[0]?.map((r) => r.name)).toContain('Alice');
    expect(receivedRows[0]?.map((r) => r.name)).toContain('Carol');
    expect(receivedRows[0]?.map((r) => r.name)).not.toContain('Bob');
  });

  it('stale result is ignored when filter changes mid-flight', async () => {
    let firstResolve!: (rows: Person[]) => void;
    let callCount = 0;

    const mixedFilterDefs = {
      ...filterDefs,
      authorized: async (rows: Person[], _value: string) => {
        callCount++;
        if (callCount === 1) {
          // First call: hold until manually resolved
          return new Promise<Person[]>((r) => {
            firstResolve = r;
          });
        }
        // Second call: resolves immediately with Carol only
        return rows.filter((r) => r.name === 'Carol');
      },
    };

    const { result } = renderHook(() =>
      useFilter({ data, filterDefs: mixedFilterDefs }),
    );

    // Start first async call
    act(() => {
      result.current.setFilter('authorized', 'user1');
    });

    // Change filter before first resolves → starts second call
    await act(async () => {
      result.current.setFilter('authorized', 'user2');
    });

    // Resolve the first (now stale) call with ALL rows — should be ignored
    await act(async () => {
      firstResolve(data);
    });

    // Result must be from the second call (Carol only), not first (all rows)
    expect(result.current.filteredData.map((r) => r.name)).toEqual(['Carol']);
    expect(result.current.isLoading).toBe(false);
  });

  it('filterError is set when async filter throws', async () => {
    const mixedFilterDefs = {
      ...filterDefs,
      authorized: async (_rows: Person[], _value: string): Promise<Person[]> => {
        throw new Error('API unavailable');
      },
    };

    const { result } = renderHook(() =>
      useFilter({ data, filterDefs: mixedFilterDefs }),
    );

    // Suppress the expected unhandled rejection warning in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      result.current.setFilter('authorized', 'user1');
    });

    consoleSpy.mockRestore();

    expect(result.current.filterError).toBeInstanceOf(Error);
    expect(result.current.filterError?.message).toBe('API unavailable');
    expect(result.current.isLoading).toBe(false);
  });

  it('resetFilter clears async result and isLoading', async () => {
    const mixedFilterDefs = {
      ...filterDefs,
      authorized: async (rows: Person[], _value: string) =>
        rows.filter((r) => r.name === 'Alice'),
    };

    const { result } = renderHook(() =>
      useFilter({ data, filterDefs: mixedFilterDefs }),
    );

    await act(async () => {
      result.current.setFilter('authorized', 'user1');
    });

    expect(result.current.filteredData).toHaveLength(1);

    await act(async () => {
      result.current.resetFilter('authorized');
    });

    // Back to full dataset, no loading state
    expect(result.current.filteredData).toEqual(data);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFiltered).toBe(false);
  });
});
