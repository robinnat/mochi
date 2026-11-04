<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SHAPES } from '@/bot/skins'

/**
 * `#tour` : chaque forme sous quatre angles (face, trois quarts, profil, dos), pour juger
 * le volume de tous les cotes, comme dans une scene ou le mochi tourne librement.
 * `?f=squircle,cercle` ne garde que ces formes ; `?c=<couleur>` ; `?t=<date>` fige l'image ;
 * `?s=<taille>` : cote d'une cellule en pixels ; `?e=<degres>` : hauteur de la camera.
 * La page rend tout dans UN canvas (une seule scene WebGL, une cellule par vue).
 */
const q = new URLSearchParams(location.search)
const gardees = q.get('f')?.split(',')
const FORMES = gardees ? SHAPES.filter((s) => gardees.includes(s.id)) : SHAPES
const ANGLES = [
  { nom: 'face', deg: 0 },
  { nom: 'trois quarts', deg: 40 },
  { nom: 'profil', deg: 90 },
  { nom: 'dos', deg: 180 }
]
const taille = Number(q.get('s')) || 170
const couleur = q.get('c') ?? 'violet'
const t = Number(q.get('t')) || 1.2
const elevation = ((Number(q.get('e')) || 12) * Math.PI) / 180
const toile = ref<HTMLCanvasElement | null>(null)
const pret = ref(false)
const largeurCol = taille
let liberer = () => {}

onMounted(async () => {
  const [three, { Mochi3d, lumieres }, { BotEngine }, { RAYON, DEMI_VIEWBOX }, { COLOR_BY_ID }] = await Promise.all([
    import('three'),
    import('@/ui/trois/scene3d'),
    import('@/bot/engine'),
    import('@/bot/repere'),
    import('@/bot/skins')
  ])
  const cv = toile.value
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
  FORMES.forEach((f, i) => {
    const m = new Mochi3d(512)
    m.setRendu('doux', false, 'marque', true)
    m.setForme(f.id)
    const moteur = new BotEngine(RAYON, 'idle', f.radii, null)
    m.maj(moteur.sample(t), hex, '#f9f9f9')
    m.mesh.position.y = 0
    corps.push(m)
    void i
  })
  renderer.clear()
  FORMES.forEach((_, i) => {
    const m = corps[i]!
    scene.add(m.mesh)
    ANGLES.forEach((a, j) => {
      m.mesh.rotation.y = (a.deg * Math.PI) / 180
      const c = m.mesh.geometry.boundingSphere?.center
      const cy = c?.y ?? 0
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
onBeforeUnmount(() => liberer())
</script>

<template>
  <main class="p-4">
    <h1 class="mb-3 text-lg font-bold">Tour des formes : face, trois quarts, profil, dos</h1>
    <div class="relative inline-block" :data-pret="pret ? '1' : '0'">
      <canvas ref="toile" :style="{ width: 4 * largeurCol + 'px', height: FORMES.length * taille + 'px' }" />
      <div
        class="pointer-events-none absolute inset-0 grid"
        :style="{ gridTemplateColumns: `repeat(4, ${largeurCol}px)`, gridAutoRows: taille + 'px' }"
      >
        <template v-for="f in FORMES" :key="f.id">
          <div v-for="a in ANGLES" :key="f.id + a.nom" class="p-1 text-[10px] leading-none text-[var(--muted)]">
            {{ f.id }} · {{ a.nom }}
          </div>
        </template>
      </div>
    </div>
  </main>
</template>
