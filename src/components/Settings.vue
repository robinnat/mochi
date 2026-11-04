<script setup lang="ts">
import { langue, LANGUES, t } from '@/i18n'

/**
 * Clavier du groupe de radios.
 *
 * Declarer `role="radiogroup"` PROMET ce comportement, et des `<button>` ne le
 * donnent pas tout seuls : les fleches doivent deplacer le choix, et le groupe
 * entier ne doit compter que pour UN arret de tabulation. D'ou aussi le
 * `tabindex` mobile dans le gabarit — seule l'option cochee est atteignable par
 * Tab, les fleches font le reste, comme dans un groupe de radios natif.
 */
function auClavier(event: KeyboardEvent, index: number) {
  const pas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!pas) return
  event.preventDefault()
  // on tourne en rond, comme un groupe de radios natif
  const cible = LANGUES[(index + pas + LANGUES.length) % LANGUES.length]!
  langue.value = cible.id
  // le focus suit le choix, sinon les fleches suivantes repartent de l'ancien
  const boutons = (event.currentTarget as HTMLElement).parentElement?.children
  const suivant = boutons?.[LANGUES.indexOf(cible)]
  if (suivant instanceof HTMLElement) suivant.focus()
}
</script>

<template>
  <div>
    <h2 class="text-sm font-semibold">{{ t('settings.language') }}</h2>

    <!--
      Un groupe de boutons radio et non un `<select>` : trois choix se montrent
      entierement, et le drapeau ne se lit pas dans une liste deroulante fermee.

      Chaque bouton porte son `aria-label` en clair plutot que de compter sur le
      nom deduit de son contenu : sur un radio reconstruit, ce calcul n'est pas
      rendu de la meme facon partout, et le nom est ce qui rend le choix
      annoncable. Il reprend exactement le texte visible, comme l'exige le
      critere « intitule dans le nom ».

      `lang` est sur le bouton et pas sur le texte : le nom accessible en herite,
      donc la synthese vocale prononce « 简体中文 » en chinois et non avec la voix
      de la langue courante.
    -->
    <div class="mt-2 flex flex-col gap-1" role="radiogroup" :aria-label="t('settings.language')">
      <button
        v-for="(l, i) in LANGUES"
        :key="l.id"
        type="button"
        role="radio"
        :aria-checked="l.id === langue"
        :aria-label="l.nom"
        :lang="l.tag"
        :tabindex="l.id === langue ? 0 : -1"
        @keydown="auClavier($event, i)"
        class="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition"
        :class="
          l.id === langue
            ? 'border-[var(--ink)] bg-white font-medium'
            : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
        "
        @click="langue = l.id"
      >
        <!-- le drapeau est decoratif : le nom de la langue dit deja tout, et un
             lecteur d'ecran annoncerait « drapeau de la France » pour rien -->
        <span class="text-base leading-none" aria-hidden="true">{{ l.emoji }}</span>
        <span class="flex-1">{{ l.nom }}</span>
        <svg
          v-if="l.id === langue"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          class="shrink-0"
        >
          <path
            d="M2.5 6.4 4.8 8.7 9.5 3.6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
