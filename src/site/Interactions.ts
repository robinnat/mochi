import { ref } from '@/ui/dom/reactive'
import { c, h, type Component } from '@/ui/dom/h'
import { Alive } from './Alive'
import { INTER_BOT } from './posters'
import { useReduced } from './reduced'
import { INTERACTIONS_SITE } from './catalog'
import { reveal } from './motion'

export const Interactions: Component<Record<string, never>> = () => {
  const reduced = useReduced()
  /** Changer la cle remonte le Mochi : il arrive de nouveau, et dit coucou (sans affiche : il pousse du sol). */
  const arrival = ref(0)
  const rv = [reveal(), reveal(), reveal(1), reveal(2)]
  const rvList = INTERACTIONS_SITE.map((_, k) => reveal(k))
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
          c(Alive, {
            key: arrival.value + '-' + reduced.value,
            size: 290,
            poster: arrival.value === 0 || reduced.value ? 'inter' : null,
            alt: 'A yellow star Mochi that reacts to the pointer: hover, tap, double tap, press and hold, or shake it',
            bot: { ...INTER_BOT, wave: arrival.value > 0 && !reduced.value, frozenAt: reduced.value ? 0 : undefined }
          }),
          h('button', { type: 'button', class: 'btn small', onClick: () => arrival.value++ }, 'Say hello again')
        ),
        h(
          'div',
          { class: 'inter-text' },
          h('p', { ref: rv[1], class: 'eyebrow' }, 'Interactions'),
          h('h2', { id: 't-inter', ref: rv[2], class: 'title-sec' }, 'It reacts', h('br'), 'to you.'),
          h(
            'p',
            { ref: rv[3], class: 'lede' },
            'The star is live. Each gesture has its own reaction, then it goes back to its mood. On by default; turn them off with ',
            h('code', null, 'interactions="false"'),
            '.'
          ),
          h(
            'ul',
            { class: 'inter-list' },
            INTERACTIONS_SITE.map((i, k) =>
              h(
                'li',
                { key: i.gesture, ref: rvList[k] },
                h('span', { class: 'inter-gesture' }, i.gesture),
                h('span', { class: 'inter-name' }, i.name),
                h('span', { class: 'inter-detail' }, i.text)
              )
            )
          ),
          reduced.value ? h('p', { key: 'note', class: 'note' }, 'Reduced motion is on: the reactions are off here.') : null
        )
      )
    )
}
