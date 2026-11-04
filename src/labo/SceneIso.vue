<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { cheminEnBoucle, dureeSaut, type Case } from '@/bot/sauts'
import type { EspaceIso } from '@/ui/trois/iso'
import { estRendu3d } from '@/ui/trois/rendu3d'

/**
 * Demo minimale de l'espace isometrique (`#iso`) et gros plan 3D en trois quarts (`#gros`).
 * Trois mochis (etoile, nuage, fleur) sautent de case en case sur une grille de 5x5.
 * `?t=1.2` fige la scene a cette date (captures reproductibles) ; sans `t`, elle tourne.
 */
const toile = ref<HTMLCanvasElement | null>(null)
const info = ref('')
const gros = location.hash.startsWith('#gros')
const params = new URLSearchParams(location.search)
const fige = params.has('t') ? Number(params.get('t')) : null
// `?r=aplat|realiste|toon|toon-contour|lowpoly` : matiere ; sans `r`, doux marque (defaut ; `?d=leger`) ; `?contour=1` : contour cartoon
const r3d = estRendu3d(params.get('r') ?? '') ? (params.get('r') as import('@/ui/trois/rendu3d').Rendu3d) : undefined

interface Acteur {
  id: string
  forme: string
  couleur: string
  /** boucle de cases : le dernier point est le premier */
  chemin: Case[]
  decalage: number
  /** indice du dernier saut lance */
  dernier: number
}

const acteurs: Acteur[] = [
  { id: 'etoile', forme: 'etoile', couleur: 'ambre', chemin: cheminEnBoucle({ x: 0, y: 0 }, 3, 3), decalage: 0, dernier: -1 },
  { id: 'nuage', forme: 'nuage', couleur: 'rose', chemin: cheminEnBoucle({ x: 4, y: 1 }, 1, 4).reverse(), decalage: 0.4, dernier: -1 },
  { id: 'fleur', forme: 'fleur', couleur: 'violet', chemin: cheminEnBoucle({ x: 2, y: 2 }, 3, 2), decalage: 0.9, dernier: -1 }
]

let espace: EspaceIso | null = null
let raf = 0

onMounted(async () => {
  // Three.js n'entre dans la page que par cet import dynamique
  const { EspaceIso } = await import('@/ui/trois/iso')
  if (!toile.value) return
  espace = new EspaceIso(toile.value, { largeur: 5, hauteur: 5, vue: gros ? 'gros' : 'iso', rendu3d: r3d, contour: params.get('contour') === '1', douceur: params.get('d') === 'leger' ? 'leger' : 'marque' })
  const d = dureeSaut()

  if (gros) {
    ;[-1.25, 0, 1.25].forEach((dx, i) => {
      const a = acteurs[i]!
      espace!.ajouter(a.id, { forme: a.forme, couleur: a.couleur, case: { x: dx + 2, y: 2 } })
    })
    espace.dessiner(fige ?? 1.2)
    return
  }

  for (const a of acteurs) {
    espace.ajouter(a.id, { forme: a.forme, couleur: a.couleur, case: a.chemin[0]!, decalage: a.decalage })
  }

  /** Lance les sauts dont l'heure est venue (un par duree de saut et par mochi). */
  const lancer = (t: number) => {
    for (const a of acteurs) {
      const k = Math.floor((t - a.decalage) / d)
      if (k < 0 || k === a.dernier) continue
      a.dernier = k
      const n = a.chemin.length - 1
      espace!.sauter(a.id, a.chemin[(k % n) + 1]!, a.decalage + k * d)
    }
  }

  const rendre = (t: number) => {
    lancer(t)
    const t0 = performance.now()
    espace!.dessiner(t)
    info.value = `${(performance.now() - t0).toFixed(1)} ms par image`
  }

  if (params.has('bench')) {
    // mesure : 120 images d'affilee, GL termine a chaque fois. En navigateur sans GPU
    // (swiftshader) le chiffre est un PIRE cas, pas la mesure d'un iPhone.
    const gl = espace.renderer.getContext()
    const t0 = performance.now()
    for (let i = 0; i < 40; i++) {
      lancer(i / 60)
      espace.dessiner(i / 60)
      gl.finish()
    }
    const complet = (performance.now() - t0) / 40
    const t1 = performance.now()
    for (let i = 0; i < 40; i++) {
      lancer(i / 60)
      espace.dessiner(i / 60, false)
    }
    const js = (performance.now() - t1) / 40
    info.value = `bench: ${complet.toFixed(2)} ms par image (3 mochis), dont ${js.toFixed(2)} ms de mise a jour JS (sans WebGL)`
    return
  }
  if (fige !== null) {
    // fige : on rejoue les lancers depuis 0 pour arriver a `fige` dans le bon etat
    for (let s = 0; s < fige; s += 1 / 30) lancer(s)
    rendre(fige)
    return
  }
  const boucle = (ms: number) => {
    rendre(ms / 1000)
    raf = requestAnimationFrame(boucle)
  }
  raf = requestAnimationFrame(boucle)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  espace?.liberer()
})
</script>

<template>
  <main class="relative">
    <canvas ref="toile" class="block h-[calc(100vh-49px)] w-full" />
    <p class="absolute bottom-2 left-3 text-xs text-[var(--muted)]">{{ info }}</p>
  </main>
</template>
