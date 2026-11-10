import { BotEngine } from '../src/bot/engine'
import { EXPRESSION_BY_ID } from '../src/bot/expressions'
import { DEMI_VIEWBOX, RAYON } from '../src/bot/repere'
import { grillePixel } from '../src/ui/rendu'
import { COLORS, SHAPES } from '../src/bot/skins'
import { resoudre, EMPLACEMENTS, type Selection } from '../src/bot/emplacements'
import type { Rendu3d } from '../src/ui/trois/rendu3d'
import { contraste, corpsPourTheme, OEIL_SOMBRE, type Theme } from '../src/ui/trois/theme'

/** Rend les planches du mode sombre : un seul contexte WebGL, des cellules recopiees dans un canvas 2D. */
const q = new URLSearchParams(location.search)
const FOND = '#faf8f3'
const FOND_SOMBRE = '#121212'
const ENCRE = '#26222f'
const GRIS = '#8a8794'
const PAPIER = '#f9f9f9'
const W = 1080

const hexDe = (id: string) => COLORS.find((c) => c.id === id)!.hex

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
const FORMES = SHAPES.map((s) => s.id)
// couleurs variées, dont une encre (corps éclairci en sombre) ; décalées d'un style à l'autre
const COULEURS = ['turquoise', 'ambre', 'rose', 'bleu', 'violet', 'orange', 'vert', 'rouge', 'gris', 'creme', 'encre']

let rendreAvatar: typeof import('../src/ui/trois/scene3d').rendreAvatar
const images = new Map<string, ReturnType<BotEngine['sample']>>()
function image(forme: string, humeur?: string, etat: 'idle' | 'wink' = 'idle', t = 1.2) {
  const cle = `${forme}|${humeur ?? ''}|${etat}|${t}`
  let f = images.get(cle)
  if (!f) {
    f = new BotEngine(RAYON, etat, SHAPES.find((s) => s.id === forme)!.radii, humeur ? EXPRESSION_BY_ID.get(humeur)! : null).sample(t)
    images.set(cle, f)
  }
  return f
}

interface Cellule {
  forme: string
  couleur: string
  theme: Theme
  rendu?: Rendu3d
  sel?: Selection
  humeur?: string
  etat?: 'idle' | 'wink'
  yaw?: number
  cadre?: number
  /** contraste oeil/corps minimal en sombre ; 0 = corps jamais eclairci */
  min?: number
}

function cellule(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, c: Cellule) {
  const t = document.createElement('canvas')
  const cadre = c.cadre ?? 140
  // pixel : la vraie grille de l'application (taille « moyen »), agrandie sans lissage
  const pixel = c.rendu === 'pixel'
  t.width = t.height = pixel ? Math.round((grillePixel('moyen') * cadre) / DEMI_VIEWBOX) : px
  rendreAvatar(t, image(c.forme, c.humeur, c.etat), c.couleur, PAPIER, c.rendu ?? 'doux', false, 'marque', true, c.forme, c.yaw ?? 0, null, c.sel ?? {}, cadre, c.theme, c.min)
  ctx.imageSmoothingEnabled = !pixel
  ctx.drawImage(t, x, y, px, px)
  ctx.imageSmoothingEnabled = true
}

function texte(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, taille: number, couleur = ENCRE, gras = false, align: CanvasTextAlign = 'left') {
  ctx.font = `${gras ? '700' : '500'} ${taille}px -apple-system, Helvetica, Arial, sans-serif`
  ctx.fillStyle = couleur
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(s, x, y)
}

function nouvelle(w: number, h: number, fond = FOND) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = fond
  ctx.fillRect(0, 0, w, h)
  return { c, ctx }
}

const STYLES: Record<string, { nom: string; rendu: Rendu3d }> = {
  soft: { nom: 'Soft', rendu: 'doux' },
  flat: { nom: 'Flat', rendu: 'toon' },
  pixel: { nom: 'Pixel', rendu: 'pixel' }
}

