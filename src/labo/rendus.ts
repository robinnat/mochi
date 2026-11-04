import { createApp, h } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import { BotEngine } from '@/bot/engine'
import { PORTE_IDS, type PorteId } from '@/bot/portes'
import { SHAPE_BY_ID, COLOR_BY_ID } from '@/bot/skins'
import { POSES, type StateId } from '@/bot/states'

/**
 * Prototype `labo-rendus.html` : un meme Mochi 3D en plat, pixel art et pate, a cote du 2D
 * actuel, puis des mesures. Le pixel art 3D = rendu basse resolution + quantification : pas de
 * moteur de pixellisation separe.
 */
const MOODS: StateId[] = ['idle', 'wink', 'wide']
const PORTE: PorteId = 'bonnet'
const FORME = 'cercle'
const COULEUR = 'violet'
const hex = COLOR_BY_ID.get(COULEUR)!.hex
const radii = SHAPE_BY_ID.get(FORME)!.radii
const frameDe = (m: StateId, t = POSES[m]) => new BotEngine(100, m, radii, null).sample(t)

type Scene3d = typeof import('@/ui/trois/scene3d')

/** Posterise et durcit l'alpha : 4 niveaux par canal, donc au plus 64 couleurs. */
function quantifier(c: HTMLCanvasElement) {
  const x = c.getContext('2d')!
  const im = x.getImageData(0, 0, c.width, c.height)
  const d = im.data
  for (let i = 0; i < d.length; i += 4) {
    d[i + 3] = d[i + 3]! >= 128 ? 255 : 0
    for (let k = 0; k < 3; k++) d[i + k] = Math.round((d[i + k]! / 255) * 3) * 85
  }
  x.putImageData(im, 0, 0)
}

type Mode = 'plat' | 'pixel' | 'pate'
const RENDU_DE: Record<Mode, 'aplat' | 'doux'> = { plat: 'aplat', pixel: 'aplat', pate: 'doux' }

function rendre3d(m: Scene3d, cible: HTMLCanvasElement, f: ReturnType<typeof frameDe>, mode: Mode, porte: PorteId | null = PORTE) {
  m.rendreAvatar(cible, f, hex, '#f9f9f9', RENDU_DE[mode], mode === 'plat', 'marque', mode === 'pate', FORME, 0, porte)
  if (mode === 'pixel') quantifier(cible)
}

