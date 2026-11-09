<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { PIECES, TAILLE_PIECE, urlPiece } from './affiches'
import { ACCESSOIRES_SITE } from './catalog'
import { useReduit } from './reduced'
import { themeEffectif } from './theme'

/**
 * Bande d'accessoires SEULS (sans le Mochi) qui defile en continu, comme un bandeau. Aucune 3D : ce sont les images
 * pre-rendues des pieces (`public/rendus/piece-*.webp`, celles du selecteur de « Make it yours »), la liste est
 * dupliquee et decalee en CSS (`transform` seulement). En pause hors ecran et onglet cache ; avec
 * `prefers-reduced-motion`, la bande reste fixe (pas de defilement, on la parcourt au doigt).
 */
const reduit = useReduit()
const racine = ref<HTMLElement | null>(null)
const actif = ref(false)
let obs: IntersectionObserver | null = null
let visible = false
const maj = () => (actif.value = visible && !document.hidden)

const pieces = PIECES.map((p) => ({
  cle: `${p.emplacement}:${p.id}`,
  e: p.emplacement,
  id: p.id,
  label: ACCESSOIRES_SITE(p.emplacement).find((a) => a.id === p.id)?.label ?? p.id
}))

onMounted(() => {
  document.addEventListener('visibilitychange', maj)
  if (typeof IntersectionObserver === 'undefined' || !racine.value) {
    visible = true
    maj()
    return
  }
  obs = new IntersectionObserver(
    (es) => {
      visible = !!es[es.length - 1]?.isIntersecting
      maj()
    },
    { rootMargin: '80px' }
  )
  obs.observe(racine.value)
})
onBeforeUnmount(() => {
  obs?.disconnect()
  document.removeEventListener('visibilitychange', maj)
})
</script>

<template>
  <div ref="racine" class="bande-pieces" :class="{ fixe: reduit, pause: !actif }" role="group" aria-label="Every accessory, on its own">
    <ul class="bande-piste">
      <template v-for="copie in reduit ? 1 : 2" :key="copie">
        <li v-for="p in pieces" :key="copie + p.cle" :aria-hidden="copie === 2 ? 'true' : undefined">
          <img :src="urlPiece(p.e, p.id, themeEffectif)" :width="TAILLE_PIECE / 2" :height="TAILLE_PIECE / 2" :alt="copie === 1 ? p.label : ''" loading="lazy" decoding="async" draggable="false" />
        </li>
      </template>
    </ul>
  </div>
</template>
