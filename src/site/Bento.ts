import { c, h, type Component } from '@/ui/dom/h'
import { Poster } from './Poster'
import { AccessoryScroller } from './AccessoryScroller'
import { ACCESSORIES, SLOTS } from 'mochiz/catalog'
import { SLOT_LABEL } from './catalog'
import { reveal } from './motion'

/**
 * The rest, as cards: light and dark, accessories, loading on demand, pure engine, exports. Still images only.
 */
const N_ACC = ACCESSORIES.length
const SLOT_COUNT = SLOTS.length
const SLOT_LABELS = SLOTS.map((e) => SLOT_LABEL[e].toLowerCase()).join(', ')

export const Bento: Component<Record<string, never>> = () => () =>
  h(
    'section',
    { id: 'more', class: 'sec', 'aria-labelledby': 't-most' },
    h(
      'div',
      { class: 'wrap sec-head' },
      h('p', { ref: reveal(), class: 'eyebrow' }, 'And more'),
      h('h2', { id: 't-most', ref: reveal(1), class: 'title-sec' }, 'Small engine.', h('br'), 'Lots of care.')
    ),
    h(
      'div',
      { class: 'wrap bento' },
      h(
        'article',
        { ref: reveal(0), class: 'card-b b-theme' },
        h(
          'div',
          { class: 'b-duo' },
          h('div', { class: 'b-light' }, c(Poster, { name: 'bento-light', size: 146, alt: 'A yellow star Mochi in light mode, white eyes' })),
          h('div', { class: 'b-dark' }, c(Poster, { name: 'bento-dark', size: 146, alt: 'The same Mochi in dark mode, black eyes' }))
        ),
        h('h3', null, 'Light and dark'),
        h('p', null, 'In dark mode the eyes turn black. Set it on one Mochi with ', h('code', null, 'theme'), ', or on all of them with ', h('code', null, 'currentTheme'), '.')
      ),
      h(
        'article',
        { ref: reveal(1), class: 'card-b b-acc' },
        h('div', { class: 'b-image' }, c(AccessoryScroller, {})),
        h('h3', null, `${N_ACC} accessories`),
        h('p', null, `${SLOT_COUNT} slots (${SLOT_LABELS}), one piece per slot, in your colors.`)
      ),
      h(
        'article',
        { ref: reveal(2), class: 'card-b b-pur' },
        h('pre', { class: 'b-code' }, h('span', { class: 'c-word' }, 'const'), ' frame = engine.', h('span', { class: 'c-attr' }, 'sample'), '(t)'),
        h('h3', null, 'A pure function of time'),
        h('p', null, 'The engine has no clock: the same ', h('code', null, 't'), ' always gives the same frame. Freeze one with ', h('code', null, 'frozen-at'), '.')
      ),
      h(
        'article',
        { ref: reveal(3), class: 'card-b b-soft' },
        h('div', { class: 'b-large' }, '0'),
        h('h3', null, 'Animation libraries'),
        h('p', null, 'Everything is drawn in code. Three.js only loads when a 3D Mochi is on screen.')
      ),
      h(
        'article',
        { ref: reveal(4), class: 'card-b b-export' },
        h('div', { class: 'b-formats' }, h('span', null, 'SVG'), h('span', null, 'PNG'), h('span', null, 'GIF'), h('span', null, 'MP4')),
        h('h3', null, 'Exports'),
        h('p', null, 'Save a frame or a whole loop from the ', h('a', { href: '/app' }, 'app'), '.')
      )
    )
  )
