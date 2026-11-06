<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { urlAffiche } from './affiches'
import { themeEffectif } from './theme'
import { pagePrete, RATIO_MAX, FPS_VIVANT } from './pret'

/**
 * Un Mochi vivant, sans jamais de 2D a l'ecran :
 * 1. l'affiche (image pre-rendue de la vraie 3D, meme cadrage, meme pose) s'affiche tout de suite ;
 * 2. quand l'element est a l'ecran ET que la page est prete, le composant (et Three.js) se charge, invisible ;
 * 3. a sa premiere image 3D (`pret`), il apparait en fondu par-dessus l'affiche.
 * Hors de l'ecran, il est demonte (aucune boucle ne tourne) et l'affiche reprend sa place.
 * Sans affiche (`affiche` nul), la place reste vide jusqu'au fondu.
 */
const MochiBot = defineAsyncComponent(() => import('@/components/MochiBot.vue'))

const props = withDefaults(defineProps<{ taille: number; affiche?: string | null; alt?: string; marge?: string; eager?: boolean }>(), {
  affiche: null,
  alt: '',
  marge: '200px',
  eager: false
})
defineOptions({ inheritAttrs: false })

const racine = ref<HTMLElement | null>(null)
const visible = ref(false)
const monte = ref(false)
const montre = ref(false)
const bot = ref<{ regarder?: (c: { nx: number; ny: number } | null) => void } | null>(null)
defineExpose({ bot })

let obs: IntersectionObserver | null = null
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !racine.value) {
    visible.value = true
    return
  }
  obs = new IntersectionObserver((es) => (visible.value = !!es[es.length - 1]?.isIntersecting), { rootMargin: props.marge })
  obs.observe(racine.value)
})
onBeforeUnmount(() => obs?.disconnect())

watch(
  [visible, pagePrete],
  ([v, p]) => {
    if (v && p) monte.value = true
    else if (!v) {
      monte.value = false
      montre.value = false
    }
  },
  { immediate: true }
)
</script>

<template>
  <div ref="racine" class="vivant" :style="{ width: taille + 'px', height: taille + 'px' }">
    <img
      v-if="affiche"
      class="vivant-affiche"
      :class="{ cache: montre }"
      :src="urlAffiche(affiche, themeEffectif)"
      :width="taille"
      :height="taille"
      :alt="montre ? '' : alt"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      decoding="async"
      draggable="false"
    />
    <div v-if="monte" class="vivant-bot" :class="{ on: montre }">
      <MochiBot ref="bot" v-bind="$attrs" :size="taille" :label="alt" :max-pixel-ratio="RATIO_MAX" :fps="FPS_VIVANT" @pret="montre = true" />
    </div>
  </div>
</template>
