<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Page labo : deux vues choisies par le hash. `#formes` est la planche de toutes les
 * formes dans les quatre styles, `#iso` la scene isometrique. La scene (donc Three.js) ne
 * se charge que sur `#iso`, par un composant asynchrone.
 */
import PlancheFormes from './PlancheFormes.vue'
const Planche3dFlat = defineAsyncComponent(() => import('./Planche3dFlat.vue'))
const SceneIso = defineAsyncComponent(() => import('./SceneIso.vue'))
const TourFormes = defineAsyncComponent(() => import('./TourFormes.vue'))
const Moods = defineAsyncComponent(() => import('./Moods.vue'))

const lire = () =>
  location.hash.startsWith('#moods')
    ? 'moods'
    : location.hash.startsWith('#tour')
    ? 'tour'
    : location.hash.startsWith('#formes3d')
    ? 'formes3d'
    : location.hash.startsWith('#iso') || location.hash.startsWith('#gros')
      ? 'iso'
      : 'formes'
const vue = ref<'formes' | 'formes3d' | 'iso' | 'tour' | 'moods'>(lire())
const maj = () => (vue.value = lire())
onMounted(() => window.addEventListener('hashchange', maj))
onBeforeUnmount(() => window.removeEventListener('hashchange', maj))
</script>

<template>
  <div class="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
    <nav class="flex items-center gap-4 border-b border-[var(--line)] px-4 py-3 text-sm">
      <strong>Mochi labo</strong>
      <a href="#formes" :class="vue === 'formes' ? 'font-bold underline' : 'text-[var(--muted)]'">formes</a>
      <a href="#formes3d" :class="vue === 'formes3d' ? 'font-bold underline' : 'text-[var(--muted)]'">formes 3D</a>
 <a href="#moods" :class="vue === 'moods' ? 'font-bold underline' : 'text-[var(--muted)]'">moods</a>
 <a href="#tour" :class="vue === 'tour' ? 'font-bold underline' : 'text-[var(--muted)]'">tour</a>
      <a href="#iso" :class="vue === 'iso' ? 'font-bold underline' : 'text-[var(--muted)]'">iso</a>
    </nav>
    <PlancheFormes v-if="vue === 'formes'" />
    <Planche3dFlat v-else-if="vue === 'formes3d'" />
    <TourFormes v-else-if="vue === 'tour'" />
    <Moods v-else-if="vue === 'moods'" />
    <SceneIso v-else />
  </div>
</template>
