import { ref } from '@/ui/dom/reactive'
import { h, onUnmount, onMount, type Component } from '@/ui/dom/h'
import { BotEngine, load3d, COLOR_BY_ID, HALF_VIEWBOX, RADIUS, SHAPES } from 'mochiz'
import { sizeCell } from './width'

/**
 * `#turn`: each shape from four angles (front, three quarters, profile, back), to judge the volume from every side.
 * `?f=squircle,circle` only keeps those shapes; `?c=<color>`; `?t=<time>` freezes the image; `?s=<size>`: side of a
 * cell in pixels; `?e=<degrees>`: camera height. The page renders everything in ONE canvas (a single WebGL scene, a
 * cell per angle).
 */
const ANGLES = [
  { name: 'face', deg: 0 },
  { name: 'three quarters', deg: 40 },
  { name: 'profile', deg: 90 },
  { name: 'back', deg: 180 }
]

export const ShapeTurntable: Component<Record<string, never>> = () => {
  const q = new URLSearchParams(location.search)
  const kept = q.get('f')?.split(',')
  const SHAPE_LIST = kept ? SHAPES.filter((s) => kept.includes(s.id)) : SHAPES
  const size = sizeCell(170, 4, 0, 0)
  const color = q.get('c') ?? 'violet'
  const t = Number(q.get('t')) || 1.2
  const elevation = ((Number(q.get('e')) || 12) * Math.PI) / 180
  let canvas: HTMLCanvasElement | null = null
  const ready = ref(false)
  const widthCol = size
  let liberer = () => {}

  onMount(async () => {
    const [three, { Mochi3d, lights }] = await Promise.all([import('three'), load3d()])
    const cv = canvas
    if (!cv) return
    const hex = COLOR_BY_ID.get(color)?.hex ?? color
    const L = 4 * widthCol
    const H = SHAPE_LIST.length * size
    const renderer = new three.WebGLRenderer({ canvas: cv, antialias: true })
    renderer.setPixelRatio(1)
    renderer.setSize(L, H, false)
    renderer.outputColorSpace = three.SRGBColorSpace
    renderer.setScissorTest(true)
    renderer.setClearColor(new three.Color(0xf9f9f9), 1)
    const scene = new three.Scene()
    const l = lights()
    for (const x of l.all) scene.add(x)
    const half = HALF_VIEWBOX * 0.8
    const camera = new three.OrthographicCamera(-half, half, half, -half, 1, 4000)
    const body: InstanceType<typeof Mochi3d>[] = []
    for (const f of SHAPE_LIST) {
      const m = new Mochi3d(512)
      m.setRenderStyle('soft')
      m.setShape(f.id)
      const engine = new BotEngine(RADIUS, 'idle', f.radii, null)
      m.update(engine.sample(t), hex, '#f9f9f9')
      m.mesh.position.y = 0
      body.push(m)
    }
    renderer.clear()
    SHAPE_LIST.forEach((_, i) => {
      const m = body[i]!
      scene.add(m.mesh)
      ANGLES.forEach((a, j) => {
        m.mesh.rotation.y = (a.deg * Math.PI) / 180
        const cy = m.mesh.geometry.boundingSphere?.center?.y ?? 0
        camera.position.set(0, cy + 1000 * Math.sin(elevation), 1000 * Math.cos(elevation))
        camera.lookAt(0, cy, 0)
        // light fixed in camera space: the Mochi turns, not the light
        const x = j * widthCol
        const y = (SHAPE_LIST.length - 1 - i) * size
        renderer.setViewport(x, y, widthCol, size)
        renderer.setScissor(x, y, widthCol, size)
        renderer.render(scene, camera)
      })
      scene.remove(m.mesh)
    })
    ready.value = true
    liberer = () => {
      for (const m of body) m.liberer()
      renderer.dispose()
    }
  })
  onUnmount(() => liberer())

  return () =>
    h(
      'main',
      { class: 'p-4' },
      h('h1', { class: 'mb-3 text-lg font-bold' }, 'Shape turntable: front, three quarters, profile, back'),
      h(
        'div',
        { class: 'max-w-full overflow-x-auto' },
        h(
          'div',
          { class: 'relative inline-block', 'data-ready': ready.value ? '1' : '0' },
          h('canvas', {
            ref: (el: Element | null) => (canvas = el as HTMLCanvasElement | null),
            style: { width: 4 * widthCol + 'px', height: SHAPE_LIST.length * size + 'px' }
          }),
          h(
            'div',
            { class: 'pointer-events-none absolute inset-0 grid', style: { gridTemplateColumns: `repeat(4, ${widthCol}px)`, gridAutoRows: size + 'px' } },
            SHAPE_LIST.map((f) => ANGLES.map((a) => h('div', { key: f.id + a.name, class: 'p-1 text-[10px] leading-none text-[var(--muted)]' }, `${f.id} · ${a.name}`)))
          )
        )
      )
    )
}
