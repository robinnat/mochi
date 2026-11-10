import { ref } from '@/ui/dom/reactif'
import { c, h, surDemontage, surMontage, type Composant, type Enfant } from '@/ui/dom/h'
import { Nav } from '@/site/Nav'
import { Pied } from '@/site/Pied'
import { CodeBlock } from '@/site/CodeBlock'
import { Vivant } from '@/site/Vivant'
import { DOCS_BOT } from '@/site/affiches'
import { initTheme } from '@/site/theme'
import { COLOR_LABEL, EMPLACEMENT_LABEL, EMPLACEMENTS_IDS, ACCESSOIRES_SITE, HUMEURS_SITE, SHAPE_LABEL } from '@/site/catalog'
import { COLORS, SHAPES } from '@/bot/skins'
import { closedPath, toPoints } from '@/bot/shape'
import { REACTION_IDS } from '@/bot/humeurs'
import {
  CHARGER,
  DEPOT,
  EVENEMENTS,
  EXEMPLE_RAPIDE,
  EX_ACCESSOIRES,
  EX_FIGE,
  EX_FORME_COULEUR,
  EX_METHODES,
  EX_MOODS,
  EX_MOTEUR,
  EX_MOTEUR_BUILD,
  EX_REACT,
  EX_STYLES,
  EX_SVELTE,
  EX_THEME,
  INSTALL_DEPOT,
  INSTALL_NPM,
  METHODES,
  PROPS,
  SOMMAIRE
} from './exemples'
import { ALIAS_HUMEURS, REACTIONS_DOC } from './catalogues'