/** Clair | sombre côte à côte, deux formes par ligne, les 11 formes, dans un style. */
function plancheFormes(style: keyof typeof STYLES, decalage: number) {
  const s = STYLES[style]!
  const cell = 270
  const ligne = cell + 46
  const lignes = Math.ceil(FORMES.length / 2)
  const { c, ctx } = nouvelle(W, 170 + lignes * ligne + 20)
  texte(ctx, `${s.nom} : clair et sombre`, 40, 78, 56, ENCRE, true)
  texte(ctx, 'Les 11 formes. À gauche clair, à droite sombre (yeux noirs).', 40, 122, 26, GRIS)
  FORMES.forEach((f, i) => {
    const x0 = (i % 2) * 540
    const y0 = 150 + Math.floor(i / 2) * ligne
    const couleur = hexDe(COULEURS[(i + decalage) % COULEURS.length]!)
    cellule(ctx, x0, y0, cell, { forme: f, couleur, theme: 'light', rendu: s.rendu })
    cellule(ctx, x0 + cell, y0, cell, { forme: f, couleur, theme: 'dark', rendu: s.rendu })
    texte(ctx, `${NOMS_FORMES[f]}  ·  ${COULEURS[(i + decalage) % COULEURS.length]}`, x0 + cell, y0 + cell + 26, 22, GRIS, false, 'center')
  })
  return c
}

/** Les mêmes Mochi en sombre, sur un fond sombre (dashboard) puis sur un fond clair. */
function planchefonds() {
  const cell = 270
  const cols = 4
  const lignes = Math.ceil(FORMES.length / cols)
  const bloc = 90 + lignes * cell + 20
  const { c, ctx } = nouvelle(W, 2 * bloc)
  const fonds: Array<[string, string, string]> = [
    ['Sur fond sombre (#121212)', FOND_SOMBRE, '#f2f0f5'],
    ['Sur fond clair', '#ffffff', ENCRE]
  ]
  fonds.forEach(([titre, fond, encre], b) => {
    ctx.fillStyle = fond
    ctx.fillRect(0, b * bloc, W, bloc)
    texte(ctx, titre, 40, b * bloc + 62, 40, encre, true)
    FORMES.forEach((f, i) => {
      const x = (i % cols) * cell
      const y = b * bloc + 90 + Math.floor(i / cols) * cell
      cellule(ctx, x, y, cell, { forme: f, couleur: hexDe(COULEURS[i % COULEURS.length]!), theme: 'dark' })
    })
  })
  return c
}

/** Palette : agents du dashboard (PROJ_PALETTE de core.js) puis palette de la librairie. */
const PALETTE: Array<[string, string]> = [
  ...COLORS.map((c) => [c.id, c.hex] as [string, string]),
  ['flash', '#ffc21a'],
  ['ninou', '#4db8ff'],
  ['et-si', '#2a4dbf'],
  ['dmcheap', '#1f2126'],
  ['magicon', '#c77700'],
  ['robin', '#8b4dff'],
  ['outils', '#ff6b5a'],
  ['jean-claude', '#ff7a1a']
]

/** Palette complète en sombre, avec le rapport de contraste de chaque couleur. */
function planchepalette() {
  const cols = 4
  const cell = 270
  const ligne = cell + 74
  const lignes = Math.ceil(PALETTE.length / cols)
  const { c, ctx } = nouvelle(W, 170 + lignes * ligne + 20)
  texte(ctx, 'Palette en sombre', 40, 78, 56, ENCRE, true)
  texte(ctx, 'Rapport de contraste œil noir / corps (seuil 3:1). Rouge = éclairci.', 40, 122, 26, GRIS)
  PALETTE.forEach(([nom, hex], i) => {
    const x = (i % cols) * cell
    const y = 150 + Math.floor(i / cols) * ligne
    const apres = corpsPourTheme(hex, 'dark')
    cellule(ctx, x, y, cell, { forme: FORMES[i % FORMES.length]!, couleur: hex, theme: 'dark' })
    const r = contraste(hex, OEIL_SOMBRE)
    const lift = apres !== hex
    texte(ctx, `${nom}  ${r.toFixed(1)}:1`, x + cell / 2, y + cell + 24, 23, lift ? '#d23b3b' : ENCRE, true, 'center')
    texte(ctx, lift ? `éclairci : ${contraste(apres, OEIL_SOMBRE).toFixed(1)}:1` : 'inchangé', x + cell / 2, y + cell + 50, 21, GRIS, false, 'center')
  })
  return c
}

