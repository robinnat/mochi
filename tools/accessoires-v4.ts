import { BotEngine } from '../src/bot/engine'
import { RAYON } from '../src/bot/repere'
import { COLORS, SHAPES } from '../src/bot/skins'
import {
  CATALOGUE,
  COULEURS,
  EMPLACEMENTS,
  NOMS_EMPLACEMENTS,
  resoudre,
  type Emplacement,
  type Selection
} from '../src/bot/emplacements'
import type { Rendu3d } from '../src/ui/trois/rendu3d'

/** Planches de la v4 (accessoires simplifies, une ou deux couleurs, personnalisables). Rend les planches : un seul contexte WebGL, des cellules recopiees dans un canvas 2D. */
const q = new URLSearchParams(location.search)
const FOND = '#faf8f3'
const ENCRE = '#26222f'
const GRIS = '#8a8794'
const PAPIER = '#f9f9f9'

const hexDe = (id: string) => COLORS.find((c) => c.id === id)!.hex
const distance = (a: string, b: string) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const x = p(a)
  const y = p(b)
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!)
}

/** Couleurs de corps qui ressortent contre les couleurs de l'accessoire. */
function corpsPour(couleurs: string[], n: number, decalage: number): string[] {
  const candidats = ['turquoise', 'ambre', 'rose', 'bleu', 'vert', 'orange', 'violet'].map(hexDe)
  const bons = candidats.filter((h) => couleurs.every((c) => distance(h, c) > 110))
  const liste = bons.length >= n ? bons : candidats
  return Array.from({ length: n }, (_, i) => liste[(i + decalage) % liste.length]!)
}

const NOMS_FORMES: Record<string, string> = {
  cercle: 'rond',
  etoile: 'étoile',
  squircle: 'cube',
  nuage: 'nuage',
  triangle: 'pyramide',
  hexagone: 'hexagone',
  goutte: 'goutte',
  oeuf: 'œuf',
  fleur: 'fleur',
  capsule: 'capsule',
  galet: 'galet'
}

let rendreAvatar: typeof import('../src/ui/trois/scene3d').rendreAvatar
const images = new Map<string, ReturnType<BotEngine['sample']>>()
function image(forme: string) {
  let f = images.get(forme)
  if (!f) {
    f = new BotEngine(RAYON, 'idle', SHAPES.find((s) => s.id === forme)!.radii, null).sample(1.2)
    images.set(forme, f)
  }
  return f
}

interface Cellule {
  forme: string
  couleur: string
  sel: Selection
  yaw?: number
  rendu?: Rendu3d
  cadre?: number
}

/** Dessine un Mochi (3D temps reel) dans le canvas de la planche, carre de `px` en (x, y). */
function cellule(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, c: Cellule) {
  const t = document.createElement('canvas')
  t.width = t.height = px
  rendreAvatar(t, image(c.forme), c.couleur, PAPIER, c.rendu ?? 'doux', false, 'marque', true, c.forme, c.yaw ?? 0, null, c.sel, c.cadre ?? 175)
  ctx.drawImage(t, x, y)
}

function texte(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, taille: number, couleur = ENCRE, gras = false, align: CanvasTextAlign = 'left') {
  ctx.font = `${gras ? '700' : '500'} ${taille}px -apple-system, Helvetica, Arial, sans-serif`
  ctx.fillStyle = couleur
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(s, x, y)
}

const W = 1080
const CORPS = hexDe('bleu')

/** Demi-largeur du cadre par accessoire : les coiffes hautes en demandent plus pour ne jamais etre coupees en haut. */
const CADRES: Record<string, number> = {
  toque: 235,
  antenne: 250,
  'haut-de-forme': 240,
  couronne: 215,
  bonnet: 220,
  beret: 205,
  casquette: 205,
  paille: 250,
  casque: 215,
  ruban: 205,
  fleur: 205,
  ailes: 280,
  diable: 280,
  queue: 235,
  cape: 235,
  sac: 215
}
const cadreDe = (e: Emplacement, id: string) => Math.round((CADRES[id] ?? (e === 'tete' ? 215 : 185)) * (e === 'dos' ? 0.95 : 0.86))
const YAW: Record<Emplacement, number> = { tete: 0.3, yeux: 0.25, visage: 0.25, bas: 0.25, dos: 0.75 }

function nouvelle(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = FOND
  ctx.fillRect(0, 0, w, h)
  return { c, ctx }
}

/** Planche du catalogue : tous les accessoires, un par case, meme forme (rond) et meme couleur de corps. */
function planCatalogue() {
  const cols = 4
  const cell = W / cols
  const ligne = cell + 56
  const rows = Math.ceil(CATALOGUE.length / cols)
  const { c, ctx } = nouvelle(W, 150 + rows * ligne + 20)
  texte(ctx, 'Catalogue v4', 40, 78, 58, ENCRE, true)
  texte(ctx, `${CATALOGUE.length} accessoires · une couleur, deux au maximum · même forme, même corps`, 40, 122, 26, GRIS)
  CATALOGUE.forEach((a, i) => {
    const x = (i % cols) * cell
    const y = 150 + Math.floor(i / cols) * ligne
    cellule(ctx, x, y, cell, { forme: 'cercle', couleur: CORPS, sel: { [a.emplacement]: a.id }, cadre: cadreDe(a.emplacement, a.id), yaw: YAW[a.emplacement] })
    texte(ctx, a.nom, x + cell / 2, y + cell + 24, 22, ENCRE, true, 'center')
    texte(ctx, NOMS_EMPLACEMENTS[a.emplacement], x + cell / 2, y + cell + 46, 17, GRIS, false, 'center')
  })
  return c
}

