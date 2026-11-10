import { BotEngine } from '../src/bot/engine'
import { RAYON } from '../src/bot/repere'
import { COLORS, SHAPES } from '../src/bot/skins'
import type { Selection } from '../src/bot/emplacements'
import type { Rendu3d } from '../src/ui/trois/rendu3d'

/** Planche du contour : trois styles, trois epaisseurs (fin, moyen, epais), avec accessoires. Un seul contexte WebGL, des cellules recopiees dans un canvas 2D. */
const q = new URLSearchParams(location.search)
const FOND = '#faf8f3'
const ENCRE = '#26222f'
const GRIS = '#8a8794'
const PAPIER = '#f9f9f9'
const hexDe = (id: string) => COLORS.find((c) => c.id === id)!.hex

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

/** Un Mochi dans le canvas `ctx`. Pixel : grille de 32 pixels de diametre (le defaut), agrandie sans lissage. */
function cellule(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, o: { forme: string; couleur: string; rendu: Rendu3d; sel: Selection; contour: boolean; ep: number; cadre: number; yaw?: number }) {
  const pixel = o.rendu === 'pixel'
  const t = document.createElement('canvas')
  t.width = t.height = pixel ? Math.round((32 * o.cadre) / 100) : px * 2
  rendreAvatar(t, image(o.forme), o.couleur, PAPIER, o.rendu, o.contour, 'marque', true, o.forme, o.yaw ?? 0.3, null, o.sel, o.cadre, 'light', undefined, 0, true, true, o.ep)
  ctx.imageSmoothingEnabled = !pixel
  ctx.drawImage(t, x, y, px, px)
}

function texte(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, taille: number, couleur = ENCRE, gras = false, align: CanvasTextAlign = 'left') {
  ctx.font = `${gras ? '700' : '500'} ${taille}px -apple-system, Helvetica, Arial, sans-serif`
  ctx.fillStyle = couleur
  ctx.textAlign = align
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

function planche() {
  const styles: Array<{ nom: string; rendu: Rendu3d }> = [{ nom: '3D Soft', rendu: 'doux' }, { nom: 'Pixel', rendu: 'pixel' }, { nom: 'Flat', rendu: 'toon' }]
  const epaisseurs = [{ nom: 'fin (0,6x)', ep: 0.6 }, { nom: 'moyen (1x)', ep: 1 }, { nom: 'epais (2,2x)', ep: 2.2 }]
  const lignes = [
    { forme: 'cercle', couleur: hexDe('turquoise'), sel: { tete: 'haut-de-forme', yeux: 'rondes' } as Selection },
    { forme: 'etoile', couleur: hexDe('ambre'), sel: { tete: 'casquette', bas: 'papillon' } as Selection }
  ]
  const cell = 300
  const cols = styles.length * epaisseurs.length
  const { c, ctx } = nouvelle(cols * cell, 150 + lignes.length * (cell + 20) + 20)
  texte(ctx, 'Contour : fin, moyen, épais, dans les trois styles', 40, 70, 46, ENCRE, true)
  texte(ctx, 'Le contour suit le corps ET les accessoires (haut-de-forme, lunettes, casquette, nœud)', 40, 108, 24, GRIS)
  styles.forEach((s, i) => {
    texte(ctx, s.nom, (i * epaisseurs.length + 1.5) * cell, 142, 28, ENCRE, true, 'center')
    epaisseurs.forEach((e, k) => {
      const x = (i * epaisseurs.length + k) * cell
      lignes.forEach((l, r) => {
        cellule(ctx, x, 150 + r * (cell + 20), cell, { ...l, rendu: s.rendu, contour: true, ep: e.ep, cadre: 225 })
      })
      texte(ctx, e.nom, x + cell / 2, 150 + lignes.length * (cell + 20) + 4, 18, GRIS, false, 'center')
    })
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
  const c = planche()
  await envoyer('planche-contour.png', c)
  if (!q.get('save')) document.body.appendChild(c)
  document.title = 'fini'
}

main().catch((e) => {
  document.title = 'erreur ' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})
