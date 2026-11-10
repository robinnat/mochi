import { computed, ref, watch } from '@/ui/dom/reactive'
import { c, h, onUnmount, type Component } from '@/ui/dom/h'
import { Alive } from './Alive'
import { MOODS_BOT } from './posters'
import { useReduced } from './reduced'
import { reveal, useVisible } from './motion'
import { SITE_MOODS } from './catalog'

/**
 * The seven moods. They play in turn as long as the section is on screen (a bar shows the time left); a click picks a
 * mood and stops the rotation. The Mochi is not remounted: `mood` changes and the engine glides from one mood to
 * another.
 */
const DURATION = 4200

export const Moods: Component<Record<string, never>> = () => {
  const reduced = useReduced()
  const zone = ref<HTMLElement | null>(null)
  const visible = useVisible(zone)
  const active = ref(0)
  const auto = ref(true)
  const mood = computed(() => SITE_MOODS[active.value]!)

  let timer = 0
  watch(
    [visible, auto, active, reduced],
    ([v, a, , r]) => {
      clearTimeout(timer)
      if (v && a && !r) timer = window.setTimeout(() => (active.value = (active.value + 1) % SITE_MOODS.length), DURATION)
    },
    { immediate: true }
  )
  onUnmount(() => clearTimeout(timer))

  function choose(i: number) {
    auto.value = false
    active.value = i
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
          { class: 'moods-text' },
          h('p', { ref: rv[0], class: 'eyebrow' }, 'Moods'),
          h('h2', { id: 't-moods', ref: rv[1], class: 'title-sec' }, 'Seven moods.', h('br'), 'One body.'),
          h(
            'p',
            { ref: rv[2], class: 'lede' },
            'A mood changes the face and the way the body moves, and loops until you change it. Set it with ',
            h('code', null, 'mood="travaille"'),
            ' or call ',
            h('code', null, 'setMood()'),
            '.'
          ),
          h(
            'ul',
            { ref: rv[3], class: 'moods-list', role: 'list' },
            SITE_MOODS.map((hm, i) =>
              h(
                'li',
                { key: hm.id },
                h(
                  'button',
                  { type: 'button', class: ['mood', { on: i === active.value }], 'aria-pressed': i === active.value, onClick: () => choose(i) },
                  h('span', { class: 'mood-name' }, hm.label),
                  h('code', { class: 'mood-id' }, hm.id),
                  i === active.value && auto.value && visible.value && !reduced.value
                    ? h('span', { key: 'bar' + active.value, class: 'mood-bar', style: { '--duree': DURATION + 'ms' }, 'aria-hidden': 'true' })
                    : null
                )
              )
            )
          )
        ),
        h(
          'div',
          { ref: rv[4], class: 'moods-scene' },
          c(Alive, {
            key: 'm' + reduced.value,
            size: 320,
            poster: 'moods',
            alt: 'A teal Mochi in the mood: ' + mood.value.label,
            bot: { ...MOODS_BOT, mood: mood.value.id, frozenAt: reduced.value ? 0 : undefined, interactions: false }
          }),
          h('p', { class: 'moods-caption', 'aria-live': 'polite' }, h('strong', null, `${mood.value.label}.`), ` ${mood.value.text}`)
        )
      )
    )
}