/** Personnalisation : cinq accessoires, chacun dans quatre couleurs (c1, et c2 pour la fleur). */
function planCouleurs() {
  const P = COULEURS
  const lignes: Array<{ nom: string; e: Emplacement; id: string; choix: Array<{ c1: string; c2?: string }> }> = [
    { nom: 'Nœud papillon (une couleur)', e: 'bas', id: 'papillon', choix: [{ c1: P.noir }, { c1: P.rouge }, { c1: P.bleu }, { c1: P.rose }] },
    { nom: 'Casque de musique (une couleur)', e: 'tete', id: 'casque', choix: [{ c1: P.rouge }, { c1: P.noir }, { c1: P.turquoise }, { c1: P.violet }] },
    { nom: 'Fleur (pétales + cœur)', e: 'tete', id: 'fleur', choix: [{ c1: P.rose, c2: P.jaune }, { c1: P.creme, c2: P.orange }, { c1: P.violet, c2: P.jaune }, { c1: P.rouge, c2: P.creme }] },
    { nom: 'Cravate (une couleur)', e: 'bas', id: 'cravate', choix: [{ c1: P.marine }, { c1: P.rouge }, { c1: P.vert }, { c1: P.jaune }] },
    { nom: 'Cape (une couleur)', e: 'dos', id: 'cape', choix: [{ c1: P.rouge }, { c1: P.violet }, { c1: P.vert }, { c1: P.noir }] }
  ]
  const cell = W / 4
  const ligne = cell + 70
  const { c, ctx } = nouvelle(W, 150 + lignes.length * ligne + 20)
  texte(ctx, 'Personnalisation', 40, 78, 58, ENCRE, true)
  texte(ctx, 'Même accessoire, quatre couleurs : c1 et, si besoin, c2 réglables par l’API', 40, 122, 26, GRIS)
  lignes.forEach((l, i) => {
    const y0 = 150 + i * ligne
    texte(ctx, l.nom, 40, y0 + 30, 30, ENCRE, true)
    l.choix.forEach((ch, k) => {
      cellule(ctx, k * cell, y0 + 34, cell, { forme: 'cercle', couleur: l.id === 'cape' || l.id === 'cravate' ? hexDe('ambre') : hexDe('turquoise'), sel: { [l.e]: { id: l.id, ...ch } }, cadre: cadreDe(l.e, l.id), yaw: YAW[l.e] })
      texte(ctx, ch.c2 ? `${ch.c1} + ${ch.c2}` : ch.c1, k * cell + cell / 2, y0 + ligne - 8, 18, GRIS, false, 'center')
    })
  })
  return c
}

/** Vues : face, 3/4, profil, dos pour le noeud papillon, la queue, la cape et la cravate. */
function planVues() {
  const lignes: Array<{ nom: string; sel: Selection; forme: string; couleur: string; cadre: number }> = [
    { nom: 'Nœud papillon', sel: { bas: 'papillon' }, forme: 'cercle', couleur: hexDe('ambre'), cadre: 170 },
    { nom: 'Queue', sel: { dos: 'queue' }, forme: 'squircle', couleur: hexDe('turquoise'), cadre: 235 },
    { nom: 'Cape', sel: { dos: 'cape' }, forme: 'oeuf', couleur: hexDe('bleu'), cadre: 235 },
    { nom: 'Cravate', sel: { bas: 'cravate' }, forme: 'squircle', couleur: hexDe('orange'), cadre: 185 }
  ]
  const vues = [
    { yaw: 0, nom: 'face' },
    { yaw: 0.62, nom: '3/4' },
    { yaw: 1.5708, nom: 'profil' },
    { yaw: 3.1416, nom: 'dos' }
  ]
  const cell = W / 4
  const ligne = cell + 70
  const { c, ctx } = nouvelle(W, 150 + lignes.length * ligne + 20)
  texte(ctx, 'Vues : face, 3/4, profil, dos', 40, 78, 52, ENCRE, true)
  texte(ctx, 'Le corps tourne, la lumière reste en haut à gauche', 40, 122, 26, GRIS)
  lignes.forEach((t, i) => {
    const y0 = 150 + i * ligne
    texte(ctx, t.nom, 40, y0 + 30, 32, ENCRE, true)
    vues.forEach((v, k) => {
      cellule(ctx, k * cell, y0 + 34, cell, { forme: t.forme, couleur: t.couleur, sel: t.sel, yaw: v.yaw, cadre: t.cadre })
      texte(ctx, v.nom, k * cell + cell / 2, y0 + ligne - 8, 20, GRIS, false, 'center')
    })
  })
  return c
}

