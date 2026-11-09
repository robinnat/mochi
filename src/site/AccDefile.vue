<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { DEFILE, TAILLE_DEFILE, urlAffiche } from './affiches'
import type { Choix, Emplacement } from '@/bot/emplacements'
import { ACCESSOIRES_SITE } from './catalog'
import { useReduit } from './reduced'
import { themeEffectif } from './theme'

/**
 * Carte « accessoires » : une liste fixe de Mochi (corps, couleurs, une piece par emplacement) defile en boucle
 * (environ 1,3 s chacun), pour montrer tout ce qui est possible. Aucune 3D ici : chaque etape est une image pre-rendue de la vraie 3D
 * (`public/rendus/defile-*.webp`), on ne fait que changer d'image. Le minuteur ne tourne que si la carte est a
 * l'ecran et l'onglet visible ; avec `prefers-reduced-motion`, un seul accessoire reste affiche, fixe.
 */
const PAUSE_MS = 1300
const reduit = useReduit()
const racine = ref<HTMLElement | null>(null)
const rang = ref(0)
let minuteur = 0
let obs: IntersectionObserver | null = null
let visible = false

const etapes = DEFILE.map((d) => ({
  nom: d.nom,
  label: (Object.entries(d.variante.acc) as [Emplacement, Choix][])
    .map(([e, ch]) => ACCESSOIRES_SITE(e).find((a) => a.id === (typeof ch === 'string' ? ch : ch.id))?.label)
    .filter(Boolean)
    .join(', ')
}))
const courant = computed(() => etapes[reduit.value ? 0 : rang.value % etapes.length]!)
const src = computed(() => urlAffiche(courant.value.nom, themeEffectif.value))

/** Charge les images de l'autre etape a l'avance, pour que le changement soit instantane. */
const prechargees = new Set<string>()
function precharger() {
  for (const e of etapes) {
    const u = urlAffiche(e.nom, themeEffectif.value)
    if (prechargees.has(u)) continue
    prechargees.add(u)
    const im = new Image()
    im.decoding = 'async'
    im.src = u
  }
}

function arreter() {
  if (minuteur) clearInterval(minuteur)
  minuteur = 0
}
function demarrer() {
  if (minuteur || reduit.value || !visible || document.hidden) return
  precharger()
  minuteur = window.setInterval(() => (rang.value = (rang.value + 1) % etapes.length), PAUSE_MS)
}
const surVisibilite = () => (document.hidden ? arreter() : demarrer())

onMounted(() => {
  document.addEventListener('visibilitychange', surVisibilite)
  if (typeof IntersectionObserver === 'undefined' || !racine.value) return
  obs = new IntersectionObserver(
    (es) => {
      visible = !!es[es.length - 1]?.isIntersecting
      if (visible) demarrer()
      else arreter()
    },
    { rootMargin: '80px' }
  )
  obs.observe(racine.value)
})
onBeforeUnmount(() => {
  arreter()
  obs?.disconnect()
  document.removeEventListener('visibilitychange', surVisibilite)
})
</script>

<template>
  <div ref="racine" class="acc-defile">
    <div class="acc-defile-scene">
      <!-- le Mochi qui part s'ecrase puis s'etire vers le haut ; le suivant arrive avec un petit « pop » a ressort -->
      <Transition name="acc">
        <img
          :key="courant.nom"
          class="affiche acc-defile-img"
          :src="src"
          :width="TAILLE_DEFILE"
          :height="TAILLE_DEFILE"
          :alt="`A Mochi wearing: ${courant.label}`"
          decoding="async"
          draggable="false"
        />
      </Transition>
    </div>
  </div>
</template>
