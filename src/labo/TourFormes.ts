import { ref } from '@/ui/dom/reactif'
import { h, surDemontage, surMontage, type Composant } from '@/ui/dom/h'
import { BotEngine, charger3d, COLOR_BY_ID, DEMI_VIEWBOX, RAYON, SHAPES } from 'mochi-world'
import { tailleCellule } from './largeur'

/**
 * `#tour` : chaque forme sous quatre angles (face, trois quarts, profil, dos), pour juger le volume de tous les cotes.
 * `?f=squircle,cercle` ne garde que ces formes ; `?c=<couleur>` ; `?t=<date>` fige l'image ; `?s=<taille>` : cote
 * d'une cellule en pixels ; `?e=<degres>` : hauteur de la camera. La page rend tout dans UN canvas (une seule scene
 * WebGL, une cellule par angle).
 */
const ANGLES = [
  { nom: 'face', deg: 0 },
  { nom: 'trois quarts', deg: 40 },
  { nom: 'profil', deg: 90 },
  { nom: 'dos', deg: 180 }
]

export const TourFormes: Composant<Record<string, never>> = () => {
  const q = new URLSearchParams(location.search)
  const gardees = q.get('f')?.split(',')
  const FORMES = gardees ? SHAPES.filter((s) => gardees.includes(s.id)) : SHAPES
  const taille = tailleCellule(170, 4, 0, 0)
  const couleur = q.get('c') ?? 'violet'
  const t = Number(q.get('t')) || 1.2
  const elevation = ((Number(q.get('e')) || 12) * Math.PI) / 180
  let toile: HTMLCanvasElement | null = null
  const pret = ref(false)
  const largeurCol = taille
  let liberer = () => {}

  surMontage(async () => {
    const [three, { Mochi3d, lumieres }] = await Promise.all([import('three'), charger3d()])
    const cv = toile
    if (!cv) return
    const hex = COLOR_BY_ID.get(couleur)?.hex ?? couleur
    const L = 4 * largeurCol
    const H = FORMES.length * taille
    const renderer = new three.WebGLRenderer({ canvas: cv, antialias: true })
    renderer.setPixelRatio(1)
    renderer.setSize(L, H, false)
    renderer.outputColorSpace = three.SRGBColorSpace
    renderer.setScissorTest(true)
    renderer.setClearColor(new three.Color(0xf9f9f9), 1)
    const scene = new three.Scene()
    const l = lumieres()
    for (const x of l.toutes) scene.add(x)
    const demi = DEMI_VIEWBOX * 0.8
    const camera = new three.OrthographicCamera(-demi, demi, demi, -demi, 1, 4000)
    const corps: InstanceType<typeof Mochi3d>[] = []
    for (const f of FORMES) {
      const m = new Mochi3d(512)
      m.setRendu('doux', false, 'marque', true)
      m.setForme(f.id)
      const moteur = new BotEngine(RAYON, 'idle', f.radii, null)
      m.maj(moteur.sample(t), hex, '#f9f9f9')
      m.mesh.position.y = 0
      corps.push(m)
    }
    renderer.clear()
    FORMES.forEach((_, i) => {
      const m = corps[i]!
      scene.add(m.mesh)
      ANGLES.forEach((a, j) => {
        m.mesh.rotation.y = (a.deg * Math.PI) / 180
        const cy = m.mesh.geometry.boundingSphere?.center?.y ?? 0
        camera.position.set(0, cy + 1000 * Math.sin(elevation), 1000 * Math.cos(elevation))
        camera.lookAt(0, cy, 0)
        // lumiere fixe dans le repere de la camera : le mochi tourne, pas la lumiere
        const x = j * largeurCol
        const y = (FORMES.length - 1 - i) * taille
        renderer.setViewport(x, y, largeurCol, taille)
        renderer.setScissor(x, y, largeurCol, taille)
        renderer.render(scene, camera)
      })
      scene.remove(m.mesh)
    })
    pret.value = true
    liberer = () => {
      for (const m of corps) m.liberer()
      renderer.dispose()
    }
  })
  surDemontage(() => liberer())

  return () =>
    h(
      'main',
      { class: 'p-4' },
      h('h1', { class: 'mb-3 text-lg font-bold' }, 'Tour des formes : face, trois quarts, profil, dos'),
      h(
        'div',
        { class: 'max-w-full overflow-x-auto' },
        h(
          'div',
          { class: 'relative inline-block', 'data-pret': pret.value ? '1' : '0' },
          h('canvas', {
            ref: (el: Element | null) => (toile = el as HTMLCanvasElement | null),
            style: { width: 4 * largeurCol + 'px', height: FORMES.length * taille + 'px' }
          }),
          h(
            'div',
            { class: 'pointer-events-none absolute inset-0 grid', style: { gridTemplateColumns: `repeat(4, ${largeurCol}px)`, gridAutoRows: taille + 'px' } },
            FORMES.map((f) => ANGLES.map((a) => h('div', { key: f.id + a.nom, class: 'p-1 text-[10px] leading-none text-[var(--muted)]' }, `${f.id} · ${a.nom}`)))
          )
        )
      )
    )
}