/** Les couleurs à éclaircir : sans correctif / avec, côte à côte (et le clair pour mémoire). */
function planchecontraste() {
  const cas = PALETTE.filter(([, h]) => corpsPourTheme(h, 'dark') !== h)
  const cell = 340
  const ligne = cell + 74
  const { c, ctx } = nouvelle(W, 200 + cas.length * ligne + 20)
  texte(ctx, 'Corps éclairci en sombre', 40, 78, 52, ENCRE, true)
  texte(ctx, 'Seulement les couleurs sous 3:1, juste assez pour atteindre 3:1.', 40, 122, 26, GRIS)
  const x1 = 120
  const x2 = 120 + cell + 20
  texte(ctx, 'sans correctif', x1 + cell / 2 - 60, 180, 26, ENCRE, true, 'center')
  texte(ctx, 'corps éclairci', x2 + cell / 2 - 60, 180, 26, ENCRE, true, 'center')
  cas.forEach(([nom, hex], i) => {
    const y0 = 200 + i * ligne
    const apres = corpsPourTheme(hex, 'dark')
    cellule(ctx, x1 - 80, y0, cell, { forme: 'cercle', couleur: hex, theme: 'dark', min: 0, cadre: 130 })
    cellule(ctx, x2 - 80, y0, cell, { forme: 'cercle', couleur: hex, theme: 'dark', cadre: 130 })
    texte(ctx, `${nom} : ${hex}  (${contraste(hex, OEIL_SOMBRE).toFixed(1)}:1)  >  ${apres}  (${contraste(apres, OEIL_SOMBRE).toFixed(1)}:1)`, 40, y0 + cell + 34, 26, ENCRE, true)
  })
  return c
}

/** Cinq humeurs du visage (+ un clin d'œil) en sombre. */
function planchehumeurs() {
  const defs: Array<{ nom: string; humeur?: string; etat?: 'idle' | 'wink'; forme: string; couleur: string }> = [
    { nom: 'neutre', humeur: 'neutre', forme: 'cercle', couleur: hexDe('turquoise') },
    { nom: 'surpris', humeur: 'surpris', forme: 'etoile', couleur: hexDe('ambre') },
    { nom: 'heureux', humeur: 'heureux', forme: 'squircle', couleur: hexDe('rose') },
    { nom: 'colère', humeur: 'colere', forme: 'nuage', couleur: hexDe('rouge') },
    { nom: 'somnolent', humeur: 'somnolent', forme: 'goutte', couleur: hexDe('bleu') },
    { nom: 'clin d’œil (geste)', etat: 'wink', forme: 'oeuf', couleur: hexDe('violet') }
  ]
  const cell = 360
  const ligne = cell + 56
  const { c, ctx } = nouvelle(W, 160 + 2 * ligne + 10)
  texte(ctx, 'Humeurs du visage en sombre', 40, 78, 50, ENCRE, true)
  texte(ctx, 'Paupières et formes d’yeux inchangées, seule la couleur change.', 40, 122, 26, GRIS)
  defs.forEach((d, i) => {
    const x = (i % 3) * cell
    const y = 140 + Math.floor(i / 3) * ligne
    cellule(ctx, x, y, cell, { forme: d.forme, couleur: d.couleur, theme: 'dark', humeur: d.humeur, etat: d.etat, cadre: 130 })
    texte(ctx, d.nom, x + cell / 2, y + cell + 30, 28, ENCRE, true, 'center')
  })
  return c
}

const nomsDe = (sel: Selection) => EMPLACEMENTS.map((e) => resoudre(e, sel[e])?.nom).filter(Boolean) as string[]

