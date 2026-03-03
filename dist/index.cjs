"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createFilterDefs: () => createFilterDefs,
  filterFns: () => filterFns,
  useFilter: () => useFilter
});
module.exports = __toCommonJS(index_exports);

// src/useFilter.ts
var import_react = require("react");
var AsyncFunctionCtor = (async function() {
}).constructor;
function isAsyncFn(fn) {
  return typeof fn === "function" && fn instanceof AsyncFunctionCtor;
}
function useFilter(options) {
  const { data, filterDefs } = options;
  const [filters, setFiltersState] = (0, import_react.useState)({});
  const [asyncResult, setAsyncResult] = (0, import_react.useState)(null);
  const [isLoading, setIsLoading] = (0, import_react.useState)(false);
  const [filterError, setFilterError] = (0, import_react.useState)(null);
  const prevSyncFilteredRef = (0, import_react.useRef)(null);
  const syncFiltered = (0, import_react.useMemo)(() => {
    const syncEntries = Object.entries(filters).filter(([k]) => {
      const fn = filterDefs[k];
      return fn !== void 0 && !isAsyncFn(fn);
    });
    if (syncEntries.length === 0) return data;
    return data.filter(
      (row) => syncEntries.every(([key, value]) => {
        const fn = filterDefs[key];
        if (!fn || isAsyncFn(fn)) return true;
        return fn(row, value);
      })
    );
  }, [data, filterDefs, filters]);
  (0, import_react.useEffect)(() => {
    const asyncEntries = Object.entries(filters).filter(([k]) => {
      const fn = filterDefs[k];
      return fn !== void 0 && isAsyncFn(fn);
    });
    if (asyncEntries.length === 0) {
      setAsyncResult(null);
      setIsLoading(false);
      setFilterError(null);
      prevSyncFilteredRef.current = null;
      return;
    }
    const syncFilteredChanged = prevSyncFilteredRef.current !== syncFiltered;
    prevSyncFilteredRef.current = syncFiltered;
    let cancelled = false;
    setIsLoading(true);
    setFilterError(null);
    if (syncFilteredChanged) {
      setAsyncResult(null);
    }
    void (async () => {
      try {
        let result = syncFiltered;
        for (const [key, value] of asyncEntries) {
          const fn = filterDefs[key];
          if (!fn) continue;
          result = await fn(result, value);
          if (cancelled) return;
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
  }, [syncFiltered, filterDefs, filters]);
  const filteredData = asyncResult ?? syncFiltered;
  const isFiltered = Object.keys(filters).length > 0;
  const setFilter = (0, import_react.useCallback)(
    (key, value) => {
      setFiltersState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );
  const resetFilter = (0, import_react.useCallback)((key) => {
    setFiltersState((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);
  const resetAllFilters = (0, import_react.useCallback)(() => {
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
    filters
  };
}

// src/filterFns.ts
function includes(accessor) {
  return (row, value) => accessor(row).toLowerCase().includes(value.toLowerCase());
}
function equals(accessor) {
  return (row, value) => accessor(row) === value;
}
function inRange(accessor) {
  return (row, { min, max }) => {
    const val = accessor(row);
    if (min !== void 0 && val < min) return false;
    if (max !== void 0 && val > max) return false;
    return true;
  };
}
function inArray(accessor) {
  return (row, value) => value.includes(accessor(row));
}
function startsWith(accessor) {
  return (row, value) => accessor(row).toLowerCase().startsWith(value.toLowerCase());
}
var filterFns = {
  includes,
  equals,
  inRange,
  inArray,
  startsWith
};

// src/createFilterDefs.ts
function createFilterDefs() {
  function asyncDef(fn) {
    return fn;
  }
  function def(defs) {
    return defs;
  }
  def.async = asyncDef;
  return def;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createFilterDefs,
  filterFns,
  useFilter
});
//# sourceMappingURL=index.cjs.map