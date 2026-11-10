import { BotEngine } from '../src/bot/engine'
import { COLORS, SHAPES } from '../src/bot/skins'
import { DEMI_VIEWBOX, RAYON } from '../src/bot/repere'
import { grillePixel } from '../src/ui/rendu'
import { Humeurs, type MoodId } from '../src/bot/humeurs'
import type { Selection } from '../src/bot/emplacements'
import type { Rendu3d } from '../src/ui/trois/rendu3d'

/** Planche du coeur : 3 styles, face et trois quarts, sans et avec chapeau, plus lunettes et quelques humeurs. */
const q = new URLSearchParams(location.search)
const FOND = '#faf8f3'
const ENCRE = '#26222f'
const GRIS = '#8a8794'
const PAPIER = '#f9f9f9'
const hexDe = (id: string) => COLORS.find((c) => c.id === id)!.hex
const FORME = SHAPES.find((s) => s.id === 'coeur')!

let rendreAvatar: typeof import('../src/ui/trois/scene3d').rendreAvatar
const STYLES: Array<{ nom: string; rendu: Rendu3d }> = [
  { nom: '3D Soft', rendu: 'doux' },
  { nom: 'Pixel', rendu: 'pixel' },
  { nom: 'Flat', rendu: 'toon' }
]

function cellule(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, o: { rendu: Rendu3d; couleur: string; sel?: Selection; yaw?: number; mood?: MoodId; t?: number }) {
  const pixel = o.rendu === 'pixel'
  const cadre = 175
  const t = document.createElement('canvas')
  t.width = t.height = pixel ? Math.round((grillePixel('fin') * cadre) / DEMI_VIEWBOX) : px * 2
  const ts = o.t ?? 1.2
  const geste = o.mood ? new Humeurs(o.mood).sample(ts) : undefined
  const frame = new BotEngine(RAYON, 'idle', FORME.radii, null).sample(ts, geste)
  rendreAvatar(t, frame, o.couleur, PAPIER, o.rendu, false, 'marque', true, 'coeur', o.yaw ?? 0, null, o.sel ?? {}, cadre)
  ctx.imageSmoothingEnabled = !pixel
  ctx.drawImage(t, x, y, px, px)
}

function texte(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, taille: number, couleur = ENCRE, gras = false, align: CanvasTextAlign = 'left') {
  ctx.font = `${gras ? '700' : '500'} ${taille}px -apple-system, Helvetica, Arial, sans-serif`
  ctx.fillStyle = couleur
  ctx.textAlign = align
  ctx.fillText(s, x, y)
}

function planche() {
  const cell = 230
  const vues = [
    { nom: 'face', yaw: 0, sel: {} as Selection },
    { nom: '3/4', yaw: 0.6, sel: {} as Selection },
    { nom: 'face, casquette', yaw: 0, sel: { tete: 'casquette' } as Selection },
    { nom: '3/4, haut-de-forme', yaw: 0.6, sel: { tete: 'haut-de-forme' } as Selection },
    { nom: 'lunettes, noeud', yaw: 0, sel: { yeux: 'rondes', bas: 'papillon' } as Selection },
    { nom: 'couronne, soleil', yaw: 0.4, sel: { tete: 'couronne', yeux: 'soleil' } as Selection }
  ]
  const moods: Array<{ nom: string; mood: MoodId; t: number }> = [
    { nom: 'repos', mood: 'repos', t: 0.6 },
    { nom: 'reflechit', mood: 'reflechit', t: 1.2 },
    { nom: 'termine', mood: 'termine', t: 0.95 },
    { nom: 'bloque', mood: 'bloque', t: 0.8 },
    { nom: 'dort', mood: 'dort', t: 1.4 },
    { nom: 'travaille', mood: 'travaille', t: 0.55 }
  ]
  const cols = vues.length
  const lignes = STYLES.length * 2
  const c = document.createElement('canvas')
  c.width = cols * cell
  c.height = 90 + lignes * (cell + 36) + 30
  const ctx = c.getContext('2d')!
  ctx.fillStyle = FOND
  ctx.fillRect(0, 0, c.width, c.height)
  texte(ctx, 'Forme cœur : 3 styles, face et 3/4, accessoires, humeurs', 30, 56, 34, ENCRE, true)
  const couleurs = [hexDe('rose'), hexDe('violet'), hexDe('rouge')]
  STYLES.forEach((s, si) => {
    const y1 = 90 + si * 2 * (cell + 36)
    texte(ctx, s.nom, 30, y1 + 22, 24, ENCRE, true)
    vues.forEach((v, i) => {
      cellule(ctx, i * cell, y1 + 30, cell, { rendu: s.rendu, couleur: couleurs[si]!, sel: v.sel, yaw: v.yaw })
      texte(ctx, v.nom, i * cell + cell / 2, y1 + 30 + cell + 4, 16, GRIS, false, 'center')
    })
    const y2 = y1 + cell + 36
    moods.forEach((m, i) => {
      cellule(ctx, i * cell, y2 + 30, cell, { rendu: s.rendu, couleur: couleurs[si]!, mood: m.mood, t: m.t, yaw: 0.15 })
      texte(ctx, m.nom, i * cell + cell / 2, y2 + 30 + cell + 4, 16, GRIS, false, 'center')
    })
  })
  return c
}

async function main() {
  ;({ rendreAvatar } = await import('../src/ui/trois/scene3d'))
  const c = planche()
  const dest = q.get('save')
  if (dest) {
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
    await fetch(`${dest}?name=coeur.png`, { method: 'POST', body: blob })
  } else document.body.appendChild(c)
  document.title = 'fini'
}
main().catch((e) => {
  document.title = 'erreur ' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})
