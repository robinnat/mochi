import { h, type Composant } from '@/ui/dom/h'
import 'mochi-world'
import type { Douceur, Rendu3d, RenduId } from 'mochi-world'
import { tailleCellule } from './largeur'

/**
 * `#formes3d` : l'aplat (ancien defaut, sans puis avec contour cartoon) et la matiere `doux` (ombrage
 * lisse, deux reglages : leger et marque), sur cinq formes. `?s=<taille>` ; `?t=<date>` fige l'image ; `?c=<couleur>`
 * impose une seule couleur ; `?v=lignes` met un style par LIGNE et une forme par colonne (portrait, lisible sur
 * telephone). `?x=1,3,4` ne garde que ces variantes, `?f=etoile` (ou `?f=cercle,etoile,nuage`) que ces formes.
 */
interface Variante {
  lettre: string
  nom: string
  rendu: RenduId
  rendu3d?: Rendu3d
  douceur?: Douceur
  contour?: boolean
  reflet?: boolean
}
const TOUTES: Variante[] = [
  { lettre: '', nom: '3D aplat (ancien)', rendu: '3d', rendu3d: 'aplat', contour: false },
  { lettre: '', nom: '3D aplat + contour cartoon', rendu: '3d', rendu3d: 'aplat', contour: true },
  { lettre: '', nom: '3D doux (leger)', rendu: '3d', rendu3d: 'doux', douceur: 'leger', contour: false },
  { lettre: '', nom: '3D doux marque + reflet (defaut)', rendu: '3d', rendu3d: 'doux', douceur: 'marque', contour: false },
  { lettre: '', nom: '3D doux marque sans reflet', rendu: '3d', rendu3d: 'doux', douceur: 'marque', contour: false, reflet: false }
]
// cinq formes, chacune dans une couleur du flat (les memes que le personnalisateur)
const TOUTES_FORMES = [
  { id: 'cercle', couleur: 'violet' },
  { id: 'etoile', couleur: 'ambre' },
  { id: 'nuage', couleur: 'rose' },
  { id: 'fleur', couleur: 'turquoise' },
  { id: 'goutte', couleur: 'bleu' }
]

const cle = (f: { id: string }, v: Variante) =>
  `${f.id}-${v.rendu3d ?? 'flat'}${v.douceur ? '-' + v.douceur : ''}${v.contour ? '-contour' : ''}${v.reflet === false ? '-sansreflet' : ''}`

export const Planche3dFlat: Composant<Record<string, never>> = () => {
  const q = new URLSearchParams(location.search)
  const gardees = q.get('x')?.split(',').map(Number)
  const VARIANTES = gardees ? TOUTES.filter((_, i) => gardees.includes(i)) : TOUTES
  const FORMES = q.get('f') ? TOUTES_FORMES.filter((f) => q.get('f')!.split(',').includes(f.id)) : TOUTES_FORMES
  const t = Number(q.get('t')) || 1.2
  const imposee = q.get('c')
  const lignes = q.get('v') === 'lignes'
  const taille = lignes ? tailleCellule(150, FORMES.length, 120, 4) : tailleCellule(150, VARIANTES.length, 70, 8)

  const bot = (f: (typeof TOUTES_FORMES)[number], v: Variante, k: string) =>
    h('mochi-bot', {
      key: k,
      size: taille,
      shape: f.id,
      color: imposee ?? f.couleur,
      rendu: v.rendu,
      rendu3d: v.rendu3d,
      douceur: v.douceur,
      contour: v.contour,
      reflet: v.reflet,
      frozenAt: t,
      cycle: [{ state: 'idle', duration: 3 }],
      'data-cell': cle(f, v)
    })
  const entete = (v: Variante, grand: string) => [
    v.lettre ? h('div', { key: 'l', class: `${grand} font-black` }, v.lettre) : null,
    h('div', { key: 'n', class: ['text-xs font-semibold', v.lettre ? '' : 'text-[var(--muted)]'] }, v.nom)
  ]

  return () =>
    h(
      'main',
      { class: 'p-4' },
      h('h1', { class: 'mb-3 text-lg font-bold' }, '3D : aplat, doux leger, doux marque'),
      h(
        'div',
        { class: 'max-w-full overflow-x-auto' },
        lignes
          ? // une variante par ligne, une forme par colonne : portrait
            h(
              'div',
              { class: 'grid items-center gap-x-1 gap-y-1', style: { gridTemplateColumns: `120px repeat(${FORMES.length}, ${taille}px)` } },
              h('div'),
              FORMES.map((f) => h('div', { key: f.id, class: 'text-center text-xs text-[var(--muted)]' }, f.id)),
              VARIANTES.map((v) => [
                h('div', { key: 'e' + v.nom, class: 'leading-tight', 'data-entete': '' }, entete(v, 'text-4xl')),
                FORMES.map((f) => bot(f, v, v.nom + f.id))
              ])
            )
          : // une variante par colonne, une forme par ligne
            h(
              'div',
              { class: 'grid items-center gap-x-2 gap-y-1', style: { gridTemplateColumns: `70px repeat(${VARIANTES.length}, ${taille}px)` } },
              h('div'),
              VARIANTES.map((v) => h('div', { key: v.nom, class: 'text-center leading-tight', 'data-entete': '' }, entete(v, 'text-3xl'))),
              FORMES.map((f) => [h('div', { key: 'e' + f.id, class: 'text-xs text-[var(--muted)]' }, f.id), VARIANTES.map((v) => bot(f, v, f.id + v.nom))])
            )
      )
    )
}
