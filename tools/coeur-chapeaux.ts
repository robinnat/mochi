import { BotEngine } from '../src/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '../src/bot/repere'
import { grillePixel } from '../src/ui/rendu'
import { COLORS, SHAPES } from '../src/bot/skins'
import { parEmplacement } from '../src/bot/emplacements'
import type { Rendu3d } from '../src/ui/trois/rendu3d'

/** Planche : tous les chapeaux sur le coeur, trois styles, de face et de trois quarts. `?f=<forme>` pour une autre forme. */
const q = new URLSearchParams(location.search)
const FORME = SHAPES.find((s) => s.id === (q.get('f') ?? 'coeur'))!
const FOND = '#faf8f3'
const ENCRE = '#26222f'
const GRIS = '#8a8794'
const hexDe = (id: string) => COLORS.find((c) => c.id === id)!.hex
let rendreAvatar: typeof import('../src/ui/trois/scene3d').rendreAvatar

const STYLES: Array<{ nom: string; rendu: Rendu3d; couleur: string }> = [
  { nom: '3D Soft', rendu: 'doux', couleur: hexDe('rose') },
  { nom: 'Pixel', rendu: 'pixel', couleur: hexDe('violet') },
  { nom: 'Flat', rendu: 'toon', couleur: hexDe('rouge') }
]

function planche() {
  const garde = q.get('h')?.split(',')
  const chapeaux = parEmplacement('tete').filter((h) => !garde || garde.includes(h.id))
  const cell = Number(q.get('s')) || 170
  const cadre = 175
  const frame = new BotEngine(RAYON, 'idle', FORME.radii, null).sample(1.2)
  const cols = STYLES.length * 2
  const c = document.createElement('canvas')
  c.width = cols * cell
  c.height = 110 + chapeaux.length * (cell - 10)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = FOND
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.font = '700 28px -apple-system, Helvetica, Arial, sans-serif'
  ctx.fillStyle = ENCRE
  ctx.fillText(`Chapeaux sur la forme ${FORME.id} : face et 3/4, trois styles`, 20, 40)
  ctx.font = '600 16px -apple-system, Helvetica, Arial, sans-serif'
  STYLES.forEach((s, si) => {
    ctx.fillStyle = ENCRE
    ctx.textAlign = 'center'
    ctx.fillText(s.nom + ' face', (si * 2 + 0.5) * cell, 76)
    ctx.fillText(s.nom + ' 3/4', (si * 2 + 1.5) * cell, 76)
  })
  chapeaux.forEach((h, r) => {
    const y = 90 + r * (cell - 10)
    STYLES.forEach((s, si) => {
      for (const [k, yaw] of [[0, 0], [1, 0.6]] as const) {
        const pixel = s.rendu === 'pixel'
        const t = document.createElement('canvas')
        t.width = t.height = pixel ? Math.round((grillePixel('fin') * cadre) / DEMI_VIEWBOX) : cell * 2
        rendreAvatar(t, frame, s.couleur, '#f9f9f9', s.rendu, false, 'marque', true, FORME.id, yaw, null, { tete: h.id }, cadre)
        ctx.imageSmoothingEnabled = !pixel
        ctx.drawImage(t, (si * 2 + k) * cell, y, cell, cell)
      }
    })
    ctx.fillStyle = GRIS
    ctx.font = '500 14px -apple-system, Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(h.id, 6, y + 16)
  })
  return c
}

async function main() {
  ;({ rendreAvatar } = await import('../src/ui/trois/scene3d'))
  document.body.appendChild(planche())
  document.title = 'fini'
}
main().catch((e) => {
  document.title = 'erreur ' + (e instanceof Error ? e.message : String(e))
  console.error(e)
})
