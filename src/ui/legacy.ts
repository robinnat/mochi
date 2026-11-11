/**
 * Old ids still accepted by the library.
 *
 * The `pixel` attribute of `<mochi-bot>` once took a `large` size (removed on 11/11/2026) and, before that, French ids.
 * A page written for an older version keeps working: `effectivePixel` (`renderStyle.ts`) reads the old value through
 * this table.
 */

/**
 * Old pixel size id -> new pixel size id. The `large` size was removed on 11/11/2026: it becomes `medium`, the closest
 * size left (and the French `gros` with it).
 */
export const LEGACY_PIXEL_SIZES: Record<string, string> = { gros: 'medium', large: 'medium', moyen: 'medium', fin: 'fine' }
