import { BotEngine } from '../src/bot/engine'
import { RAYON } from '../src/bot/repere'
import { COLORS, SHAPES } from '../src/bot/skins'
import {
  CATALOGUE,
  EMPLACEMENTS,
  NOMS_EMPLACEMENTS,
  parEmplacement,
  resoudre,
  type Emplacement,
  type Selection
} from '../src/bot/emplacements'
import type { Rendu3d } from '../src/ui/trois/rendu3d'

/** Rend les planches de propositions : un seul contexte WebGL, des cellules recopiees dans un canvas 2D. */
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

function nouvelle(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = FOND
  ctx.fillRect(0, 0, w, h)
  return { c, ctx }
}

const W = 1080
const FORMES_PLANCHE = ['cercle', 'etoile', 'squircle']

/** Planche d'un emplacement : un accessoire par ligne, trois formes. */
const CADRES_TETE: Record<string, number> = { fete: 235, toque: 200, antenne: 215, 'haut-de-forme': 195, couronne: 190 }

function plancheEmplacement(e: Emplacement, cadre: number, yaw: number | number[] = 0, vues?: string[]) {
  const liste = parEmplacement(e)
  const cell = 360
  const entete = 150
  const ligne = cell + 60
  const { c, ctx } = nouvelle(W, entete + liste.length * ligne + 30)
  texte(ctx, NOMS_EMPLACEMENTS[e], 40, 78, 58, ENCRE, true)
  texte(ctx, `${liste.length} propositions · vraie 3D, même éclairage que le corps`, 40, 122, 28, GRIS)
  liste.forEach((a, i) => {
    const y0 = entete + i * ligne
    texte(ctx, `${i + 1}. ${a.nom}`, 40, y0 + 44, 38, ENCRE, true)
    const corps = corpsPour([a.c1, a.c2], 3, i)
    FORMES_PLANCHE.forEach((f, k) => {
      const x = k * cell
      cellule(ctx, x, y0 + 42, cell, { forme: f, couleur: corps[k]!, sel: { [e]: a.id }, cadre: (e === 'tete' && CADRES_TETE[a.id]) || (a.id === 'antenne' ? 195 : cadre), yaw: Array.isArray(yaw) ? yaw[k]! : yaw })
      texte(ctx, NOMS_FORMES[f]! + (vues ? ` · ${vues[k]}` : ''), x + cell / 2, y0 + ligne - 14, 22, GRIS, false, 'center')
    })
  })
  return c
}

const combo = (forme: string, couleur: string, sel: Selection, yaw = 0): Cellule & { sel: Selection } => ({ forme, couleur, sel, yaw, cadre: 205 })

function nomsDe(sel: Selection) {
  return EMPLACEMENTS.map((e) => resoudre(e, sel[e])?.nom).filter(Boolean) as string[]
}

