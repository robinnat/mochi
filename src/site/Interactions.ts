import { ref } from '@/ui/dom/reactif'
import { c, h, type Composant } from '@/ui/dom/h'
import { Vivant } from './Vivant'
import { INTER_BOT } from './affiches'
import { useReduit } from './reduced'
import { INTERACTIONS_SITE } from './catalog'
import { reveal } from './motion'

export const Interactions: Composant<Record<string, never>> = () => {
  const reduit = useReduit()
  /** Changer la cle remonte le Mochi : il arrive de nouveau, et dit coucou (sans affiche : il pousse du sol). */
  const arrivee = ref(0)
  const rv = [reveal(), reveal(), reveal(1), reveal(2)]
  const rvListe = INTERACTIONS_SITE.map((_, k) => reveal(k))
  return () =>
    h(
      'section',
      { id: 'interactions', class: 'sec', 'aria-labelledby': 't-inter' },
      h(
        'div',
        { class: 'wrap inter' },
        h(
          'div',
          { ref: rv[0], class: 'inter-scene' },
          h('span', { class: 'inter-invite', 'aria-hidden': 'true' }, 'Poke me'),
          c(Vivant, {
            key: arrivee.value + '-' + reduit.value,
            taille: 290,
            affiche: arrivee.value === 0 || reduit.value ? 'inter' : null,
            alt: 'A yellow star Mochi that reacts to the pointer: hover, tap, double tap, press and hold, or shake it',
            bot: { ...INTER_BOT, coucou: arrivee.value > 0 && !reduit.value, frozenAt: reduit.value ? 0 : undefined }
          }),
          h('button', { type: 'button', class: 'btn petit', onClick: () => arrivee.value++ }, 'Say hello again')
        ),
        h(
          'div',
          { class: 'inter-texte' },
          h('p', { ref: rv[1], class: 'surtitre' }, 'Interactions'),
          h('h2', { id: 't-inter', ref: rv[2], class: 'titre-sec' }, 'It reacts', h('br'), 'to you.'),
          h(
            'p',
            { ref: rv[3], class: 'chapo' },
            'The star is live. Each gesture has its own reaction, then it goes back to its mood. On by default; turn them off with ',
            h('code', null, 'interactions="false"'),
            '.'
          ),
          h(
            'ul',
            { class: 'inter-liste' },
            INTERACTIONS_SITE.map((i, k) =>
              h(
                'li',
                { key: i.geste, ref: rvListe[k] },
                h('span', { class: 'inter-geste' }, i.geste),
                h('span', { class: 'inter-nom' }, i.nom),
                h('span', { class: 'inter-detail' }, i.texte)
              )
            )
          ),
          reduit.value ? h('p', { key: 'note', class: 'note' }, 'Reduced motion is on: the reactions are off here.') : null
        )
      )
    )
}
