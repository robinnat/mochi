<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import { SHAPES } from '@/bot/skins'
import type { RenduId } from '@/ui/rendu'

/** Les quatre styles : plat (l'original), pixel art, pate (argile) et vraie 3D. */
const STYLES: { id: RenduId; nom: string }[] = [
  { id: 'original', nom: 'flat' },
  { id: 'pixel', nom: 'pixel' },
  { id: 'argile', nom: 'pâte' },
  { id: '3d', nom: '3D' }
]
// `?c=` : couleur de la planche (par defaut, la couleur choisie du moteur)
const couleur = new URLSearchParams(location.search).get('c') ?? 'encre'
const taille = Number(new URLSearchParams(location.search).get('s')) || 120
const t = Number(new URLSearchParams(location.search).get('t')) || 1.2
</script>

<template>
  <main class="p-4">
    <h1 class="mb-3 text-lg font-bold">Formes x styles</h1>
    <div
      class="grid items-center gap-2"
      :style="{ gridTemplateColumns: `90px repeat(${STYLES.length}, ${taille}px)` }"
    >
      <div />
      <div v-for="s in STYLES" :key="s.id" class="text-center text-xs font-semibold">{{ s.nom }}</div>
      <template v-for="f in SHAPES" :key="f.id">
        <div class="text-xs text-[var(--muted)]">{{ f.id }}</div>
        <MochiBot
          v-for="s in STYLES"
          :key="s.id"
          :size="taille"
          :shape="f.id"
          :color="couleur"
          :rendu="s.id"
          :frozen-at="t"
          :cycle="[{ state: 'idle', duration: 3 }]"
          :data-cell="`${f.id}-${s.id}`"
        />
      </template>
    </div>
  </main>
</template>
