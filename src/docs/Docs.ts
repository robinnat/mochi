import { ref } from '@/ui/dom/reactive'
import { c, h, onUnmount, onMount, type Component, type Child } from '@/ui/dom/h'
import { Nav } from '@/site/Nav'
import { Footer } from '@/site/Footer'
import { CodeBlock } from '@/site/CodeBlock'
import { Preview } from './preview'
import { initTheme } from '@/site/theme'
import { COLOR_LABEL, SLOT_LABEL, SLOT_IDS, SITE_ACCESSORIES, SITE_MOODS, SHAPE_LABEL } from '@/site/catalog'
import { shapePath, COLORS, REACTION_IDS, SHAPES } from 'mochi-world/catalogue'
import {
  LOAD,
  REPO,
  EVENTS,
  QUICK_EXAMPLE,
  EX_ACCESSORIES,
  EX_FROZEN,
  EX_SHAPE_COLOR,
  EX_METHODS,
  EX_MOODS,
  EX_ENGINE,
  EX_ENGINE_BUILD,
  EX_REACT,
  EX_STYLES,
  EX_SVELTE,
  EX_THEME,
  INSTALL_REPO,
  INSTALL_NPM,
  METHODS,
  PROPS,
  TOC
} from './examples'
import { MOOD_ALIASES, REACTIONS_DOC } from './catalogs'

const silhouette = (radii: number[]) => shapePath(radii)
const SHAPE_LIST = SHAPES.map((s) => ({ id: s.id, label: SHAPE_LABEL[s.id] ?? s.id, d: silhouette(s.radii) }))
const ACCS = SLOT_IDS.map((e) => ({ e, label: SLOT_LABEL[e], items: SITE_ACCESSORIES(e) }))

const code = (t: string) => h('code', null, t)
const block = (codeSource: string, title: string) => c(CodeBlock, { code: codeSource, title })
const section = (id: string, ...children: Child[]) => h('section', { id, class: 'doc' }, children)
const table = (headers: string[], rows: Child[], cls?: string) =>
  h('div', { class: 'table' }, h('table', { class: cls }, h('thead', null, h('tr', null, headers.map((e) => h('th', null, e)))), h('tbody', null, rows)))

