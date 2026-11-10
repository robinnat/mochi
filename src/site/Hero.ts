import { computed, ref } from '@/ui/dom/reactive'
import { c, h, type Component } from '@/ui/dom/h'
import { Poster } from './Poster'
import { HeroFigures } from './HeroFigures'
import { SCROLL } from './posters'
import { SITE_ACCESSORIES } from './catalog'
import type { AccessoryChoice, Slot } from 'mochis/catalogue'

/**
 * Hero: "the crowd" (chosen on 09/11/2026). No 3D on the first screen: a small crowd of all different Mochis, as
 * pre-rendered images floating in CSS. Tapping one makes it jump and tells what it wears; "Shuffle" calls others from
 * the same curated list as the accessories card. Very light on iPhone.
 */
const OF_FACE = SCROLL.filter((d) => !d.variant.back)
const N = 12
const labelOf = (i: number) =>
  (Object.entries(OF_FACE[i]!.variant.acc) as [Slot, AccessoryChoice][])
    .map(([e, ch]) => SITE_ACCESSORIES(e).find((a) => a.id === (typeof ch === 'string' ? ch : ch.id))?.label)
    .filter(Boolean)
    .join(', ')

export const Hero: Component<Record<string, never>> = () => {
  const order = ref<number[]>(Array.from({ length: N }, (_, i) => i))
  const crowd = computed(() => order.value.map((i) => ({ i, name: OF_FACE[i]!.name })))
  const active = ref<number | null>(null)
  const jump = ref(0)

  function toucher(i: number) {
    active.value = i
    jump.value++
  }
  function mix() {
    const everything = OF_FACE.map((_, i) => i)
    for (let k = everything.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1))
      ;[everything[k], everything[j]] = [everything[j]!, everything[k]!]
    }
    order.value = everything.slice(0, N)
    active.value = null
  }
  const caption = computed(() => (active.value === null ? 'Tap a Mochi to see what it wears.' : `Wearing: ${labelOf(active.value)}.`))

  return () =>
    h(
      'header',
      { id: 'top', class: 'hx hx-b' },
      h('div', { class: 'hero-background', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'hx-in hx-center' },
        h('p', { class: 'hero-badge rv-load', style: '--d: 0' }, h('span', { class: 'point', 'aria-hidden': 'true' }), ' Open source, MIT'),
        h('h1', { class: 'hx-title rv-load', style: '--d: 1' }, 'A crowd of ', h('span', { class: 'accent' }, 'tiny faces'), ' for your app.'),
        h(
          'p',
          { class: 'hx-lede rv-load', style: '--d: 2' },
          'Mochi is a 3D avatar for the web: pick a shape, a colour and a few accessories. Each one breathes, blinks and reacts to touch.'
        ),
        h(
          'div',
          { class: 'actions hx-actions rv-load', style: '--d: 3' },
          h('a', { class: 'btn primary', href: '/app' }, 'Try the app ', h('span', { 'aria-hidden': 'true' }, '→')),
          h('a', { class: 'btn', href: '/docs' }, 'Read the docs')
        ),
        h(
          'ul',
          { class: 'hx-crowd', 'aria-label': 'Some Mochi' },
          crowd.value.map((m, k) =>
            h(
              'li',
              { key: m.i + '-' + k, style: { '--k': k } },
              h(
                'button',
                {
                  type: 'button',
                  class: ['hx-mochi', { saute: active.value === m.i }],
                  'aria-label': OF_FACE[m.i]!.variant.shape + ' Mochi wearing ' + labelOf(m.i),
                  onClick: () => toucher(m.i)
                },
                // the key changes on each tap: the jump starts over
                h('span', { key: active.value === m.i ? jump.value : 0, class: 'hx-mochi-i' }, c(Poster, { name: m.name, size: 166, eager: k < 4 }))
              )
            )
          )
        ),
        h(
          'div',
          { class: 'hx-footer' },
          h('p', { class: 'hx-caption', 'aria-live': 'polite' }, caption.value),
          h('button', { type: 'button', class: 'btn small', onClick: mix }, 'Shuffle')
        )
      ),
      c(HeroFigures, {})
    )
}
