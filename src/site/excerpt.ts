import { SLOTS, ACCESSORY_BY_KEY, type RenderStyleId, type AccessorySelection } from 'mochis/catalogue'

export interface OptionsExtrait {
  shape: string
  color: string
  renderStyle: RenderStyleId
  /** contour : options du PAQUET, plus exposees sur le site (06/11/2026) ; absent = pas de contour */
  outline?: boolean
  /** epaisseur du contour (facteur, 1 = defaut) ; ecrite seulement si elle differe et si le contour est actif */
  thickness?: number
  /** reflet doux du 3D Soft : actif de base, `false` seulement pour le code qui le coupe */
  highlight?: boolean
  mood: string
  /** accessoires par emplacement, avec leurs couleurs */
  accessories: AccessorySelection
  /** `auto` : rien a ecrire, Mochi suit la page */
  theme: 'auto' | 'light' | 'dark'
  /** ordinateur du mood `working` (defaut : oui) */
  laptop: boolean
  size?: number
}

/** `{ head: 'cap' }` quand les couleurs sont celles du catalogue, sinon `{ id, c1, c2 }` (seulement ce qui change). */
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

/** Meme selection en JSON, pour l'attribut `accessories` de `<mochi-bot>` (seulement ce qui change du catalogue). */
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
 * L'extrait de code montre par la section « Make it yours » : la balise `<mochi-bot>` en HTML (valable telle quelle
 * dans n'importe quel framework), seulement ce qui differe des valeurs par defaut.
 */
export function extraitCode(o: OptionsExtrait): string {
  const l = [`  shape="${o.shape}"`, `  color="${o.color}"`]
  if (o.renderStyle !== '3d') l.push(`  renderStyle="${o.renderStyle}"`)
  if (o.outline) {
    l.push('  contour')
    if (o.thickness !== undefined && Math.abs(o.thickness - 1) > 1e-6) l.push(`  outline-width="${Number(o.thickness.toFixed(2))}"`)
  }
  if (o.renderStyle === '3d' && o.highlight === false) l.push('  reflet="false"')
  l.push(`  mood="${o.mood}"`)
  if (o.mood === 'working' && !o.laptop) l.push('  ordinateur="false"')
  const acc = accessoriesAsJson(o.accessories)
  if (acc) l.push(`  accessories='${acc}'`)
  if (o.theme !== 'auto') l.push(`  theme="${o.theme}"`)
  l.push(`  size="${o.size ?? 260}"`)
  return `<mochi-bot\n${l.join('\n')}\n></mochi-bot>`
}
