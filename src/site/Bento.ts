import { c, h, type Composant } from '@/ui/dom/h'
import { Affiche } from './Affiche'
import { AccDefile } from './AccDefile'
import { CATALOGUE, EMPLACEMENTS } from 'mochi-world/catalogue'
import { EMPLACEMENT_LABEL } from './catalog'
import { reveal } from './motion'

/** Le reste, en cartes : clair et sombre, accessoires, chargement a la demande, moteur pur, exports. Images figees seulement. */
const N_ACC = CATALOGUE.length
const N_EMPL = EMPLACEMENTS.length
const NOMS_EMPL = EMPLACEMENTS.map((e) => EMPLACEMENT_LABEL[e].toLowerCase()).join(', ')

export const Bento: Composant<Record<string, never>> = () => () =>
  h(
    'section',
    { id: 'more', class: 'sec', 'aria-labelledby': 't-plus' },
    h(
      'div',
      { class: 'wrap sec-tete' },
      h('p', { ref: reveal(), class: 'surtitre' }, 'And more'),
      h('h2', { id: 't-plus', ref: reveal(1), class: 'titre-sec' }, 'Small engine.', h('br'), 'Lots of care.')
    ),
    h(
      'div',
      { class: 'wrap bento' },
      h(
        'article',
        { ref: reveal(0), class: 'carte-b b-theme' },
        h(
          'div',
          { class: 'b-duo' },
          h('div', { class: 'b-clair' }, c(Affiche, { nom: 'bento-clair', taille: 146, alt: 'A yellow star Mochi in light mode, white eyes' })),
          h('div', { class: 'b-sombre' }, c(Affiche, { nom: 'bento-sombre', taille: 146, alt: 'The same Mochi in dark mode, black eyes' }))
        ),
        h('h3', null, 'Light and dark'),
        h('p', null, 'In dark mode the eyes turn black. Without ', h('code', null, 'theme'), ', Mochi follows the page.')
      ),
      h(
        'article',
        { ref: reveal(1), class: 'carte-b b-acc' },
        h('div', { class: 'b-image' }, c(AccDefile, {})),
        h('h3', null, `${N_ACC} accessories`),
        h('p', null, `${N_EMPL} slots (${NOMS_EMPL}), one piece per slot, in your colours.`)
      ),
      h(
        'article',
        { ref: reveal(2), class: 'carte-b b-pur' },
        h('pre', { class: 'b-code' }, h('span', { class: 'c-mot' }, 'const'), ' frame = engine.', h('span', { class: 'c-attr' }, 'sample'), '(t)'),
        h('h3', null, 'A pure function of time'),
        h('p', null, 'The engine has no clock: the same ', h('code', null, 't'), ' always gives the same frame. Freeze one with ', h('code', null, 'frozen-at'), '.')
      ),
      h(
        'article',
        { ref: reveal(3), class: 'carte-b b-leger' },
        h('div', { class: 'b-gros' }, '0'),
        h('h3', null, 'Animation libraries'),
        h('p', null, 'Everything is drawn in code. Three.js only loads when a 3D Mochi is on screen.')
      ),
      h(
        'article',
        { ref: reveal(4), class: 'carte-b b-export' },
        h('div', { class: 'b-formats' }, h('span', null, 'SVG'), h('span', null, 'PNG'), h('span', null, 'GIF'), h('span', null, 'MP4')),
        h('h3', null, 'Exports'),
        h('p', null, 'Save a frame or a whole loop from the ', h('a', { href: '/app' }, 'app'), '.')
      )
    )
  )
