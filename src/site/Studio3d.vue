<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { FORMES_3D, HUMEURS_SITE } from './catalog'
import type { MoodId } from '@/bot/humeurs'
import { styleSite } from './style'

/**
 * Le modele 3D que l'on tourne a la main et auquel on donne une humeur ou un geste.
 *
 * Perf : le composant est monte par `Lazy` (donc seulement a l'ecran, et demonte en sortant, ce qui
 * arrete la boucle du moteur), Three.js reste en import dynamique dans `MochiBot`, le rendu passe
 * par le contexte WebGL partage et le canvas est borne a 2x. La boucle d'inertie ci-dessous ne
 * tourne QUE tant que le modele bouge ou revient de face : au repos, plus aucune image n'est demandee.
 */
const reduit = useReduit()
const forme = ref('etoile')
const humeur = ref<MoodId>('repos')
const yaw = ref(0)

const f = computed(() => FORMES_3D.find((x) => x.id === forme.value) ?? FORMES_3D[0]!)
const libelle = computed(() => `${f.value.label}, 3D, ${HUMEURS_SITE.find((h) => h.id === humeur.value)!.label}`)

/* ------------------------------------------------------------ orbite a la main */

const SENS = 0.012 // radians par pixel glisse
const FROTTEMENT = 3.2 // inertie : la vitesse est divisee par e toutes les 1/3.2 s
const ATTENTE_RETOUR = 2.6 // secondes sans toucher avant le retour de face
const RETOUR = 5 // raideur du retour (plus grand = plus vif)

let vitesse = 0 // rad/s
let pose = false // un doigt ou une souris est sur le modele
let dernierX = 0
let dernierT = 0
let repos = 0 // secondes depuis le relachement
let raf = 0
let avant = 0

function boucle(ms: number) {
  const dt = avant ? Math.min((ms - avant) / 1000, 0.05) : 0
  avant = ms
  if (!pose) {
    repos += dt
    if (Math.abs(vitesse) > 0.02) {
      yaw.value += vitesse * dt
      vitesse *= Math.exp(-FROTTEMENT * dt)
    } else {
      vitesse = 0
      if (repos > ATTENTE_RETOUR) {
        // retour doux par le chemin le plus court
        const t = Math.atan2(Math.sin(yaw.value), Math.cos(yaw.value))
        yaw.value = t * Math.exp(-RETOUR * dt)
        if (Math.abs(yaw.value) < 0.002) yaw.value = 0
      }
    }
    if (vitesse === 0 && yaw.value === 0) {
      raf = 0
      avant = 0
      return
    }
  }
  raf = requestAnimationFrame(boucle)
}
function reveiller() {
  if (!raf) {
    avant = 0
    raf = requestAnimationFrame(boucle)
  }
}

function enfonce(e: PointerEvent) {
  if (e.button !== undefined && e.button > 0) return
  pose = true
  vitesse = 0
  dernierX = e.clientX
  dernierT = e.timeStamp
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
function bouge(e: PointerEvent) {
  if (!pose) return
  const dx = e.clientX - dernierX
  const dt = Math.max(1, e.timeStamp - dernierT) / 1000
  yaw.value += dx * SENS
  // vitesse lissee : un geste court et lent ne lance pas le modele
  vitesse = vitesse * 0.6 + ((dx * SENS) / dt) * 0.4
  dernierX = e.clientX
  dernierT = e.timeStamp
}
function lache(e: PointerEvent) {
  if (!pose) return
  pose = false
  repos = 0
  // arret net si on s'est arrete avant de relacher
  if (e.timeStamp - dernierT > 90) vitesse = 0
  vitesse = Math.max(-9, Math.min(9, vitesse))
  reveiller()
}
function clavier(e: KeyboardEvent) {
  const pas = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
  if (!pas) return
  e.preventDefault()
  vitesse = pas * 3.2
  repos = 0
  reveiller()
}
function deFace() {
  vitesse = 0
  repos = ATTENTE_RETOUR + 1
  reveiller()
}
onBeforeUnmount(() => cancelAnimationFrame(raf))

/** Signale les valeurs aux outils de capture et de test : l'angle courant, en degres. */
const degres = computed(() => Math.round(((yaw.value * 180) / Math.PI) % 360))
</script>

<template>
  <div class="duo studio">
    <div class="scene large">
      <Lazy :largeur="300" :hauteur="300">
        <div
          class="tourne"
          tabindex="0"
          role="group"
          aria-label="3D model. Drag sideways to turn it, or use the left and right arrow keys."
          :data-yaw="degres"
          @pointerdown="enfonce"
          @pointermove="bouge"
          @pointerup="lache"
          @pointercancel="lache"
          @lostpointercapture="lache"
          @keydown="clavier"
        >
          <MochiBot
            :key="forme + reduit"
            :size="288"
            :shape="forme"
            :color="f.couleur"
            :rendu="styleSite"
            :yaw="yaw"
            :mood="humeur"
            :frozen-at="reduit ? 1 : undefined"
            :label="libelle"
          />
        </div>
      </Lazy>
    </div>
    <div class="panneau">
      <div>
        <h3>Shape</h3>
        <div class="chips" role="group" aria-label="3D shape">
          <button v-for="x in FORMES_3D" :key="x.id" type="button" class="chip" :aria-pressed="forme === x.id" @click="forme = x.id">
            {{ x.label }}
          </button>
        </div>
      </div>
      <div>
        <h3>Mood</h3>
        <div class="chips" role="group" aria-label="Mood">
          <button v-for="h in HUMEURS_SITE" :key="h.id" type="button" class="chip" :aria-pressed="humeur === h.id" @click="humeur = h.id">
            {{ h.label }}
          </button>
        </div>
      </div>
      <div class="rang">
        <button type="button" class="chip" @click="deFace">Face front</button>
        <span class="note">Drag the model sideways to turn it. It settles back facing you.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tourne {
  /* le glissement VERTICAL reste a la page (defilement), l'horizontal est pour le modele */
  touch-action: pan-y;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  border-radius: 14px;
  line-height: 0;
}
.tourne:active {
  cursor: grabbing;
}
.tourne:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 4px;
}
.rang {
  display: grid;
  gap: 8px;
  justify-items: start;
}
</style>