function plancheCombos() {
  const defs = [
    combo('cercle', hexDe('turquoise'), { tete: 'casque', yeux: 'rondes', visage: 'joues', bas: 'papillon', dos: 'cape' }),
    combo('etoile', hexDe('ambre'), { tete: 'fleur', yeux: 'soleil', visage: 'rousseur', bas: 'cravate', dos: 'sac' }),
    combo('squircle', hexDe('rose'), { tete: 'casque', yeux: 'coeur', visage: 'chat', bas: 'echarpe', dos: 'sac' }),
    combo('nuage', hexDe('bleu'), { tete: 'haut-de-forme', yeux: 'monocle', visage: 'moustache', bas: 'perles', dos: 'ailes' }),
    combo('goutte', hexDe('vert'), { tete: 'couronne', yeux: 'carrees', visage: 'rousseur', bas: 'fleurs', dos: 'queue' }),
    combo('hexagone', hexDe('orange'), { tete: 'casque', yeux: 'soleil', visage: 'grain', bas: 'papillon', dos: 'sac' }),
    combo('triangle', hexDe('violet'), { tete: 'paille', yeux: 'etoile', visage: 'joues', bas: 'bandana', dos: 'diable' }),
    combo('oeuf', hexDe('creme'), { tete: 'antenne', yeux: 'sommeil', visage: 'moustache', bas: 'cravate', dos: 'cape' })
  ]
  const cell = 540
  const lh = 215
  const lignes = defs.length / 2
  const { c, ctx } = nouvelle(W, 150 + lignes * (cell + lh - 60) + 20)
  texte(ctx, 'Combinaisons', 40, 78, 58, ENCRE, true)
  texte(ctx, 'Tous les emplacements se cumulent, sans collision', 40, 122, 28, GRIS)
  defs.forEach((d, i) => {
    const x = (i % 2) * cell
    const y = 150 + Math.floor(i / 2) * (cell + lh - 60)
    cellule(ctx, x, y, cell, d)
    // noms sur autant de lignes que necessaire (largeur de la cellule)
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

function planchevues() {
  const lignes: Array<{ nom: string; sel: Selection; forme: string; couleur: string }> = [
    { nom: 'Casque de musique', sel: { tete: 'casque' }, forme: 'cercle', couleur: hexDe('turquoise') },
    { nom: 'Écharpe', sel: { bas: 'echarpe' }, forme: 'squircle', couleur: hexDe('rose') },
    { nom: 'Cravate', sel: { bas: 'cravate' }, forme: 'cercle', couleur: hexDe('orange') },
    { nom: 'Sac à dos', sel: { dos: 'sac' }, forme: 'etoile', couleur: hexDe('turquoise') },
    { nom: 'Cape', sel: { dos: 'cape' }, forme: 'oeuf', couleur: hexDe('bleu') }
  ]
  const vues = [
    { yaw: 0, nom: 'face' },
    { yaw: 0.62, nom: '3/4' },
    { yaw: 1.5708, nom: 'profil' },
    { yaw: 3.1416, nom: 'dos' }
  ]
  const cell = 270
  const ligne = cell + 60
  const { c, ctx } = nouvelle(W, 150 + lignes.length * ligne + 20)
  texte(ctx, 'Vraie 3D : face, 3/4, profil, dos', 40, 78, 52, ENCRE, true)
  texte(ctx, 'Le corps tourne, la lumière reste en haut à gauche', 40, 122, 28, GRIS)
  lignes.forEach((t, i) => {
    const y0 = 150 + i * ligne
    texte(ctx, t.nom, 40, y0 + 30, 32, ENCRE, true)
    vues.forEach((v, k) => {
      cellule(ctx, k * cell, y0 + 34, cell, { forme: t.forme, couleur: t.couleur, sel: t.sel, yaw: v.yaw, cadre: t.sel.dos ? 245 : 185 })
      texte(ctx, v.nom, k * cell + cell / 2, y0 + ligne - 4, 20, GRIS, false, 'center')
    })
  })
  return c
}

function planchestyles() {
  const combos: Array<{ sel: Selection; forme: string; couleur: string }> = [
    { forme: 'cercle', couleur: hexDe('turquoise'), sel: { tete: 'casquette', yeux: 'rondes', visage: 'joues', bas: 'papillon' } },
    { forme: 'etoile', couleur: hexDe('ambre'), sel: { tete: 'couronne', yeux: 'soleil', bas: 'echarpe' } },
    { forme: 'squircle', couleur: hexDe('rose'), sel: { tete: 'bonnet', yeux: 'coeur', visage: 'moustache', bas: 'medaille' } }
  ]
  const styles: Array<{ nom: string; rendu: Rendu3d }> = [
    { nom: 'Soft', rendu: 'doux' },
    { nom: 'Flat', rendu: 'toon' },
    { nom: 'Pixel', rendu: 'pixel' }
  ]
  const cell = 360
  const ligne = cell + 20
  const { c, ctx } = nouvelle(W, 190 + combos.length * ligne + 30)
  texte(ctx, 'Soft, Flat, Pixel', 40, 78, 54, ENCRE, true)
  texte(ctx, 'Les mêmes accessoires dans les trois styles', 40, 122, 28, GRIS)
  styles.forEach((s, k) => texte(ctx, s.nom, k * cell + cell / 2, 176, 30, ENCRE, true, 'center'))
  combos.forEach((cb, i) => {
    styles.forEach((s, k) => cellule(ctx, k * cell, 190 + i * ligne, cell, { ...cb, rendu: s.rendu, cadre: 190 }))
  })
  return c
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
  const faire: Array<[string, () => HTMLCanvasElement]> = [
    ['tete', () => plancheEmplacement('tete', 180, 0.35)],
    ['yeux', () => plancheEmplacement('yeux', 165, 0.25)],
    ['visage', () => plancheEmplacement('visage', 150, 0.25)],
    ['bas', () => plancheEmplacement('bas', 160, 0.25)],
    ['dos', () => plancheEmplacement('dos', 245, [0.55, 2.55, 3.4], ['3/4 avant', '3/4 dos', 'de dos'])],
    ['combos', plancheCombos],
    ['vues', planchevues],
    ['styles', planchestyles]
  ]
  for (const [nom, f] of faire) {
    if (!tout && !qui.includes(nom)) continue
    const c = f()
    await envoyer(`${nom}.png`, c)
    if (!q.get('save')) document.body.appendChild(c)
  }
  document.title = 'fini'
}

main().catch((e) => {
  document.title = 'erreur ' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})
void CATALOGUE