export const Docs: Component<Record<string, never>> = () => {
  initTheme()
  /** Section courante du sommaire : celle qui traverse le haut de l'ecran. */
  const current = ref(TOC[0]!.id)
  let obs: IntersectionObserver | null = null
  onMount(() => {
    if (typeof IntersectionObserver === 'undefined') return
    obs = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) current.value = e.target.id
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    for (const s of TOC) {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    }
  })
  onUnmount(() => obs?.disconnect())

  return () =>
    h(
      'div',
      { style: 'display: contents' },
      c(Nav, { home: '/', page: 'docs' }),
      h(
        'main',
        { class: 'docs' },
        h(
          'header',
          { class: 'docs-head wrap' },
          h('p', { class: 'eyebrow' }, 'Documentation'),
          h('h1', { class: 'docs-title' }, 'Put a Mochi', h('br'), 'in your app.'),
          h(
            'p',
            { class: 'lede' },
            'Mochi World is one web component, ',
            code('<mochi-bot>'),
            ', on top of a small engine with no framework and no clock. It works in plain HTML and in any framework. This page covers everything you need: installation, the main options, and copyable examples.'
          )
        ),
        h(
          'div',
          { class: 'wrap docs-grid' },
          h(
            'aside',
            { class: 'docs-toc', 'aria-label': 'On this page' },
            h('p', { class: 'docs-toc-title' }, 'On this page'),
            h(
              'ul',
              null,
              TOC.map((s) => h('li', { key: s.id }, h('a', { href: '#' + s.id, 'aria-current': current.value === s.id ? 'true' : undefined }, s.title)))
            )
          ),
          h(
            'article',
            { class: 'docs-body' },
            section(
              'install',
              h('h2', null, 'Installation'),
              h(
                'div',
                { class: 'callout' },
                h('strong', null, 'The npm package is coming soon.'),
                h('span', null, code('mochi-world'), ' is not published yet, so ', code(INSTALL_NPM), ' does not work today. Until then, build it from the repository.')
              ),
              h(
                'p',
                null,
                'Mochi has no dependency for your app: ',
                h('strong', null, 'Three.js'),
                ' is bundled in a separate file that only loads when a 3D Mochi is shown. Build the library once:'
              ),
              block(INSTALL_REPO, 'Terminal'),
              h('p', null, 'Then load it once per page. Importing the file declares the ', code('<mochi-bot>'), ' tag:'),
              block(LOAD, 'HTML or JavaScript'),
              h('p', { class: 'note' }, 'The built files keep the MIT license notice of ', h('a', { href: REPO + '/blob/main/LICENSE' }, 'LICENSE'), ': ship it with your app.')
            ),
            section(
              'first',
              h('h2', null, 'Your first Mochi'),
              h(
                'div',
                { class: 'doc-duo' },
                block(QUICK_EXAMPLE, 'index.html'),
                c(Preview, { example: QUICK_EXAMPLE, caption: 'Result: this very code, live. It reacts to touch.' })
              ),
              h(
                'p',
                null,
                'That is a breathing, blinking 3D star that says hello when it appears and reacts when you touch it. Every option below is an attribute (text) and a property (any value) of the same element.'
              )
            ),
            section(
              'frameworks',
              h('h2', null, 'In a framework'),
              h(
                'p',
                null,
                code('<mochi-bot>'),
                ' is a standard custom element: write it like any HTML tag. Text options go in attributes; objects (',
                code('accessories'),
                ', ',
                code('cycle'),
                ') can also be set as properties.'
              ),
              block(EX_REACT, 'Avatar.jsx'),
              block(EX_SVELTE, 'Avatar.svelte')
            ),
            section(
              'shapes',
              h('h2', null, 'Shapes and colours'),
              h('p', null, code('shape'), ` takes one of the ${SHAPE_LIST.length} shape ids. `, code('color'), ' takes a colour id or any hex colour.'),
              block(EX_SHAPE_COLOR, 'HTML'),
              c(Preview, { example: EX_SHAPE_COLOR }),
              h('h3', null, 'Shapes'),
              h(
                'ul',
                { class: 'ids-shapes' },
                SHAPE_LIST.map((f) =>
                  h(
                    'li',
                    { key: f.id },
                    h('svg', { viewBox: '-13 -13 26 26', width: '28', height: '28', 'aria-hidden': 'true' }, h('path', { d: f.d, fill: 'currentColor' })),
                    code(f.id),
                    h('span', null, f.label)
                  )
                )
              ),
              h('h3', null, 'Colours'),
              h(
                'ul',
                { class: 'ids-colors' },
                COLORS.map((col) =>
                  h('li', { key: col.id }, h('span', { class: 'dot-doc', style: { background: col.hex }, 'aria-hidden': 'true' }), code(col.id), h('span', null, COLOR_LABEL[col.id]))
                )
              )
            ),
            section(
              'styles',
              h('h2', null, 'Styles'),
              h(
                'p',
                null,
                'All three styles are real 3D: ',
                code('3d'),
                ' (Soft, the default), ',
                code('pixel3d'),
                ' (Pixel) and ',
                code('flat3d'),
                ' (Flat). The model is the same, only the drawing changes.'
              ),
              block(EX_STYLES, 'HTML'),
              c(Preview, { example: EX_STYLES }),
              h(
                'p',
                { class: 'note' },
                'Three.js is a dynamic import: it is downloaded the first time a Mochi is shown, never before. Mochi is always drawn in 3D: without WebGL, a short message takes its place (and the element fires a sans3d event).'
              )
            ),
            section(
              'moods',
              h('h2', null, 'Moods'),
              h('p', null, 'A mood changes the face and the way the body moves. It loops until you change it, and the change glides.'),
              block(EX_MOODS, 'HTML'),
              c(Preview, { example: EX_MOODS }),
              table(
                ['Id', 'Also accepted', 'What it does'],
                SITE_MOODS.map((hm) =>
                  h(
                    'tr',
                    { key: hm.id },
                    h('td', null, code(hm.id)),
                    h('td', null, MOOD_ALIASES[hm.id].map((a) => h('code', { key: a, class: 'alias' }, a))),
                    h('td', null, hm.text)
                  )
                )
              )
            ),
            section(
              'accessories',
              h('h2', null, 'Accessories'),
              h(
                'p',
                null,
                'Five slots, one accessory per slot, all stackable. Pass the id alone for the catalogue colours, or an object with your own ',
                code('c1'),
                ' (main colour) and ',
                code('c2'),
                ' (second colour, for two-colour pieces). As an attribute, write it in JSON.'
              ),
              block(EX_ACCESSORIES, 'HTML'),
              c(Preview, { example: EX_ACCESSORIES }),
              h(
                'div',
                { class: 'slots' },
                ACCS.map((s) =>
                  h(
                    'div',
                    { key: s.e, class: 'slot-doc' },
                    h('h3', null, code(s.e), ' ', h('span', null, s.label)),
                    h(
                      'ul',
                      null,
                      s.items.map((a) =>
                        h(
                          'li',
                          { key: a.id },
                          h('span', { class: 'duo-dots', 'aria-hidden': 'true' }, h('span', { style: { background: a.c1 } }), a.c2 !== a.c1 ? h('span', { style: { background: a.c2 } }) : null),
                          code(a.id),
                          h('span', null, a.label)
                        )
                      )
                    )
                  )
                )
              )
            ),
            section(
              'theme',
              h('h2', null, 'Light and dark'),
              h(
                'p',
                null,
                'In dark mode the eyes turn black, and the body is lightened only if it would not contrast enough with them. Set it on one Mochi with ',
                code('theme'),
                ', or for all of them with ',
                code('currentTheme'),
                ' (light by default).'
              ),
              block(EX_THEME, 'HTML'),
              c(Preview, { example: EX_THEME })
            ),
            section(
              'reactions',
              h('h2', null, 'Reactions and methods'),
              h(
                'p',
                null,
                'With ',
                code('interactions'),
                ' on (the default), Mochi reacts by itself: hover, tap, double tap, long press, shake. You can also drive it from your code: the methods are on the element.'
              ),
              block(EX_METHODS, 'HTML'),
              table(
                ['Method', 'What it does'],
                METHODS.map((m) => h('tr', { key: m.name }, h('td', null, code(m.signature)), h('td', null, m.text)))
              ),
              h('p', null, 'Reaction ids for ', code('react()'), ':'),
              h(
                'ul',
                { class: 'ids-row' },
                REACTION_IDS.map((r) => h('li', { key: r }, code(r), ' ', h('span', null, REACTIONS_DOC[r])))
              )
            ),
            section(
              'performance',
              h('h2', null, 'Still frames and performance'),
              h(
                'p',
                null,
                'The engine is a pure function of time, so ',
                code('frozen-at'),
                ' renders one exact instant with no animation loop: ideal for lists and thumbnails. All 3D Mochis share one WebGL context. The ',
                code('ready'),
                ' event fires when the first 3D frame is painted: until then you can show a still image, as this site does. Removed from the page, a Mochi stops its loop and its listeners.'
              ),
              block(EX_FROZEN, 'HTML'),
              c(Preview, { example: EX_FROZEN })
            ),
            section(
              'props',
              h('h2', null, 'All options'),
              h(
                'p',
                null,
                'The main options of ',
                code('<mochi-bot>'),
                ': the attribute name is in the table, the property is the same name in camelCase (',
                code('frozen-at'),
                ' is ',
                code('frozenAt'),
                '). A few older ones remain in ',
                h('a', { href: REPO + '/blob/main/src/components/mochi-bot.ts' }, 'mochi-bot.ts'),
                '.'
              ),
              table(
                ['Attribute', 'Type', 'Default', 'Description'],
                PROPS.map((p) =>
                  h(
                    'tr',
                    { key: p.name },
                    h('td', null, code(p.attr)),
                    h('td', null, h('code', { class: 'type' }, p.type)),
                    h('td', null, h('code', { class: 'type' }, p.initial)),
                    h('td', null, p.text)
                  )
                ),
                'props'
              )
            ),
            section(
              'events',
              h('h2', null, 'Events'),
              h('p', null, 'Standard ', code('CustomEvent'), 's, listened to with ', code('addEventListener'), '. They do not bubble.'),
              table(
                ['Event', 'When'],
                EVENTS.map((e) => h('tr', { key: e.name }, h('td', null, code(e.name)), h('td', null, e.text)))
              )
            ),
            section(
              'engine',
              h('h2', null, 'Engine and catalogues'),
              h(
                'p',
                null,
                code('src/bot/'),
                ' has no framework and no clock. The library file exports the engine and the catalogues; ',
                code('mochi-world/catalogue'),
                ' (',
                code('dist-lib/catalogue.js'),
                ') gives the catalogues alone, without the tag, to build a picker. This site and these docs use only these two entry points. Mochi itself is always drawn in 3D.'
              ),
              block(EX_ENGINE_BUILD, 'Terminal'),
              block(EX_ENGINE, 'main.js')
            )
          )
        )
      ),
      c(Footer, {})
    )
}