/** Combinaisons d'accessoires en sombre (clair en vignette pour comparer). */
function planchecombos() {
  const defs: Array<{ forme: string; couleur: string; sel: Selection }> = [
    { forme: 'cercle', couleur: hexDe('turquoise'), sel: { tete: 'casque', yeux: 'rondes', visage: 'joues', bas: 'papillon', dos: 'cape' } },
    { forme: 'etoile', couleur: hexDe('ambre'), sel: { tete: 'fleur', yeux: 'soleil', visage: 'rousseur', bas: 'cravate', dos: 'sac' } },
    { forme: 'squircle', couleur: hexDe('rose'), sel: { tete: 'couronne', yeux: 'coeur', visage: 'chat', bas: 'echarpe', dos: 'ailes' } }
  ]
  const cell = 520
  const ligne = cell + 90
  const { c, ctx } = nouvelle(W, 150 + defs.length * ligne)
  texte(ctx, 'Accessoires en sombre', 40, 78, 52, ENCRE, true)
  texte(ctx, 'À gauche clair, à droite sombre : les accessoires ne changent pas.', 40, 122, 26, GRIS)
  defs.forEach((d, i) => {
    const y = 140 + i * ligne
    cellule(ctx, 20, y, cell, { forme: d.forme, couleur: d.couleur, theme: 'light', sel: d.sel, cadre: 205 })
    cellule(ctx, 540, y, cell, { forme: d.forme, couleur: d.couleur, theme: 'dark', sel: d.sel, cadre: 205 })
    texte(ctx, nomsDe(d.sel).join(' + '), W / 2, y + cell + 30, 24, ENCRE, true, 'center')
  })
  return c
}

/** Conflits possibles entre yeux noirs et accessoires de l'emplacement yeux : avant / après la solution. */
function planchecconflits() {
  const SOLEIL_NOIR = { id: 'soleil', c2: '#26222f' } // verre noir du catalogue, sans la solution
  const lignes: Array<{ nom: string; clair: Selection; sans: Selection; avec: Selection; forme: string; couleur: string }> = [
    { nom: 'Lunettes de soleil (verre noir)', forme: 'cercle', couleur: hexDe('ambre'), clair: { yeux: 'soleil' }, sans: { yeux: SOLEIL_NOIR }, avec: { yeux: 'soleil' } },
    { nom: 'Lunettes rondes (monture noire)', forme: 'squircle', couleur: hexDe('turquoise'), clair: { yeux: 'rondes' }, sans: { yeux: 'rondes' }, avec: { yeux: 'rondes' } },
    { nom: 'Lunettes carrées (monture marine)', forme: 'nuage', couleur: hexDe('rose'), clair: { yeux: 'carrees' }, sans: { yeux: 'carrees' }, avec: { yeux: 'carrees' } },
    { nom: 'Monocle', forme: 'goutte', couleur: hexDe('vert'), clair: { yeux: 'monocle' }, sans: { yeux: 'monocle' }, avec: { yeux: 'monocle' } },
    { nom: 'Masque de sommeil', forme: 'oeuf', couleur: hexDe('bleu'), clair: { yeux: 'sommeil' }, sans: { yeux: 'sommeil' }, avec: { yeux: 'sommeil' } }
  ]
  const cell = 340
  const ligne = cell + 60
  const { c, ctx } = nouvelle(W, 210 + lignes.length * ligne)
  texte(ctx, 'Yeux noirs et lunettes', 40, 78, 52, ENCRE, true)
  texte(ctx, 'Seul vrai conflit : le verre noir des lunettes de soleil.', 40, 122, 26, GRIS)
  ;['clair', 'sombre, sans solution', 'sombre, verre ardoise'].forEach((t, k) => texte(ctx, t, 20 + k * 357 + 170, 190, 22, ENCRE, true, 'center'))
  lignes.forEach((l, i) => {
    const y = 210 + i * ligne
    cellule(ctx, 0, y, 357, { forme: l.forme, couleur: l.couleur, theme: 'light', sel: l.clair, cadre: 150 })
    cellule(ctx, 357, y, 357, { forme: l.forme, couleur: l.couleur, theme: 'dark', sel: l.sans, cadre: 150 })
    cellule(ctx, 714, y, 357, { forme: l.forme, couleur: l.couleur, theme: 'dark', sel: l.avec, cadre: 150 })
    texte(ctx, l.nom, 40, y + cell + 32, 26, ENCRE, true)
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
    ['01-formes-soft', () => plancheFormes('soft', 0)],
    ['02-formes-flat', () => plancheFormes('flat', 3)],
    ['03-formes-pixel', () => plancheFormes('pixel', 6)],
    ['04-fonds', planchefonds],
    ['05-contraste-palette', planchepalette],
    ['06-corps-eclairci', planchecontraste],
    ['07-humeurs', planchehumeurs],
    ['08-accessoires', planchecombos],
    ['09-conflits-lunettes', planchecconflits]
  ]
  for (const [nom, f] of faire) {
    if (!tout && !qui.some((x) => nom.includes(x))) continue
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
