import { describe, expect, it } from 'vitest';
import { filterFns } from '../src/filterFns';

type Person = {
  name: string;
  age: number;
  status: string;
  tags: string[];
};

const alice: Person = { name: 'Alice Smith', age: 28, status: 'active', tags: ['admin', 'editor'] };
const bob: Person = { name: 'Bob Jones', age: 17, status: 'inactive', tags: ['viewer'] };
const carol: Person = { name: 'carol white', age: 35, status: 'active', tags: ['editor'] };

describe('filterFns.includes', () => {
  const fn = filterFns.includes((row: Person) => row.name);

  it('returns true when field includes value (case-insensitive)', () => {
    expect(fn(alice, 'alice')).toBe(true);
    expect(fn(alice, 'SMITH')).toBe(true);
    expect(fn(carol, 'CAROL')).toBe(true);
  });

  it('returns false when field does not include value', () => {
    expect(fn(bob, 'alice')).toBe(false);
  });

  it('returns true for empty string (matches everything)', () => {
    expect(fn(alice, '')).toBe(true);
  });
});

describe('filterFns.equals', () => {
  const fn = filterFns.equals((row: Person) => row.status);

  it('returns true on exact match', () => {
    expect(fn(alice, 'active')).toBe(true);
  });

  it('returns false on non-match', () => {
    expect(fn(bob, 'active')).toBe(false);
  });

  it('works with numbers', () => {
    const ageFn = filterFns.equals((row: Person) => row.age);
    expect(ageFn(alice, 28)).toBe(true);
    expect(ageFn(bob, 28)).toBe(false);
  });
});

describe('filterFns.inRange', () => {
  const fn = filterFns.inRange((row: Person) => row.age);

  it('returns true when value is within inclusive range', () => {
    expect(fn(alice, { min: 20, max: 30 })).toBe(true);
    expect(fn(alice, { min: 28, max: 28 })).toBe(true);
  });

  it('returns false when value is below min', () => {
    expect(fn(bob, { min: 20, max: 30 })).toBe(false);
  });

  it('returns false when value is above max', () => {
    expect(fn(carol, { min: 20, max: 30 })).toBe(false);
  });

  it('handles half-open range (min only)', () => {
    expect(fn(carol, { min: 30 })).toBe(true);
    expect(fn(bob, { min: 30 })).toBe(false);
  });

  it('handles half-open range (max only)', () => {
    expect(fn(bob, { max: 18 })).toBe(true);
    expect(fn(carol, { max: 18 })).toBe(false);
  });

  it('passes all rows when range is empty object', () => {
    expect(fn(alice, {})).toBe(true);
    expect(fn(bob, {})).toBe(true);
    expect(fn(carol, {})).toBe(true);
  });
});

describe('filterFns.inArray', () => {
  const fn = filterFns.inArray((row: Person) => row.status);

  it('returns true when field value is in filter array', () => {
    expect(fn(alice, ['active', 'pending'])).toBe(true);
  });

  it('returns false when field value is not in filter array', () => {
    expect(fn(bob, ['active', 'pending'])).toBe(false);
  });

  it('returns false for empty filter array', () => {
    expect(fn(alice, [])).toBe(false);
  });
});

describe('filterFns.startsWith', () => {
  const fn = filterFns.startsWith((row: Person) => row.name);

  it('returns true when field starts with value (case-insensitive)', () => {
    expect(fn(carol, 'carol')).toBe(true);
    expect(fn(carol, 'CAROL')).toBe(true);
    expect(fn(alice, 'alice')).toBe(true);
  });

  it('returns false when field does not start with value', () => {
    expect(fn(alice, 'smith')).toBe(false);
    expect(fn(bob, 'alice')).toBe(false);
  });

  it('returns true for empty string (matches everything)', () => {
    expect(fn(alice, '')).toBe(true);
  });
});
