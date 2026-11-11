/**
 * Migration of the settings saved by older versions of /app.
 *
 * Until November 2026 the public ids were French (`etoile`, `ambre`, `neutre`...) and so were some storage keys
 * (`mochi:forme`, `mochi:couleur`, `mochi:langue`, `mochi:contour`). A visitor who comes back must find their Mochi
 * as they left it, so the first read moves every old key to its new name and translates its value. The old key is
 * removed once copied, so the migration runs once per browser.
 *
 * The first English ids used the British spelling `grey`; the id is now `gray` (American spelling, like the rest of
 * the API), so `grey` is translated too.
 */

/** Old shape id -> new shape id. */
export const LEGACY_SHAPES: Record<string, string> = {
  cercle: 'circle',
  galet: 'pebble',
  hexagone: 'hexagon',
  nuage: 'cloud',
  goutte: 'drop',
  etoile: 'star',
  fleur: 'flower',
  oeuf: 'egg',
  coeur: 'heart'
}

/** Old color id -> new color id. */
export const LEGACY_COLORS: Record<string, string> = {
  encre: 'ink',
  brun: 'brown',
  rouge: 'red',
  corail: 'coral',
  ambre: 'amber',
  citron: 'lime',
  pomme: 'apple',
  vert: 'green',
  ciel: 'sky',
  bleu: 'blue',
  rose: 'pink',
  cerise: 'cherry',
  gris: 'gray',
  grey: 'gray',
  creme: 'cream'
}

/** Old expression id -> new expression id. */
export const LEGACY_EXPRESSIONS: Record<string, string> = {
  neutre: 'neutral',
  attentif: 'attentive',
  surpris: 'surprised',
  excite: 'excited',
  heureux: 'happy',
  hilare: 'laughing',
  colere: 'angry',
  triste: 'sad',
  effraye: 'scared',
  mefiant: 'suspicious',
  confus: 'confused',
  curieux: 'curious',
  fier: 'proud',
  timide: 'shy',
  blase: 'unimpressed',
  somnolent: 'sleepy'
}

/**
 * Old pixel size id -> new pixel size id. The `large` size was removed on 11/11/2026: it becomes `medium`, the closest
 * size left (and the French `gros` with it).
 */
export const LEGACY_PIXEL_SIZES: Record<string, string> = { gros: 'medium', large: 'medium', moyen: 'medium', fin: 'fine' }

/**
 * Settings that no longer exist: removed from the storage on the first read. The cartoon outline option (`outline`,
 * French `contour`) was removed on 11/11/2026; the soft highlight never had a saved setting. The Soft style's
 * `softness` (French `douceur`) was removed the same day: Soft now has a single look; its `shading` is ignored too
 * (Soft is always shaded), but the `shading` setting itself stays, for Flat and Pixel.
 */
export const REMOVED_KEYS = ['contour', 'outline', 'douceur', 'softness']

/** Old storage name -> new storage name and the table that translates its value (none: copied as is). */
const LEGACY_KEYS: Array<{ from: string; to: string; values?: Record<string, string> }> = [
  { from: 'forme', to: 'shape', values: LEGACY_SHAPES },
  { from: 'couleur', to: 'color', values: LEGACY_COLORS },
  { from: 'langue', to: 'language' },
  { from: 'shape', to: 'shape', values: LEGACY_SHAPES },
  { from: 'color', to: 'color', values: LEGACY_COLORS },
  { from: 'expression', to: 'expression', values: LEGACY_EXPRESSIONS },
  { from: 'pixel', to: 'pixel', values: LEGACY_PIXEL_SIZES }
]

/** The small part of `Storage` the migration needs (a fake one in the tests). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * Moves the old keys of `prefix` to their new names and translates old ids. Never overwrites a value already saved
 * under the new name. Safe to call many times: once nothing old is left, it changes nothing.
 */
export function migrateLegacyStorage(store: StorageLike, prefix: string): void {
  for (const name of REMOVED_KEYS) if (store.getItem(prefix + name) !== null) store.removeItem(prefix + name)
  for (const { from, to, values } of LEGACY_KEYS) {
    const old = store.getItem(prefix + from)
    if (old === null) continue
    const value = values?.[old] ?? old
    if (from !== to) {
      if (store.getItem(prefix + to) === null) store.setItem(prefix + to, value)
      store.removeItem(prefix + from)
    } else if (value !== old) {
      store.setItem(prefix + to, value)
    }
  }
}
