import { computed, ref, watch } from '@/ui/dom/reactif'
import { c, h, surDemontage, type Composant } from '@/ui/dom/h'
import { Vivant } from './Vivant'
import { MOODS_BOT } from './affiches'
import { useReduit } from './reduced'
import { reveal, useVisible } from './motion'
import { HUMEURS_SITE } from './catalog'

/**
 * Les sept humeurs. Elles defilent seules tant que la section est a l'ecran (une barre montre le temps qui reste) ;
 * un clic choisit une humeur et arrete le defilement. Le Mochi n'est pas remonte : `mood` change et le moteur glisse
 * d'une humeur a l'autre.
 */
const DUREE = 4200

export const Moods: Composant<Record<string, never>> = () => {
  const reduit = useReduit()
  const zone = ref<HTMLElement | null>(null)
  const visible = useVisible(zone)
  const actif = ref(0)
  const auto = ref(true)
  const humeur = computed(() => HUMEURS_SITE[actif.value]!)

  let minuteur = 0
  watch(
    [visible, auto, actif, reduit],
    ([v, a, , r]) => {
      clearTimeout(minuteur)
      if (v && a && !r) minuteur = window.setTimeout(() => (actif.value = (actif.value + 1) % HUMEURS_SITE.length), DUREE)
    },
    { immediate: true }
  )
  surDemontage(() => clearTimeout(minuteur))

  function choisir(i: number) {
    auto.value = false
    actif.value = i
  }
  const rv = [reveal(), reveal(1), reveal(2), reveal(3), reveal(2)]

  return () =>
    h(
      'section',
      { id: 'moods', ref: (el: Element | null) => (zone.value = el as HTMLElement | null), class: 'sec', 'aria-labelledby': 't-moods' },
      h(
        'div',
        { class: 'wrap moods' },
        h(
          'div',
          { class: 'moods-texte' },
          h('p', { ref: rv[0], class: 'surtitre' }, 'Moods'),
          h('h2', { id: 't-moods', ref: rv[1], class: 'titre-sec' }, 'Seven moods.', h('br'), 'One body.'),
          h(
            'p',
            { ref: rv[2], class: 'chapo' },
            'A mood changes the face and the way the body moves, and loops until you change it. Set it with ',
            h('code', null, 'mood="travaille"'),
            ' or call ',
            h('code', null, 'setMood()'),
            '.'
          ),
          h(
            'ul',
            { ref: rv[3], class: 'moods-liste', role: 'list' },
            HUMEURS_SITE.map((hm, i) =>
              h(
                'li',
                { key: hm.id },
                h(
                  'button',
                  { type: 'button', class: ['mood', { on: i === actif.value }], 'aria-pressed': i === actif.value, onClick: () => choisir(i) },
                  h('span', { class: 'mood-nom' }, hm.label),
                  h('code', { class: 'mood-id' }, hm.id),
                  i === actif.value && auto.value && visible.value && !reduit.value
                    ? h('span', { key: 'barre' + actif.value, class: 'mood-barre', style: { '--duree': DUREE + 'ms' }, 'aria-hidden': 'true' })
                    : null
                )
              )
            )
          )
        ),
        h(
          'div',
          { ref: rv[4], class: 'moods-scene' },
          c(Vivant, {
            key: 'm' + reduit.value,
            taille: 320,
            affiche: 'moods',
            alt: 'A teal Mochi in the mood: ' + humeur.value.label,
            bot: { ...MOODS_BOT, mood: humeur.value.id, frozenAt: reduit.value ? 0 : undefined, interactions: false }
          }),
          h('p', { class: 'moods-legende', 'aria-live': 'polite' }, h('strong', null, `${humeur.value.label}.`), ` ${humeur.value.texte}`)
        )
      )
    )
}
