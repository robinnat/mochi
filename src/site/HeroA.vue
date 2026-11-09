<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Affiche from './Affiche.vue'
import Vivant from './Vivant.vue'
import HeroChiffres from './HeroChiffres.vue'
import { useReduit } from './reduced'
import { useLargeur } from './motion'
import { FORMES_3D } from './catalog'
import { useSuiviPointeur } from './heroSuivi'
import type { Selection } from '@/bot/emplacements'

/**
 * Direction A : « le grand Mochi, on joue avec ». Un titre court, un seul grand Mochi vivant (3D) qui suit le pointeur,
 * et une demo immediate dans le hero : un tap change sa forme, un tap habille. Une seule scene 3D ; les puces de forme
 * sont des images pre-rendues.
 */
const reduit = useReduit()
const largeur = useLargeur()
const taille = computed(() => (largeur.value >= 1100 ? 400 : largeur.value >= 700 ? 340 : 260))
const scene = ref<HTMLElement | null>(null)
const vivant = ref<InstanceType<typeof Vivant> | null>(null)
const { yaw } = useSuiviPointeur(scene, (c) => vivant.value?.bot?.regarder?.(c), reduit)

const FORMES = ['cercle', 'etoile', 'nuage', 'fleur', 'goutte', 'oeuf'].map((id) => FORMES_3D.find((f) => f.id === id)!)
const forme = ref(FORMES[0]!)
const PIECES = [
  { cle: 'tete', id: 'casquette', label: 'Cap' },
  { cle: 'yeux', id: 'rondes', label: 'Glasses' },
  { cle: 'bas', id: 'papillon', label: 'Bow tie' }
] as const
const portes = reactive<Record<string, boolean>>({ tete: false, yeux: false, bas: false })
const accessoires = computed<Selection>(() => {
  const s: Selection = {}
  for (const p of PIECES) if (portes[p.cle]) s[p.cle] = p.id
  return s
})
</script>

<template>
  <header id="top" class="hx hx-a">
    <div class="hero-fond" aria-hidden="true" />
    <div class="hx-in hx-centre hx-a-grille">
      <div class="hx-texte hx-a-texte">
      <p class="hero-badge rv-load" style="--d: 0"><span class="point" aria-hidden="true" /> Open source, MIT</p>
      <h1 class="hx-titre rv-load" style="--d: 1">Meet <span class="accent">Mochi.</span></h1>
      <p class="hx-chapo rv-load" style="--d: 2">
        A tiny 3D avatar for your app or site. It breathes, blinks, follows your finger and reacts when you touch it.
      </p>
      </div>

      <div ref="scene" class="hx-scene" :style="{ '--t': taille + 'px' }">
        <div class="hero-halo" aria-hidden="true" />
        <Vivant
          ref="vivant"
          :key="'a' + reduit"
          :taille="taille"
          affiche="hero"
          eager
          marge="0px"
          :shape="forme.id"
          :color="forme.couleur"
          rendu="3d"
          mood="repos"
          :accessoires="accessoires"
          :yaw="yaw"
          :frozen-at="reduit ? 0 : undefined"
          alt="A 3D Mochi avatar. It looks at your pointer; tap it, double tap it or press and hold."
        />
      </div>

      <div class="hx-essai rv-load" style="--d: 3">
        <p class="hx-essai-titre">Try it</p>
        <div class="hx-puces" role="group" aria-label="Change the shape">
          <button
            v-for="f in FORMES"
            :key="f.id"
            type="button"
            class="hx-forme"
            :class="{ on: forme.id === f.id }"
            :aria-pressed="forme.id === f.id"
            :aria-label="f.label"
            @click="forme = f"
          >
            <Affiche :nom="`forme-${f.id}-3d`" :taille="40" />
          </button>
        </div>
        <div class="hx-puces" role="group" aria-label="Dress it up">
          <button
            v-for="p in PIECES"
            :key="p.cle"
            type="button"
            class="hx-puce"
            :class="{ on: portes[p.cle] }"
            :aria-pressed="!!portes[p.cle]"
            @click="portes[p.cle] = !portes[p.cle]"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <div class="actions hx-actions rv-load" style="--d: 4">
        <a class="btn primaire" href="/app">Try the app <span aria-hidden="true">→</span></a>
        <a class="btn" href="/docs">Read the docs</a>
      </div>
    </div>
    <HeroChiffres />
  </header>
</template>
