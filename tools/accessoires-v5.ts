import { BotEngine } from '../src/bot/engine'
import { RAYON } from '../src/bot/repere'
import { COLORS, SHAPES } from '../src/bot/skins'
import {
  CATALOGUE,
  COULEURS,
  NOMS_EMPLACEMENTS,
  type Emplacement,
  type Selection
} from '../src/bot/emplacements'
import type { Rendu3d } from '../src/ui/trois/rendu3d'

/** Planches de la v5 (accessoires simplifies, une ou deux couleurs, personnalisables). Rend les planches : un seul contexte WebGL, des cellules recopiees dans un canvas 2D. */
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
  theme?: 'light' | 'dark'
}

/** Dessine un Mochi (3D temps reel) dans le canvas de la planche, carre de `px` en (x, y). */
function cellule(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, c: Cellule) {
  const t = document.createElement('canvas')
  t.width = t.height = px
  rendreAvatar(t, image(c.forme), c.couleur, PAPIER, c.rendu ?? 'doux', false, 'marque', true, c.forme, c.yaw ?? 0, null, c.sel, c.cadre ?? 175, c.theme ?? 'light')
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
  beret: 205,
  casquette: 205,
  paille: 250,
  casque: 215,
  ruban: 205,
  fleur: 205,
  ailes: 280,
  diable: 280,
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
  texte(ctx, 'Catalogue v5', 40, 78, 58, ENCRE, true)
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

/** Casquette : les 11 formes, de face, de 3/4 et de profil, en clair puis en sombre. */
function planCasquette() {
  const formes = SHAPES.map((s) => s.id)
  const vues = [{ yaw: 0, nom: 'face' }, { yaw: 0.62, nom: '3/4' }, { yaw: 1.5708, nom: 'profil' }]
  const themes: Array<'light' | 'dark'> = ['light', 'dark']
  const cell = 240
  const W2 = cell * 6
  const ligne = cell + 8
  const { c, ctx } = nouvelle(W2, 150 + formes.length * ligne + 20)
  texte(ctx, 'Casquette v6', 40, 78, 58, ENCRE, true)
  texte(ctx, 'Calotte ronde et rigide, indépendante du corps · 11 formes · face, 3/4, profil · clair à gauche, sombre à droite', 40, 122, 26, GRIS)
  const couleurs = ['turquoise', 'ambre', 'rose', 'vert', 'violet', 'orange', 'bleu', 'turquoise', 'ambre', 'rose', 'vert']
  formes.forEach((f, i) => {
    const y0 = 150 + i * ligne
    themes.forEach((th, ti) =>
      vues.forEach((v, k) => {
        const x = (ti * 3 + k) * cell
        if (th === 'dark') {
          ctx.fillStyle = '#121212'
          ctx.fillRect(x, y0, cell, ligne)
        }
        cellule(ctx, x, y0, cell, { forme: f, couleur: hexDe(couleurs[i]!), theme: th, sel: { tete: { id: 'casquette', c1: COULEURS.bleu, c2: i % 3 === 1 ? COULEURS.noir : COULEURS.bleu } }, yaw: v.yaw, cadre: 215 })
      })
    )
    texte(ctx, NOMS_FORMES[f] ?? f, 14, y0 + 26, 22, GRIS, true)
  })
  return c
}

/** Casquette cumulee avec les autres accessoires (yeux, visage, bas, dos). */
function planCasquetteCombos() {
  const defs: Array<{ forme: string; couleur: string; sel: Selection }> = [
    { forme: 'cercle', couleur: hexDe('turquoise'), sel: { yeux: 'rondes', visage: 'joues', bas: 'papillon', dos: 'cape' } },
    { forme: 'squircle', couleur: hexDe('ambre'), sel: { yeux: 'soleil', visage: 'chat', bas: 'cravate', dos: 'sac' } },
    { forme: 'etoile', couleur: hexDe('rose'), sel: { yeux: 'carrees', visage: 'rousseur', bas: 'echarpe', dos: 'ailes' } },
    { forme: 'triangle', couleur: hexDe('ambre'), sel: { yeux: 'rondes', bas: 'papillon' } },
    { forme: 'nuage', couleur: hexDe('vert'), sel: { yeux: 'monocle', visage: 'joues', bas: 'cravate' } },
    { forme: 'goutte', couleur: hexDe('orange'), sel: { yeux: 'coeur', dos: 'cape' } }
  ]
  const cell = 360
  const { c, ctx } = nouvelle(W, 150 + Math.ceil(defs.length / 3) * (cell + 50) * 2)
  texte(ctx, 'Casquette cumulée', 40, 78, 54, ENCRE, true)
  texte(ctx, 'Avec lunettes, visage, bas et dos · clair puis sombre', 40, 122, 26, GRIS)
  defs.forEach((d, i) => {
    const x = (i % 3) * cell
    const y = 150 + Math.floor(i / 3) * (cell + 50) * 2
    ;(['light', 'dark'] as const).forEach((th, ti) => {
      const yy = y + ti * (cell + 50)
      if (th === 'dark') {
        ctx.fillStyle = '#121212'
        ctx.fillRect(x, yy, cell, cell + 50)
      }
      cellule(ctx, x, yy, cell, { forme: d.forme, couleur: d.couleur, theme: th, sel: { ...d.sel, tete: { id: 'casquette', c1: COULEURS.rouge, c2: COULEURS.rouge } }, yaw: 0.3, cadre: 215 })
      texte(ctx, `${NOMS_FORMES[d.forme]} · ${Object.values(d.sel).join(', ')}`, x + cell / 2, yy + cell + 28, 17, th === 'dark' ? '#cfcbd6' : GRIS, false, 'center')
    })
  })
  return c
}

/** Lunettes : chaque modele sur les 11 formes, en 3/4 et de profil (les branches doivent rentrer dans le corps). */
function planLunettes() {
  const modeles = ['rondes', 'carrees', 'soleil', 'coeur', 'etoile', 'monocle']
  const formes = SHAPES.map((s) => s.id)
  const vues = [0.62, 1.5708]
  const cell = 150
  const { c, ctx } = nouvelle(cell * modeles.length * 2, 150 + formes.length * cell + 20)
  texte(ctx, 'Lunettes v7 : branches ancrées dans le corps', 40, 78, 52, ENCRE, true)
  texte(ctx, '6 modèles × 11 formes · 3/4 puis profil pour chaque modèle', 40, 122, 24, GRIS)
  const couleurs = ['turquoise', 'ambre', 'rose', 'vert', 'violet', 'orange', 'bleu', 'turquoise', 'ambre', 'rose', 'vert']
  formes.forEach((f, i) => {
    modeles.forEach((m, mi) =>
      vues.forEach((yaw, vi) => {
        const x = (mi * 2 + vi) * cell
        const y = 150 + i * cell
        cellule(ctx, x, y, cell, { forme: f, couleur: hexDe(couleurs[i]!), sel: { yeux: { id: m, c1: COULEURS.noir, c2: COULEURS.noir } }, yaw, cadre: 150 })
      })
    )
    texte(ctx, NOMS_FORMES[f] ?? f, 6, 150 + i * cell + 16, 14, GRIS, true)
  })
  modeles.forEach((m, mi) => texte(ctx, m, mi * 2 * cell + cell, 144, 18, ENCRE, true, 'center'))
  return c
}

/** Cape puis cravate, seules, sur 6 formes : grandes vignettes (cape : face, 3/4, profil, dos ; cravate : face, 3/4, profil). */
function planCapeCravate() {
  const formes = ['cercle', 'squircle', 'etoile', 'triangle', 'goutte', 'nuage']
  const couleurs = ['turquoise', 'ambre', 'rose', 'violet', 'orange', 'bleu']
  const vues = [{ yaw: 0, nom: 'face' }, { yaw: 0.62, nom: '3/4' }, { yaw: 1.5708, nom: 'profil' }, { yaw: 3.1416, nom: 'dos' }]
  const cell = 300
  const W2 = cell * 4
  const bloc = 70 + formes.length * (cell + 8)
  const { c, ctx } = nouvelle(W2, 130 + bloc * 2 + 20)
  texte(ctx, 'Cape et cravate (état actuel)', 40, 70, 54, ENCRE, true)
  const section = (titre: string, id: Emplacement, acc: string, nv: number, cadre: number, y0: number) => {
    texte(ctx, titre, 40, y0 + 40, 40, ENCRE, true)
    formes.forEach((f, i) => {
      const y = y0 + 60 + i * (cell + 8)
      vues.slice(0, nv).forEach((v, k) => {
        cellule(ctx, k * cell, y, cell, { forme: f, couleur: hexDe(couleurs[i]!), sel: { [id]: acc }, yaw: v.yaw, cadre })
        texte(ctx, `${NOMS_FORMES[f]} · ${v.nom}`, k * cell + cell / 2, y + cell - 4, 19, GRIS, false, 'center')
      })
    })
  }
  section('Cape', 'dos', 'cape', 4, 235, 110)
  section('Cravate', 'bas', 'cravate', 3, 185, 110 + bloc)
  return c
}

/** Cravate : les 11 formes en clair (face, 3/4, profil), puis une rangee en sombre sur 3 formes. */
function planCravate() {
  const formes = SHAPES.map((s) => s.id)
  const couleurs = ['turquoise', 'ambre', 'rose', 'vert', 'violet', 'orange', 'bleu', 'turquoise', 'ambre', 'rose', 'vert']
  const vues = [{ yaw: 0, nom: 'face' }, { yaw: 0.62, nom: '3/4' }, { yaw: 1.5708, nom: 'profil' }]
  const cell = 300
  const sombres = ['cercle', 'etoile', 'triangle']
  const { c, ctx } = nouvelle(cell * 3, 130 + formes.length * (cell + 8) + 70 + sombres.length * (cell + 8) + 20)
  texte(ctx, 'Cravate v9', 40, 70, 54, ENCRE, true)
  texte(ctx, 'Nœud trapèze, lame en pointe collée au ventre · 11 formes · face, 3/4, profil', 40, 108, 24, GRIS)
  const ligne = (f: string, i: number, y: number, th: 'light' | 'dark') => {
    if (th === 'dark') {
      ctx.fillStyle = '#121212'
      ctx.fillRect(0, y, cell * 3, cell + 8)
    }
    vues.forEach((v, k) => {
      cellule(ctx, k * cell, y, cell, { forme: f, couleur: hexDe(couleurs[i]!), theme: th, sel: { bas: 'cravate' }, yaw: v.yaw, cadre: 185 })
      texte(ctx, `${NOMS_FORMES[f]} · ${v.nom}`, k * cell + cell / 2, y + cell - 4, 19, th === 'dark' ? '#cfcbd6' : GRIS, false, 'center')
    })
  }
  formes.forEach((f, i) => ligne(f, i, 130 + i * (cell + 8), 'light'))
  const y0 = 130 + formes.length * (cell + 8)
  texte(ctx, 'En sombre', 40, y0 + 44, 36, ENCRE, true)
  sombres.forEach((f, j) => ligne(f, formes.indexOf(f), y0 + 70 + j * (cell + 8), 'dark'))
  return c
}

/** Vues : face, 3/4, profil, dos pour la cape et la cravate. */
function planVues() {
  const lignes: Array<{ nom: string; sel: Selection; forme: string; couleur: string; cadre: number }> = [
    { nom: 'Cape (rond)', sel: { dos: 'cape' }, forme: 'cercle', couleur: hexDe('turquoise'), cadre: 235 },
    { nom: 'Cape (cube)', sel: { dos: 'cape' }, forme: 'squircle', couleur: hexDe('ambre'), cadre: 235 },
    { nom: 'Cravate (rond)', sel: { bas: 'cravate' }, forme: 'cercle', couleur: hexDe('ambre'), cadre: 185 },
    { nom: 'Cravate (cube)', sel: { bas: 'cravate' }, forme: 'squircle', couleur: hexDe('orange'), cadre: 185 }
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
    ['casquette', planCasquette],
    ['casquette-combos', planCasquetteCombos],
    ['lunettes', planLunettes],
    ['cape-cravate', planCapeCravate],
    ['cravate', planCravate],
    ['catalogue', planCatalogue],
    ['vues', planVues],
    ['alfred', planAlfred]
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
