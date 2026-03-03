// Hook
export { useFilter } from './useFilter';

// Built-in filter helpers
export { filterFns } from './filterFns';

// Type-safe filterDefs builder
export { createFilterDefs } from './createFilterDefs';

// Types (exported for consumers who want to type their own filterDefs)
export type {
  FilterFn,
  FilterDefs,
  AsyncFilterFn,
  FilterValue,
  FilterValueMap,
  ActiveFilters,
  UseFilterReturn,
  UseFilterOptions,
} from './types';
