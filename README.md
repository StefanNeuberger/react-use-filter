# @hanshase/react-use-filter

Headless React filtering hook with full TypeScript inference.
Source: [GitHub](https://github.com/StefanNeuberger/react-use-filter)
Composable, zero-UI filtering for any dataset — sync and async filters in one simple API,
inspired by the headless pattern of TanStack Table.

## Installation

```bash
npm install @hanshase/react-use-filter
# or
pnpm add @hanshase/react-use-filter
# or
yarn add @hanshase/react-use-filter
```

**Requires React ≥ 18.**

## Basic usage

```tsx
import { useFilter, createFilterDefs, filterFns } from '@hanshase/react-use-filter';

type Person = { name: string; age: number; status: string };

// Define filter functions once, outside the component (stable reference)
const def = createFilterDefs<Person>();
const filterDefs = def({
  name:   (row, value: string) => row.name.toLowerCase().includes(value.toLowerCase()),
  age:    filterFns.inRange(row => row.age),
  status: filterFns.equals(row => row.status),
});

function PeopleList({ people }: { people: Person[] }) {
  const {
    filteredData,
    setFilter,
    resetFilter,
    resetAllFilters,
    isFiltered,
    filters,
  } = useFilter({ data: people, filterDefs });

  return (
    <>
      <input
        placeholder="Search name…"
        value={filters.name ?? ''}
        onChange={e => e.target.value ? setFilter('name', e.target.value) : resetFilter('name')}
      />
      <input
        type="number"
        placeholder="Min age"
        onChange={e => setFilter('age', { min: Number(e.target.value) })}
      />
      {isFiltered && <button onClick={resetAllFilters}>Clear</button>}
      <ul>
        {filteredData.map(p => <li key={p.name}>{p.name}</li>)}
      </ul>
    </>
  );
}
```

## API overview

### `useFilter(options)`

The main hook. Returns filtered data and controls.

```ts
const {
  filteredData,    // TData[] — rows that pass all active filters
  setFilter,       // (key, value) => void — activate or update a filter
  resetFilter,     // (key) => void        — remove a single filter
  resetAllFilters, // () => void           — remove all filters
  isFiltered,      // boolean — true when ≥1 filter is active
  isLoading,       // boolean — true while an async filter is running
  filterError,     // Error | null — set when an async filter throws
  filters,         // Partial<{ [K in keyof filterDefs]: value }> — current filter state
} = useFilter({ data, filterDefs });
```

**Options**

| Prop | Type | Description |
|---|---|---|
| `data` | `TData[]` | The full dataset to filter |
| `filterDefs` | `FilterDefs<TData>` | Filter functions (sync and/or async). Define outside the component or wrap in `useMemo` — the hook uses object identity to detect changes. |

All active filters compose with **AND** logic. An absent key means the filter is inactive.

---

### `createFilterDefs<TData>()`

A curried helper that binds `TData` once so every function's `row`/`rows` parameter is
inferred without manual annotation — similar to TanStack Table's `createColumnHelper()`.

```ts
const def = createFilterDefs<Employee>();

export const filterDefs = def({
  // Sync — row: Employee is inferred
  name:       (row, value: string) => row.name.toLowerCase().includes(value.toLowerCase()),
  department: filterFns.equals(row => row.department),
  age:        filterFns.inRange(row => row.age),

  // Async — rows: Employee[] is inferred via def.async()
  skills: def.async(async (rows, query: string) => {
    const ids = await searchBySkillsAPI(query, rows.map(r => r.id));
    return rows.filter(r => ids.includes(r.id));
  }),
});
```

**`def.async(fn)`** wraps an `AsyncFilterFn` so it can sit alongside sync functions in the
same object. The hook detects it at runtime and runs it through the async pipeline
(after all sync filters). `isLoading` / `filterError` activate automatically.

An `AsyncFilterFn` receives the **already sync-filtered** rows — one API call per active
async filter, not one per row.

---

### `filterFns`

Built-in filter factories. Each takes an accessor `(row: TData) => fieldValue` and
returns a ready-to-use `FilterFn`.

| Helper | Filter value type | Description |
|---|---|---|
| `filterFns.includes(accessor)` | `string` | Case-insensitive substring match |
| `filterFns.equals(accessor)` | `TValue` | Strict equality (`===`) |
| `filterFns.inRange(accessor)` | `{ min?: number; max?: number }` | Inclusive numeric range (both bounds optional) |
| `filterFns.inArray(accessor)` | `TValue[]` | Field value is in the given array |
| `filterFns.startsWith(accessor)` | `string` | Case-insensitive prefix match |

```ts
const def = createFilterDefs<Product>();
const filterDefs = def({
  name:     filterFns.includes(row => row.name),
  category: filterFns.inArray(row => row.category),
  price:    filterFns.inRange(row => row.price),
  featured: filterFns.equals(row => row.featured),
});

// then:
setFilter('name', 'laptop');
setFilter('category', ['Electronics', 'Computers']);
setFilter('price', { min: 100, max: 999 });
setFilter('featured', true);
```

---

### TypeScript types

All types are exported for consumers who need them:

```ts
import type {
  FilterFn,        // (row: TData, value: TValue) => boolean
  AsyncFilterFn,   // (rows: TData[], value: TValue) => Promise<TData[]>
  FilterDefs,      // Record<string, FilterFn | AsyncFilterFn>
  FilterValue,     // Extracts TValue from a FilterFn or AsyncFilterFn
  FilterValueMap,  // Maps each key of FilterDefs to its value type
  ActiveFilters,   // Partial<FilterValueMap<TDefs>>
  UseFilterOptions,
  UseFilterReturn,
} from '@hanshase/react-use-filter';
```

## License

MIT
