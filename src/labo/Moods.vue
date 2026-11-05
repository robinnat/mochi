<script setup lang="ts">
import { computed, ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import { MOOD_IDS, REACTION_IDS, type MoodId } from '@/bot/humeurs'

/**
 * `#moods` : le vrai composant, avec ses humeurs et ses interactions branchees sur le pointeur. On y
 * survole, on tape, on double-tape, on appuie longtemps, on tourne vite (glisser sur le cote). La
 * case « interactions » coupe tout ; les boutons jouent une reaction a la main.
 * `?s=<taille>` : cote d'un Mochi ; `?theme=dark`.
 */
const q = new URLSearchParams(location.search)
const taille = Number(q.get('s')) || 240
const theme = q.get('theme') === 'dark' ? 'dark' : 'light'
const humeur = ref<MoodId>('repos')
const interactions = ref(true)
const yaw = ref(0)
const bots = ref<InstanceType<typeof MochiBot>[]>([])
const FORMES = [
  { forme: 'etoile', couleur: 'turquoise' },
  { forme: 'cercle', couleur: 'rose' },
  { forme: 'squircle', couleur: 'ambre' }
]
const info = computed(() => `${humeur.value}${interactions.value ? '' : ' (interactions coupees)'}`)

// glisser sur le cote fait tourner la vue : un tour rapide rend le Mochi etourdi (cf. `yaw`)
const x0 = ref<number | null>(null)
const bouge = (e: PointerEvent) => {
  if (x0.value === null) return
  yaw.value += (e.clientX - x0.value) * 0.02
  x0.value = e.clientX
}
const jouer = (id: string) => bots.value.forEach((b) => b?.react(id))
</script>

<template>
  <div class="p-6" :data-humeur="info">
    <div class="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <button v-for="m in MOOD_IDS" :key="m" type="button" class="rounded border px-2 py-1" :class="humeur === m ? 'font-bold underline' : ''" @click="humeur = m">{{ m }}</button>
      <span class="mx-2">|</span>
      <button v-for="r in REACTION_IDS" :key="r" type="button" class="rounded border px-2 py-1" @click="jouer(r)">{{ r }}</button>
      <label class="ml-4"><input v-model="interactions" type="checkbox" /> interactions</label>
    </div>
    <div class="flex flex-wrap gap-6" :style="theme === 'dark' ? 'background:#1b1922;padding:16px;border-radius:16px' : ''">
      <div
        v-for="(f, i) in FORMES"
        :key="f.forme"
        style="touch-action: pan-y; user-select: none"
        @pointerdown="x0 = $event.clientX"
        @pointermove="bouge"
        @pointerup="x0 = null"
        @pointercancel="x0 = null"
      >
        <MochiBot
          :ref="(el) => (bots[i] = el as InstanceType<typeof MochiBot>)"
          :size="taille"
          :shape="f.forme"
          :color="f.couleur"
          rendu="3d"
          :theme="theme"
          :mood="humeur"
          :interactions="interactions"
          :yaw="yaw"
          :fps="24"
          coucou
        />
      </div>
    </div>
  </div>
</template>
