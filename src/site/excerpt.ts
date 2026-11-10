import { SLOTS, ACCESSORY_BY_KEY, type RenderStyleId, type AccessorySelection } from 'mochis/catalog'

export interface OptionsExtrait {
  shape: string
  color: string
  renderStyle: RenderStyleId
  /** outline: options of the PACKAGE, no longer shown on the site (06/11/2026); absent = no outline */
  outline?: boolean
  /** outline width (factor, 1 = default); written only if it differs and the outline is on */
  thickness?: number
  /** soft highlight of the Soft 3D: on by default, `false` only for code that turns it off */
  highlight?: boolean
  mood: string
  /** accessories by slot, with their colors */
  accessories: AccessorySelection
  /** `auto`: nothing to write, Mochi follows the page */
  theme: 'auto' | 'light' | 'dark'
  /** laptop of the `working` mood (default: yes) */
  laptop: boolean
  size?: number
}

/** `{ head: 'cap' }` when the colors are the catalog's, else `{ id, c1, c2 }` (only what changes). */
export function accessoriesAsCode(sel: AccessorySelection): string {
  const l: string[] = []
  for (const e of SLOTS) {
    const c = sel[e]
    if (!c) continue
    const id = typeof c === 'string' ? c : c.id
    const def = ACCESSORY_BY_KEY.get(`${e}:${id}`)
    const o: { c1?: string; c2?: string } = typeof c === 'string' ? {} : c
    const fields: string[] = [`id: '${id}'`]
    if (o.c1 && o.c1 !== def?.c1) fields.push(`c1: '${o.c1}'`)
    if (o.c2 && o.c2 !== def?.c2) fields.push(`c2: '${o.c2}'`)
    l.push(fields.length === 1 ? `${e}: '${id}'` : `${e}: { ${fields.join(', ')} }`)
  }
  return l.length ? `{ ${l.join(', ')} }` : ''
}

/**
 * Same selection as JSON, for the `accessories` attribute of `<mochi-bot>` (only what changes from the catalog).
 */
export function accessoriesAsJson(sel: AccessorySelection): string {
  const o: Record<string, string | { id: string; c1?: string; c2?: string }> = {}
  for (const e of SLOTS) {
    const c = sel[e]
    if (!c) continue
    const id = typeof c === 'string' ? c : c.id
    const def = ACCESSORY_BY_KEY.get(`${e}:${id}`)
    const x: { c1?: string; c2?: string } = typeof c === 'string' ? {} : c
    const piece: { id: string; c1?: string; c2?: string } = { id }
    if (x.c1 && x.c1 !== def?.c1) piece.c1 = x.c1
    if (x.c2 && x.c2 !== def?.c2) piece.c2 = x.c2
    o[e] = piece.c1 || piece.c2 ? piece : id
  }
  return Object.keys(o).length ? JSON.stringify(o) : ''
}

/**
 * The code excerpt shown by the "Make it yours" section: the `<mochi-bot>` tag in HTML (valid as is in any
 * framework), only what differs from the default values.
 */
export function extraitCode(o: OptionsExtrait): string {
  const l = [`  shape="${o.shape}"`, `  color="${o.color}"`]
  if (o.renderStyle !== '3d') l.push(`  render-style="${o.renderStyle}"`)
  if (o.outline) {
    l.push('  outline')
    if (o.thickness !== undefined && Math.abs(o.thickness - 1) > 1e-6) l.push(`  outline-width="${Number(o.thickness.toFixed(2))}"`)
  }
  if (o.renderStyle === '3d' && o.highlight === false) l.push('  highlight="false"')
  l.push(`  mood="${o.mood}"`)
  if (o.mood === 'working' && !o.laptop) l.push('  laptop="false"')
  const acc = accessoriesAsJson(o.accessories)
  if (acc) l.push(`  accessories='${acc}'`)
  if (o.theme !== 'auto') l.push(`  theme="${o.theme}"`)
  l.push(`  size="${o.size ?? 260}"`)
  return `<mochi-bot\n${l.join('\n')}\n></mochi-bot>`
}