const silhouette = (radii: number[]) => closedPath(toPoints({ radii, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, 10))
const FORMES = SHAPES.map((s) => ({ id: s.id, label: SHAPE_LABEL[s.id] ?? s.id, d: silhouette(s.radii) }))
const ACCS = EMPLACEMENTS_IDS.map((e) => ({ e, label: EMPLACEMENT_LABEL[e], items: ACCESSOIRES_SITE(e) }))

const code = (t: string) => h('code', null, t)
const bloc = (codeSource: string, titre: string) => c(CodeBlock, { code: codeSource, titre })
const section = (id: string, ...enfants: Enfant[]) => h('section', { id, class: 'doc' }, enfants)
const tableau = (entetes: string[], lignes: Enfant[], classe?: string) =>
  h('div', { class: 'tableau' }, h('table', { class: classe }, h('thead', null, h('tr', null, entetes.map((e) => h('th', null, e)))), h('tbody', null, lignes)))

export const Docs: Composant<Record<string, never>> = () => {
  initTheme()
  /** Section courante du sommaire : celle qui traverse le haut de l'ecran. */
  const courant = ref(SOMMAIRE[0]!.id)
  let obs: IntersectionObserver | null = null
  surMontage(() => {
    if (typeof IntersectionObserver === 'undefined') return
    obs = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) courant.value = e.target.id
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    for (const s of SOMMAIRE) {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    }
  })
  surDemontage(() => obs?.disconnect())

  return () =>
    h(
      'div',
      { style: 'display: contents' },
      c(Nav, { accueil: '/', page: 'docs' }),
      h(
        'main',
        { class: 'docs' },
        h(
          'header',
          { class: 'docs-tete wrap' },
          h('p', { class: 'surtitre' }, 'Documentation'),
          h('h1', { class: 'docs-titre' }, 'Put a Mochi', h('br'), 'in your app.'),
          h(
            'p',
            { class: 'chapo' },
            'Mochi World is one web component, ',
            code('<mochi-bot>'),
            ', on top of a small engine with no framework and no clock. It works in plain HTML and in any framework. This page covers everything you need: installation, the main options, and copyable examples.'
          )
        ),
        h(
          'div',
          { class: 'wrap docs-grille' },
          h(
            'aside',
            { class: 'docs-sommaire', 'aria-label': 'On this page' },
            h('p', { class: 'docs-sommaire-titre' }, 'On this page'),
            h(
              'ul',
              null,
              SOMMAIRE.map((s) => h('li', { key: s.id }, h('a', { href: '#' + s.id, 'aria-current': courant.value === s.id ? 'true' : undefined }, s.titre)))
            )
          ),
          h(
            'article',
            { class: 'docs-corps' },
            section(
              'install',
              h('h2', null, 'Installation'),
              h(
                'div',
                { class: 'encart' },
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
              bloc(INSTALL_DEPOT, 'Terminal'),
              h('p', null, 'Then load it once per page. Importing the file declares the ', code('<mochi-bot>'), ' tag:'),
              bloc(CHARGER, 'HTML or JavaScript'),
              h('p', { class: 'note' }, 'The built files keep the MIT license notice of ', h('a', { href: DEPOT + '/blob/main/LICENSE' }, 'LICENSE'), ': ship it with your app.')
            ),
            section(
              'first',
              h('h2', null, 'Your first Mochi'),
              h(
                'div',
                { class: 'doc-duo' },
                bloc(EXEMPLE_RAPIDE, 'index.html'),
                h(
                  'div',
                  { class: 'doc-apercu' },
                  c(Vivant, { taille: 180, affiche: 'docs', bot: DOCS_BOT, alt: 'A purple star Mochi, the result of the example' }),
                  h('span', null, 'Result: live, it reacts to touch.')
                )
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
                code('accessoires'),
                ', ',
                code('cycle'),
                ') can also be set as properties.'
              ),
              bloc(EX_REACT, 'Avatar.jsx'),
              bloc(EX_SVELTE, 'Avatar.svelte')
            ),
            section(
              'shapes',
              h('h2', null, 'Shapes and colours'),
              h('p', null, code('shape'), ` takes one of the ${FORMES.length} shape ids. `, code('color'), ' takes a colour id or any hex colour.'),
              bloc(EX_FORME_COULEUR, 'HTML'),
              h('h3', null, 'Shapes'),
              h(
                'ul',
                { class: 'ids-formes' },
                FORMES.map((f) =>
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
                { class: 'ids-couleurs' },
                COLORS.map((col) =>
                  h('li', { key: col.id }, h('span', { class: 'pastille-doc', style: { background: col.hex }, 'aria-hidden': 'true' }), code(col.id), h('span', null, COLOR_LABEL[col.id]))
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
              bloc(EX_STYLES, 'HTML'),
              h(
                'p',
                { class: 'note' },
                'Three.js is a dynamic import: it is downloaded the first time a 3D Mochi is shown, never before. Without WebGL, Mochi falls back to an SVG drawing.'
              )
            ),
            section(
              'moods',
              h('h2', null, 'Moods'),
              h('p', null, 'A mood changes the face and the way the body moves. It loops until you change it, and the change glides.'),
              bloc(EX_MOODS, 'HTML'),
              tableau(
                ['Id', 'Also accepted', 'What it does'],
                HUMEURS_SITE.map((hm) =>
                  h(
                    'tr',
                    { key: hm.id },
                    h('td', null, code(hm.id)),
                    h('td', null, ALIAS_HUMEURS[hm.id].map((a) => h('code', { key: a, class: 'alias' }, a))),
                    h('td', null, hm.texte)
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
              bloc(EX_ACCESSOIRES, 'HTML'),
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
                          h('span', { class: 'duo-pastilles', 'aria-hidden': 'true' }, h('span', { style: { background: a.c1 } }), a.c2 !== a.c1 ? h('span', { style: { background: a.c2 } }) : null),
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
                code('themeCourant'),
                ' (light by default).'
              ),
              bloc(EX_THEME, 'HTML')
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
              bloc(EX_METHODES, 'HTML'),
              tableau(
                ['Method', 'What it does'],
                METHODES.map((m) => h('tr', { key: m.nom }, h('td', null, code(m.signature)), h('td', null, m.texte)))
              ),
              h('p', null, 'Reaction ids for ', code('react()'), ':'),
              h(
                'ul',
                { class: 'ids-ligne' },
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
                code('pret'),
                ' event fires when the first 3D frame is painted: until then you can show a still image, as this site does. Removed from the page, a Mochi stops its loop and its listeners.'
              ),
              bloc(EX_FIGE, 'HTML')
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
                h('a', { href: DEPOT + '/blob/main/src/components/mochi-bot.ts' }, 'mochi-bot.ts'),
                '.'
              ),
              tableau(
                ['Attribute', 'Type', 'Default', 'Description'],
                PROPS.map((p) =>
                  h(
                    'tr',
                    { key: p.nom },
                    h('td', null, code(p.attr)),
                    h('td', null, h('code', { class: 'type' }, p.type)),
                    h('td', null, h('code', { class: 'type' }, p.defaut)),
                    h('td', null, p.texte)
                  )
                ),
                'props'
              )
            ),
            section(
              'events',
              h('h2', null, 'Events'),
              h('p', null, 'Standard ', code('CustomEvent'), 's, listened to with ', code('addEventListener'), '. They do not bubble.'),
              tableau(
                ['Event', 'When'],
                EVENEMENTS.map((e) => h('tr', { key: e.nom }, h('td', null, code(e.nom)), h('td', null, e.texte)))
              )
            ),
            section(
              'engine',
              h('h2', null, 'Engine only'),
              h(
                'p',
                null,
                code('src/bot/'),
                ' has no framework and no clock. The library file also exports it: draw the frames yourself (SVG, canvas). This gives the 2D drawing, not the 3D styles.'
              ),
              bloc(EX_MOTEUR_BUILD, 'Terminal'),
              bloc(EX_MOTEUR, 'main.js'),
              h('p', { class: 'note' }, 'The README has a complete SVG drawing loop: ', h('a', { href: DEPOT + '#engine-only' }, 'Engine only'), '.')
            )
          )
        )
      ),
      c(Pied, {})
    )
}
