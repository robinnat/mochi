import { h, type Component } from '@/ui/dom/h'
import 'mochis'
import type { Softness, Material, RenderStyleId } from 'mochis'
import { sizeCell } from './width'

/**
 * `#shapes3d` : l'aplat (ancien defaut, sans puis avec contour cartoon) et la matiere `soft` (ombrage
 * lisse, deux reglages : leger et marque), sur cinq formes. `?s=<size>` ; `?t=<date>` fige l'image ; `?c=<color>`
 * impose une seule couleur ; `?v=rows` met un style par LIGNE et une forme par colonne (portrait, lisible sur
 * telephone). `?x=1,3,4` ne garde que ces variantes, `?f=star` (ou `?f=circle,star,cloud`) que ces formes.
 */
interface Variant {
  letter: string
  name: string
  renderStyle: RenderStyleId
  material?: Material
  softness?: Softness
  outline?: boolean
  highlight?: boolean
}
const ALL: Variant[] = [
  { letter: '', name: '3D aplat (ancien)', renderStyle: '3d', material: 'flat', outline: false },
  { letter: '', name: '3D aplat + contour cartoon', renderStyle: '3d', material: 'flat', outline: true },
  { letter: '', name: '3D doux (leger)', renderStyle: '3d', material: 'soft', softness: 'light', outline: false },
  { letter: '', name: '3D doux strong + reflet (defaut)', renderStyle: '3d', material: 'soft', softness: 'strong', outline: false },
  { letter: '', name: '3D doux strong sans reflet', renderStyle: '3d', material: 'soft', softness: 'strong', outline: false, highlight: false }
]
// cinq formes, chacune dans une couleur du flat (les memes que le personnalisateur)
const ALL_SHAPES = [
  { id: 'circle', color: 'violet' },
  { id: 'star', color: 'amber' },
  { id: 'cloud', color: 'pink' },
  { id: 'flower', color: 'turquoise' },
  { id: 'drop', color: 'blue' }
]

const key = (f: { id: string }, v: Variant) =>
  `${f.id}-${v.material ?? 'flat'}${v.softness ? '-' + v.softness : ''}${v.outline ? '-contour' : ''}${v.highlight === false ? '-sansreflet' : ''}`

export const FlatSheet3d: Component<Record<string, never>> = () => {
  const q = new URLSearchParams(location.search)
  const kept = q.get('x')?.split(',').map(Number)
  const VARIANTS = kept ? ALL.filter((_, i) => kept.includes(i)) : ALL
  const SHAPE_LIST = q.get('f') ? ALL_SHAPES.filter((f) => q.get('f')!.split(',').includes(f.id)) : ALL_SHAPES
  const t = Number(q.get('t')) || 1.2
  const forced = q.get('c')
  const rows = q.get('v') === 'rows'
  const size = rows ? sizeCell(150, SHAPE_LIST.length, 120, 4) : sizeCell(150, VARIANTS.length, 70, 8)

  const bot = (f: (typeof ALL_SHAPES)[number], v: Variant, k: string) =>
    h('mochi-bot', {
      key: k,
      size: size,
      shape: f.id,
      color: forced ?? f.color,
      renderStyle: v.renderStyle,
      material: v.material,
      softness: v.softness,
      outline: v.outline,
      highlight: v.highlight,
      frozenAt: t,
      cycle: [{ state: 'idle', duration: 3 }],
      'data-cell': key(f, v)
    })
  const header = (v: Variant, big: string) => [
    v.letter ? h('div', { key: 'l', class: `${big} font-black` }, v.letter) : null,
    h('div', { key: 'n', class: ['text-xs font-semibold', v.letter ? '' : 'text-[var(--muted)]'] }, v.name)
  ]

  return () =>
    h(
      'main',
      { class: 'p-4' },
      h('h1', { class: 'mb-3 text-lg font-bold' }, '3D : aplat, doux leger, doux strong'),
      h(
        'div',
        { class: 'max-w-full overflow-x-auto' },
        rows
          ? // une variante par ligne, une forme par colonne : portrait
            h(
              'div',
              { class: 'grid items-center gap-x-1 gap-y-1', style: { gridTemplateColumns: `120px repeat(${SHAPE_LIST.length}, ${size}px)` } },
              h('div'),
              SHAPE_LIST.map((f) => h('div', { key: f.id, class: 'text-center text-xs text-[var(--muted)]' }, f.id)),
              VARIANTS.map((v) => [
                h('div', { key: 'e' + v.name, class: 'leading-tight', 'data-header': '' }, header(v, 'text-4xl')),
                SHAPE_LIST.map((f) => bot(f, v, v.name + f.id))
              ])
            )
          : // une variante par colonne, une forme par ligne
            h(
              'div',
              { class: 'grid items-center gap-x-2 gap-y-1', style: { gridTemplateColumns: `70px repeat(${VARIANTS.length}, ${size}px)` } },
              h('div'),
              VARIANTS.map((v) => h('div', { key: v.name, class: 'text-center leading-tight', 'data-header': '' }, header(v, 'text-3xl'))),
              SHAPE_LIST.map((f) => [h('div', { key: 'e' + f.id, class: 'text-xs text-[var(--muted)]' }, f.id), VARIANTS.map((v) => bot(f, v, f.id + v.name))])
            )
      )
    )
}