/** Alfred : le Mochi pyramide jaune, lunettes rondes noires et noeud papillon noir, a cote de la reference. */
async function planAlfred() {
  const ref = new Image()
  ref.crossOrigin = 'anonymous'
  await new Promise<void>((ok, ko) => {
    ref.onload = () => ok()
    ref.onerror = () => ko(new Error('reference introuvable'))
    ref.src = `${new URL(q.get('save')!).origin}/ref/alfred.png`
  })
  const cell = 520
  const { c, ctx } = nouvelle(W, 150 + cell + 120)
  texte(ctx, 'Comparaison avec Alfred', 40, 78, 54, ENCRE, true)
  texte(ctx, 'Mêmes lunettes rondes noires, même nœud papillon noir tout en bas', 40, 122, 26, GRIS)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 150, cell, cell)
  ctx.drawImage(ref, 0, 150 + (cell - ref.height * (cell / ref.width)) / 2, cell, ref.height * (cell / ref.width))
  texte(ctx, 'Référence (Alfred)', cell / 2, 150 + cell + 40, 28, ENCRE, true, 'center')
  cellule(ctx, cell + 40, 150, cell, { forme: 'triangle', couleur: hexDe('ambre'), sel: { yeux: 'rondes', bas: 'papillon' }, cadre: 150, yaw: 0 })
  texte(ctx, 'Mochi pyramide', cell + 40 + cell / 2, 150 + cell + 40, 28, ENCRE, true, 'center')
  return c
}

/** Six combinaisons. */
function planCombos() {
  const defs: Cellule[] = [
    combo('cercle', hexDe('turquoise'), { tete: 'casquette', yeux: 'rondes', visage: 'joues', bas: 'papillon' }),
    combo('triangle', hexDe('ambre'), { yeux: 'rondes', bas: 'papillon' }, 0),
    combo('squircle', hexDe('rose'), { tete: 'fleur', yeux: 'soleil', dos: 'cape' }),
    combo('oeuf', hexDe('violet'), { tete: 'toque', visage: 'moustache', bas: 'cravate', dos: 'queue' }),
    combo('etoile', hexDe('orange'), { tete: 'couronne', yeux: 'carrees', bas: 'echarpe' }, 0.35),
    combo('nuage', hexDe('bleu'), { tete: 'haut-de-forme', yeux: 'monocle', visage: 'moustache', bas: 'fleurs' })
  ]
  const cell = 540
  const lh = 100
  const { c, ctx } = nouvelle(W, 150 + (defs.length / 2) * (cell + lh) + 20)
  texte(ctx, 'Combinaisons', 40, 78, 58, ENCRE, true)
  texte(ctx, 'Les emplacements se cumulent, chaque accessoire reste simple', 40, 122, 26, GRIS)
  defs.forEach((d, i) => {
    const x = (i % 2) * cell
    const y = 150 + Math.floor(i / 2) * (cell + lh)
    cellule(ctx, x, y, cell, d)
    ctx.font = '700 24px -apple-system, Helvetica, Arial, sans-serif'
    const lignesTxt: string[] = []
    let cur = ''
    for (const n of nomsDe(d.sel)) {
      const essai = cur ? `${cur} + ${n}` : n
      if (cur && ctx.measureText(essai).width > cell - 40) {
        lignesTxt.push(cur + ' +')
        cur = n
      } else cur = essai
    }
    if (cur) lignesTxt.push(cur)
    lignesTxt.forEach((l, k) => texte(ctx, l, x + cell / 2, y + cell + 34 + k * 30, 24, ENCRE, true, 'center'))
  })
  return c
}

const combo = (forme: string, couleur: string, sel: Selection, yaw = 0.3): Cellule => ({ forme, couleur, sel, yaw, cadre: 215 })

function nomsDe(sel: Selection) {
  return EMPLACEMENTS.map((e) => resoudre(e, sel[e])?.nom).filter(Boolean) as string[]
}

async function envoyer(nom: string, c: HTMLCanvasElement) {
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
  const dest = q.get('save')
  if (!dest) return
  await fetch(`${dest}?name=${encodeURIComponent(nom)}`, { method: 'POST', body: blob })
}

async function main() {
  ;({ rendreAvatar } = await import('../src/ui/trois/scene3d'))
  const qui = (q.get('planche') ?? 'all').split(',')
  const tout = qui.includes('all')
  const faire: Array<[string, () => HTMLCanvasElement | Promise<HTMLCanvasElement>]> = [
    ['catalogue', planCatalogue],
    ['couleurs', planCouleurs],
    ['vues', planVues],
    ['alfred', planAlfred],
    ['combos', planCombos]
  ]
  for (const [nom, f] of faire) {
    if (!tout && !qui.includes(nom)) continue
    const c = await f()
    await envoyer(`${nom}.png`, c)
    if (!q.get('save')) document.body.appendChild(c)
  }
  document.title = 'fini'
}

main().catch((e) => {
  document.title = 'erreur ' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})