async function main() {
  const m = await import('@/ui/trois/scene3d')
  const racine = document.getElementById('r')!
  const rows = MOODS.map((mood) =>
    h('tr', [
      h('td', mood),
      ...(['original', 'pixel', 'argile'] as const).map((r) =>
        h('td', [h(MochiBot, { size: 150, shape: FORME, color: COULEUR, rendu: r, state: mood, porte: PORTE, frozenAt: POSES[mood], label: r })])
      ),
      ...(['plat', 'pixel', 'pate'] as Mode[]).map((mode, i) =>
        h('td', { class: i === 0 ? 'sep' : '' }, [
          h('canvas', {
            class: mode === 'pixel' ? 'px' : '',
            width: mode === 'pixel' ? 48 : 300,
            height: mode === 'pixel' ? 48 : 300,
            style: mode === 'pixel' ? '' : 'width:150px;height:150px',
            'data-mood': mood,
            'data-mode': mode
          })
        ])
      )
    ])
  )
  createApp({
    render: () =>
      h('table', [
        h('tr', [h('th', ''), h('th', '2D flat'), h('th', '2D pixel art'), h('th', '2D clay'), h('th', { class: 'sep' }, '3D flat'), h('th', '3D pixel art'), h('th', '3D clay')]),
        ...rows
      ])
  }).mount(racine)
  await new Promise((r) => setTimeout(r, 1500))
  racine.querySelectorAll<HTMLCanvasElement>('canvas[data-mood]').forEach((cv) => rendre3d(m, cv, frameDe(cv.dataset.mood as StateId), cv.dataset.mode as Mode))

  /* ------------------------------------------------------------ mesures */
  const res: Record<string, unknown> = { renderer: 'WebGL via ' + (navigator.userAgent.includes('Headless') ? 'headless Chrome (swiftshader, software)' : 'browser GPU') }
  const bench = (n: number, fn: (i: number) => void) => {
    for (let i = 0; i < 5; i++) fn(i)
    const t0 = performance.now()
    for (let i = 0; i < n; i++) fn(i)
    return Math.round(((performance.now() - t0) / n) * 100) / 100
  }
  const un = document.createElement('canvas')
  const cvPix = document.createElement('canvas')
  cvPix.width = cvPix.height = 48
  const moods = MOODS
  const t = (i: number) => 0.5 + i * 0.033
  res['1 mochi, ms/frame (engine + 3D render + copy)'] = {
    'flat 300px': bench(60, (i) => { un.width = un.height = 300; rendre3d(m, un, frameDe(moods[i % 3]!, t(i)), 'plat') }),
    'clay 300px': bench(60, (i) => { un.width = un.height = 300; rendre3d(m, un, frameDe(moods[i % 3]!, t(i)), 'pate') }),
    'pixel 48px + quantise': bench(60, (i) => rendre3d(m, cvPix, frameDe(moods[i % 3]!, t(i)), 'pixel'))
  }
  res['engine.sample only, ms (shared by 2D and 3D)'] = bench(300, (i) => frameDe(moods[i % 3]!, t(i)))
  // scene de 15 mochis : formes, humeurs et accessoires varies, un canvas de 96 px chacun (open space)
  const formes = ['cercle', 'squircle', 'triangle', 'etoile', 'fleur']
  const cvs = Array.from({ length: 15 }, () => { const c = document.createElement('canvas'); c.width = c.height = 96; return c })
  const engines = cvs.map((_, i) => new BotEngine(100, moods[i % 3]!, SHAPE_BY_ID.get(formes[i % 5]!)!.radii, null))
  const passe = (mode: Mode, i: number) => cvs.forEach((c, k) => {
    m.rendreAvatar(c, engines[k]!.sample(t(i) + k * 0.1), hex, '#f9f9f9', RENDU_DE[mode], mode === 'plat', 'marque', mode === 'pate', formes[k % 5]!, 0, PORTE_IDS_SCENE[k % PORTE_IDS_SCENE.length]!)
    if (mode === 'pixel') quantifier(c)
  })
  res['15 mochis 96px, ms per full scene pass'] = {
    flat: bench(20, (i) => passe('plat', i)),
    clay: bench(20, (i) => passe('pate', i)),
    'pixel (96px here, quantised)': bench(20, (i) => passe('pixel', i)),
    'clay, bodies unchanged between passes (mesh cache hits)': bench(20, () => passe('pate', 0))
  }
  /* ------------------------------------------------------- export en planche */
  const MOODS5: StateId[] = ['idle', 'thinking', 'wink', 'wide', 'sleep']
  const planche = async (mode: Mode, px: number, n: number) => {
    const s = document.createElement('canvas')
    s.width = px * n
    s.height = px * MOODS5.length
    const x = s.getContext('2d')!
    const c = document.createElement('canvas')
    c.width = c.height = px
    MOODS5.forEach((mood, r) => {
      for (let k = 0; k < n; k++) {
        rendre3d(m, c, frameDe(mood, 0.4 + (k * 1.6) / n), mode)
        x.drawImage(c, k * px, r * px)
      }
    })
    const poids = async (type: string) => (await new Promise<Blob | null>((ok) => s.toBlob(ok, type, 0.8)))?.size ?? 0
    return { sheet: `${px * n}x${px * MOODS5.length}`, frames: n * MOODS5.length, png_kB: Math.round((await poids('image/png')) / 102.4) / 10, webp_kB: Math.round((await poids('image/webp')) / 102.4) / 10 }
  }
  res['precomputed sprite sheets (5 moods x 8 frames, from 3D)'] = {
    'clay 96px': await planche('pate', 96, 8),
    'flat 96px': await planche('plat', 96, 8),
    'pixel 48px': await planche('pixel', 48, 8)
  }
  document.getElementById('res')!.textContent = JSON.stringify(res, null, 2)
  document.title = 'done'
}
const PORTE_IDS_SCENE: PorteId[] = PORTE_IDS
void main()
