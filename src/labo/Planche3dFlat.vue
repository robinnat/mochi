<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import type { RenduId } from '@/ui/rendu'
import type { Douceur, Rendu3d } from '@/ui/trois/rendu3d'

/**
 * `#formes3d` : le flat 2D, l'aplat (ancien defaut, sans puis avec contour cartoon) et la matiere
 * `doux` (ombrage lisse, deux reglages : leger et marque), sur cinq formes. `?s=<taille>` ; `?t=<date>` fige l'image ; `?c=<couleur>`
 * impose une seule couleur (sinon une couleur du flat par forme) ; `?v=lignes` met un style
 * par LIGNE et une forme par colonne (portrait, lisible sur telephone).
 */
interface Variante {
  lettre: string
  nom: string
  rendu: RenduId
  rendu3d?: Rendu3d
  douceur?: Douceur
  contour?: boolean
  reflet?: boolean
}
const TOUTES: Variante[] = [
  { lettre: '', nom: 'flat 2D (actuel)', rendu: 'original' },
  { lettre: '', nom: '3D aplat (ancien)', rendu: '3d', rendu3d: 'aplat', contour: false },
  { lettre: '', nom: '3D aplat + contour cartoon', rendu: '3d', rendu3d: 'aplat', contour: true },
  { lettre: '', nom: '3D doux (leger)', rendu: '3d', rendu3d: 'doux', douceur: 'leger', contour: false },
  { lettre: '', nom: '3D doux marque + reflet (defaut)', rendu: '3d', rendu3d: 'doux', douceur: 'marque', contour: false },
  { lettre: '', nom: '3D doux marque sans reflet', rendu: '3d', rendu3d: 'doux', douceur: 'marque', contour: false, reflet: false }
]
const q = new URLSearchParams(location.search)
// `?x=1,3,4` ne garde que ces colonnes ou lignes (indices de la liste), `?f=etoile` (ou `?f=cercle,etoile,nuage`) que ces formes
const gardees = q.get('x')?.split(',').map(Number)
const VARIANTES = gardees ? TOUTES.filter((_, i) => gardees.includes(i)) : TOUTES
// cinq formes, chacune dans une couleur du flat (les memes que le personnalisateur)
const TOUTES_FORMES = [
  { id: 'cercle', couleur: 'violet' },
  { id: 'etoile', couleur: 'ambre' },
  { id: 'nuage', couleur: 'rose' },
  { id: 'fleur', couleur: 'turquoise' },
  { id: 'goutte', couleur: 'bleu' }
]
const FORMES = q.get('f') ? TOUTES_FORMES.filter((f) => q.get('f')!.split(',').includes(f.id)) : TOUTES_FORMES
const taille = Number(q.get('s')) || 150
const t = Number(q.get('t')) || 1.2
const imposee = q.get('c')
const lignes = q.get('v') === 'lignes'

const cle = (f: { id: string }, v: Variante) =>
  `${f.id}-${v.rendu3d ?? 'flat'}${v.douceur ? '-' + v.douceur : ''}${v.contour ? '-contour' : ''}${v.reflet === false ? '-sansreflet' : ''}`
</script>

<template>
  <main class="p-4">
    <h1 class="mb-3 text-lg font-bold">3D : aplat, doux leger, doux marque</h1>

    <!-- une variante par ligne, une forme par colonne : portrait -->
    <div
      v-if="lignes"
      class="grid items-center gap-x-1 gap-y-1"
      :style="{ gridTemplateColumns: `120px repeat(${FORMES.length}, ${taille}px)` }"
    >
      <div />
      <div v-for="f in FORMES" :key="f.id" class="text-center text-xs text-[var(--muted)]">{{ f.id }}</div>
      <template v-for="v in VARIANTES" :key="v.nom">
        <div class="leading-tight" data-entete>
          <div v-if="v.lettre" class="text-4xl font-black">{{ v.lettre }}</div>
          <div class="text-xs font-semibold" :class="v.lettre ? '' : 'text-[var(--muted)]'">{{ v.nom }}</div>
        </div>
        <MochiBot
          v-for="f in FORMES"
          :key="f.id"
          :size="taille"
          :shape="f.id"
          :color="imposee ?? f.couleur"
          :rendu="v.rendu"
          :rendu3d="v.rendu3d"
          :douceur="v.douceur"
          :contour="v.contour"
          :reflet="v.reflet"
          :frozen-at="t"
          :cycle="[{ state: 'idle', duration: 3 }]"
          :data-cell="cle(f, v)"
        />
      </template>
    </div>

    <!-- une variante par colonne, une forme par ligne -->
    <div
      v-else
      class="grid items-center gap-x-2 gap-y-1"
      :style="{ gridTemplateColumns: `70px repeat(${VARIANTES.length}, ${taille}px)` }"
    >
      <div />
      <div v-for="v in VARIANTES" :key="v.nom" class="text-center leading-tight" data-entete>
        <div v-if="v.lettre" class="text-3xl font-black">{{ v.lettre }}</div>
        <div class="text-xs font-semibold" :class="v.lettre ? '' : 'text-[var(--muted)]'">{{ v.nom }}</div>
      </div>
      <template v-for="f in FORMES" :key="f.id">
        <div class="text-xs text-[var(--muted)]">{{ f.id }}</div>
        <MochiBot
          v-for="v in VARIANTES"
          :key="v.nom"
          :size="taille"
          :shape="f.id"
          :color="imposee ?? f.couleur"
          :rendu="v.rendu"
          :rendu3d="v.rendu3d"
          :douceur="v.douceur"
          :contour="v.contour"
          :reflet="v.reflet"
          :frozen-at="t"
          :cycle="[{ state: 'idle', duration: 3 }]"
          :data-cell="cle(f, v)"
        />
      </template>
    </div>
  </main>
</template>
