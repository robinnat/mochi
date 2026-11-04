<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { cheminEnBoucle, dureeSaut } from '@/bot/sauts'
import type { EspaceIso } from '@/ui/trois/iso'
import { useReduit } from './reduced'

/**
 * Trois mochis sautent de case en case sur une grille isometrique. Three.js n'entre dans la
 * page que par `import()`, une fois la scene a l'ecran ; la boucle s'arrete des qu'elle en
 * sort, et avec `prefers-reduced-motion` elle ne tourne jamais (une seule image).
 */
const reduit = useReduit()
const zone = ref<HTMLElement | null>(null)
const toile = ref<HTMLCanvasElement | null>(null)
const etat = ref<'attente' | 'pret' | 'indisponible'>('attente')

interface Acteur {
  id: string
  forme: string
  couleur: string
  chemin: ReturnType<typeof cheminEnBoucle>
  decalage: number
  dernier: number
}
const acteurs: Acteur[] = [
  { id: 'etoile', forme: 'etoile', couleur: 'ambre', chemin: cheminEnBoucle({ x: 0, y: 0 }, 3, 3), decalage: 0, dernier: -1 },
  { id: 'nuage', forme: 'nuage', couleur: 'rose', chemin: cheminEnBoucle({ x: 4, y: 1 }, 1, 4).reverse(), decalage: 0.4, dernier: -1 },
  { id: 'fleur', forme: 'fleur', couleur: 'violet', chemin: cheminEnBoucle({ x: 2, y: 2 }, 3, 2), decalage: 0.9, dernier: -1 }
]

let espace: EspaceIso | null = null
let raf = 0
let obs: IntersectionObserver | null = null
let ro: ResizeObserver | null = null
let visible = false
let creation: Promise<void> | null = null
// horloge propre : elle ne tourne que pendant que la scene est visible
let t = 0
let dernierMs = 0
const d = dureeSaut()

function lancer() {
  for (const a of acteurs) {
    const k = Math.floor((t - a.decalage) / d)
    if (k < 0 || k === a.dernier) continue
    a.dernier = k
    const n = a.chemin.length - 1
    espace!.sauter(a.id, a.chemin[(k % n) + 1]!, a.decalage + k * d)
  }
}

function image(ms: number) {
  raf = 0
  if (!visible || !espace) return
  const dt = dernierMs ? Math.min((ms - dernierMs) / 1000, 0.064) : 0
  dernierMs = ms
  t += dt
  lancer()
  espace.dessiner(t)
  raf = requestAnimationFrame(image)
}

function demarrer() {
  if (!espace || raf || reduit.value) return
  dernierMs = 0
  raf = requestAnimationFrame(image)
}

async function creer() {
  const cv = toile.value
  if (!cv) return
  try {
    const { EspaceIso } = await import('@/ui/trois/iso')
    espace = new EspaceIso(cv, { largeur: 5, hauteur: 5, vue: 'iso', fond: '#ffffff', douceur: 'marque' })
  } catch {
    etat.value = 'indisponible'
    return
  }
  for (const a of acteurs) espace.ajouter(a.id, { forme: a.forme, couleur: a.couleur, case: a.chemin[0]!, decalage: a.decalage })
  if (reduit.value) {
    // une seule image, en plein saut
    for (let s = 0; s < 1.1; s += 1 / 30) {
      t = s
      lancer()
    }
    espace.dessiner(t)
  }
  etat.value = 'pret'
  ro = new ResizeObserver(() => {
    espace?.dimensionner()
    if (reduit.value) espace?.dessiner(t)
  })
  ro.observe(cv)
  if (visible) demarrer()
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !zone.value) return
  obs = new IntersectionObserver(
    (es) => {
      visible = !!es[es.length - 1]?.isIntersecting
      if (visible) {
        creation ??= creer()
        demarrer()
      } else if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    },
    { rootMargin: '120px' }
  )
  obs.observe(zone.value)
})
onBeforeUnmount(() => {
  obs?.disconnect()
  ro?.disconnect()
  cancelAnimationFrame(raf)
  espace?.liberer()
})
</script>

<template>
  <section id="jumps" class="bloc wrap" aria-labelledby="t-sauts">
    <span class="etiquette">Movement</span>
    <h2 id="t-sauts">They get around by jumping</h2>
    <p class="chapo">
      A jump is squash, stretch, flight and landing, with volume conserved: what the body loses in height it
      gains in width. Here three mochis hop from tile to tile on an isometric grid, in real 3D.
    </p>
    <div ref="zone" class="iso" role="img" aria-label="Three mochis, a star, a cloud and a flower, hopping across a grid of tiles">
      <canvas ref="toile" />
      <div v-if="etat !== 'pret'" class="attente">{{ etat === 'indisponible' ? '3D is not available in this browser.' : 'Loading the scene as it scrolls into view...' }}</div>
    </div>
  </section>
</template>
