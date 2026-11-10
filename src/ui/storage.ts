import { migrateLegacyStorage } from './legacy'

/**
 * `localStorage` keys, in one place.
 *
 * The prefix carries the product name: it is a shared constant and not a string copied at every call, otherwise the
 * next rename would forget one and users would lose their settings without any sign.
 *
 * Older versions saved French keys and ids (`mochi:forme` = `etoile`): `legacy.ts` moves them to the new names on the
 * first read, so a returning visitor keeps their Mochi.
 */
const PREFIX = 'mochi:'

/** Everything the app saves. */
const NAMES = ['cycles', 'cycle', 'shape', 'color', 'expression', 'language', 'style', 'pixel', 'outline'] as const

export type NameStored = (typeof NAMES)[number]

/** `key('cycles')` -> `'mochi:cycles'`. */
export function key(name: NameStored): string {
  return `${PREFIX}${name}`
}

let migrated = false

/** Runs the migration of old keys once per page. */
function migrateOnce() {
  if (migrated) return
  migrated = true
  migrateLegacyStorage(localStorage, PREFIX)
}

/** @internal tests only: run the migration again on the next read. */
export function resetMigrationForTests() {
  migrated = false
}

/**
 * GUARDED read of the storage.
 *
 * Touching `localStorage` can throw, not only fail: when access is denied (Chrome set to "block all cookies", a
 * third-party iframe, a company policy) merely reading the property raises a `SecurityError`. Everything the app
 * reads back is read while modules load, so the exception used to break `App.ts` and the page stayed BLANK.
 *
 * We lose persistence, never the app.
 */
export function read(name: NameStored): string | null {
  try {
    migrateOnce()
    return localStorage.getItem(key(name))
  } catch {
    return null
  }
}

/**
 * GUARDED write to the storage.
 *
 * Same reason as reading, plus the quota: `setItem` can raise `QuotaExceededError`.
 */
export function write(name: NameStored, value: string) {
  try {
    localStorage.setItem(key(name), value)
  } catch {
    // storage denied or full: carry on without saving
  }
}
