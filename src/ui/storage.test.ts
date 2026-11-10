import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { key, write, read, resetMigrationForTests } from './storage'
import { LEGACY_COLORS, LEGACY_EXPRESSIONS, LEGACY_PIXEL_SIZES, LEGACY_SHAPES, migrateLegacyStorage } from './legacy'
import { COLOR_BY_ID, SHAPE_BY_ID } from '@/bot/skins'
import { EXPRESSION_BY_ID } from '@/bot/expressions'
import { isPixelSize } from '@/ui/renderStyle'

/**
 * The storage guard.
 *
 * What is locked here is not persistence: it is that the app STARTS when storage is denied. Everything it reads back
 * is read while modules load, and touching `localStorage` can raise a `SecurityError` (Chrome set to "block all
 * cookies", a third-party iframe, a company policy). The exception used to break `App.ts` and the page stayed blank.
 */

/** A `localStorage` that refuses everything, like when access is blocked. */
function forbidden() {
  const throws = () => {
    throw new DOMException('access denied', 'SecurityError')
  }
  vi.stubGlobal('localStorage', {
    get length(): number {
      return throws()
    },
    getItem: throws,
    setItem: throws,
    removeItem: throws,
    clear: throws,
    key: throws
  })
}

/** A working `localStorage` backed by a Map. */
function memory(initial: Record<string, string> = {}) {
  const heap = new Map<string, string>(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => heap.get(k) ?? null,
    setItem: (k: string, v: string) => void heap.set(k, v),
    removeItem: (k: string) => void heap.delete(k)
  })
  return heap
}

beforeEach(() => resetMigrationForTests())
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('storage guard', () => {
  it('prefixes keys with the product name', () => {
    expect(key('cycles')).toBe('mochi:cycles')
  })

  it('returns `null` instead of throwing when reading is denied', () => {
    forbidden()
    expect(() => read('cycles')).not.toThrow()
    expect(read('cycles')).toBeNull()
  })

  it('does not throw when writing is denied', () => {
    forbidden()
    expect(() => write('cycles', '[]')).not.toThrow()
  })

  /** The quota is the other way to fail, and it happens on an ALLOWED storage. */
  it('does not throw when the quota is exceeded', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
      removeItem: () => {}
    })
    expect(() => write('cycles', '[]')).not.toThrow()
  })

  it('really reads and writes when the storage answers', () => {
    const heap = memory()
    write('shape', 'drop')
    expect(heap.get('mochi:shape')).toBe('drop')
    expect(read('shape')).toBe('drop')
    expect(read('color')).toBeNull()
  })
})

describe('migration of settings saved with the old French ids', () => {
  it('moves the old keys to the new names and translates their values', () => {
    const heap = memory({
      'mochi:forme': 'etoile',
      'mochi:couleur': 'ambre',
      'mochi:langue': 'fr',
      'mochi:contour': '1',
      'mochi:expression': 'heureux',
      'mochi:pixel': 'moyen',
      'mochi:cycles': '[{"id":"c1","name":"Mon cycle","blocks":[{"state":"idle","duration":2}]}]'
    })
    expect(read('shape')).toBe('star')
    expect(read('color')).toBe('amber')
    expect(read('language')).toBe('fr')
    expect(read('outline')).toBe('1')
    expect(read('expression')).toBe('happy')
    expect(read('pixel')).toBe('medium')
    // montages are kept untouched (their state ids were already English)
    expect(read('cycles')).toContain('Mon cycle')
    // the old keys are gone: the migration runs once
    expect([...heap.keys()].filter((k) => /forme|couleur|langue|contour/.test(k))).toEqual([])
  })

  it('never overwrites a value already saved under the new name', () => {
    const heap = memory({ 'mochi:forme': 'etoile', 'mochi:shape': 'cloud' })
    expect(read('shape')).toBe('cloud')
    expect(heap.has('mochi:forme')).toBe(false)
  })

  it('also translates old ids saved under keys that kept their name', () => {
    memory({ 'mochi:shape': 'coeur', 'mochi:color': 'rose' })
    expect(read('shape')).toBe('heart')
    expect(read('color')).toBe('pink')
  })

  it('moves the British spelling grey to gray', () => {
    memory({ 'mochi:color': 'grey' })
    expect(read('color')).toBe('gray')
  })

  it('moves the French gris to gray', () => {
    memory({ 'mochi:couleur': 'gris' })
    expect(read('color')).toBe('gray')
  })

  it('changes nothing when there is nothing old (safe to run again)', () => {
    const heap = new Map([['mochi:shape', 'star']])
    const store = { getItem: (k: string) => heap.get(k) ?? null, setItem: vi.fn(), removeItem: vi.fn() }
    migrateLegacyStorage(store, 'mochi:')
    expect(store.setItem).not.toHaveBeenCalled()
    expect(store.removeItem).not.toHaveBeenCalled()
  })

  it('every old id maps to an id that exists today', () => {
    for (const v of Object.values(LEGACY_SHAPES)) expect(SHAPE_BY_ID.has(v), v).toBe(true)
    for (const v of Object.values(LEGACY_COLORS)) expect(COLOR_BY_ID.has(v), v).toBe(true)
    for (const v of Object.values(LEGACY_EXPRESSIONS)) expect(EXPRESSION_BY_ID.has(v), v).toBe(true)
    for (const v of Object.values(LEGACY_PIXEL_SIZES)) expect(isPixelSize(v), v).toBe(true)
  })
})
