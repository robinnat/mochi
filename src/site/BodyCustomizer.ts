import { computed, ref, shallowRef, watch } from '@/ui/dom/reactive'
import { c, h, type Component } from '@/ui/dom/h'
import { Alive } from './Alive'
import { CodeBlock } from './CodeBlock'
import { useReduced } from './reduced'
import { reveal, useWidth } from './motion'
import { SITE_ACCESSORIES, COLOR_LABEL, SLOT_LABEL, SLOT_IDS, SHAPES_3D, SITE_MOODS, PALETTE_SITE } from './catalog'
import { shapePath, colorOf, isValidHex, SHAPE_BY_ID, ACCESSORY_PALETTE as ACCESSORY_PALETTE, type Slot, type MoodId, type RenderStyleId, type AccessorySelection } from 'mochi-world/catalogue'
import { STYLES_SITE } from './style'
import { extraitCode } from './excerpt'
import { urlPiece } from './posters'
import { effectiveTheme } from './theme'

const COLOR_NAMES: Record<string, string> = {
  red: 'Red', yellow: 'Yellow', turquoise: 'Teal', navy: 'Navy', pink: 'Pink', cream: 'Cream', black: 'Black',
  gold: 'Gold', green: 'Green', orange: 'Orange', violet: 'Purple', blue: 'Blue', straw: 'Straw'
}
/** Couleurs des accessoires : la palette du catalogue des accessoires (les pieces naissent dans ces teintes). */
const PALETTE_ACC = Object.entries(ACCESSORY_PALETTE).map(([id, hex]) => ({ id, hex, label: COLOR_NAMES[id] ?? id }))

/** Icones des formes : la vraie silhouette du moteur, en SVG. */
const silhouette = (id: string) => {
  const radii = SHAPE_BY_ID.get(id)?.radii
  return radii ? shapePath(radii) : ''
}
const SHAPE_LIST = SHAPES_3D.map((f) => ({ ...f, d: silhouette(f.id) }))

type ChoicePiece = { id: string; c1: string; c2: string }
const NONE: ChoicePiece = { id: '', c1: '', c2: '' }
const options = (e: Slot) => SITE_ACCESSORIES(e)
const THEMES = ['auto', 'light', 'dark'] as const

export const BodyCustomizer: Component<Record<string, never>> = () => {
  const reduced = useReduced()
  const width = useWidth()
  const size = computed(() => (width.value >= 900 ? 320 : 210))

  /* ------------------------------------------------------------------ choix */
  const shape = ref('star')
  /** une couleur libre en hex (`#ff8800`) ou un id du catalogue du moteur */
  const color = ref('#21b0ff')
  const textHex = ref('#21b0ff')
  const hexCurrent = computed(() => colorOf(color.value))
  function setColor(x: string) {
    color.value = x
    textHex.value = colorOf(x)
  }
  function enterHex(v: string) {
    textHex.value = v
    const hx = isValidHex(v)
    if (hx) color.value = hx
  }
  const nameColor = computed(() => PALETTE_SITE.find((p) => p.hex === color.value)?.name ?? COLOR_LABEL[color.value] ?? hexCurrent.value.toUpperCase())
  const renderStyle = ref<RenderStyleId>('3d')
  const mood = ref<MoodId>('idle')
  const laptop = ref(true)
  const theme = ref<'auto' | 'light' | 'dark'>('auto')
  /** Rejouer le salut a l'arrivee. */
  const arrival = ref(0)

  /** Les pieces portees, une par emplacement ; remplacees en bloc a chaque changement (jamais mutees). */
  const choice = ref<Record<Slot, ChoicePiece>>({
    head: { id: 'cap', c1: ACCESSORY_PALETTE.red, c2: ACCESSORY_PALETTE.red },
    eyes: NONE,
    face: NONE,
    neck: NONE,
    back: NONE
  })
  const assign = (e: Slot, p: ChoicePiece) => (choice.value = { ...choice.value, [e]: p })
  const slot = ref<Slot>('head')
  function choose(e: Slot, id: string) {
    const a = options(e).find((o) => o.id === id)
    assign(e, a ? { id, c1: a.c1, c2: a.c2 } : NONE)
  }
  const hasTwoColors = (e: Slot) => {
    const a = options(e).find((o) => o.id === choice.value[e].id)
    return !!a && a.c1 !== a.c2
  }
  function setC1(e: Slot, hex: string) {
    const p = choice.value[e]
    assign(e, { ...p, c1: hex, c2: hasTwoColors(e) ? p.c2 : hex })
  }
  const accessories = computed<AccessorySelection>(() => {
    const s: AccessorySelection = {}
    for (const e of SLOT_IDS) if (choice.value[e].id) s[e] = { id: choice.value[e].id, c1: choice.value[e].c1, c2: choice.value[e].c2 }
    return s
  })
  const nWorn = computed(() => SLOT_IDS.filter((e) => choice.value[e].id).length)
  /** Onglets : fleches gauche et droite, Debut et Fin (contrat clavier du role `tablist`), le focus suit. */
  function keyboardTabs(ev: KeyboardEvent) {
    const i = SLOT_IDS.indexOf(slot.value)
    const n = SLOT_IDS.length
    const j = ev.key === 'ArrowRight' ? (i + 1) % n : ev.key === 'ArrowLeft' ? (i - 1 + n) % n : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : -1
    if (j < 0) return
    ev.preventDefault()
    slot.value = SLOT_IDS[j]!
    const list = (ev.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')
    list[j]?.focus()
  }
  function allRemove() {
    for (const e of SLOT_IDS) choose(e, '')
  }

  /** Rejouer le salut remonte le Mochi ; forme, style, couleur et humeur changent sans le remonter. */
  const key = computed(() => [arrival.value, reduced.value].join('|'))

  const excerpt = computed(() =>
    extraitCode({
      shape: shape.value,
      color: color.value,
      renderStyle: renderStyle.value,
      mood: mood.value,
      accessories: accessories.value,
      theme: theme.value,
      laptop: laptop.value
    })
  )

  /** Icones des accessoires : images pre-rendues (public/rendus). */
  const icon = (e: Slot, id: string) => urlPiece(e, id, effectiveTheme.value)

  /**
   * Reponse immediate (v12) : un clic change d'abord le bouton (peint a l'image suivante), et le Mochi recoit le
   * changement juste APRES cette image. Plusieurs changements rapides se regroupent en un seul rendu.
   */
  const stateBot = () => ({
    shape: shape.value,
    color: color.value,
    renderStyle: renderStyle.value,
    mood: mood.value,
    laptop: laptop.value,
    theme: theme.value,
    accessories: accessories.value
  })
  const bot = shallowRef(stateBot())
  let pending = false
  /** L'affiche (image pre-rendue) ne vaut que pour le Mochi de depart : au premier changement, plus d'affiche. */
  const pressedKey = ref(false)
  watch([shape, color, renderStyle, mood, laptop, theme, accessories], () => {
    pressedKey.value = true
    if (pending) return
    pending = true
    requestAnimationFrame(() =>
      setTimeout(() => {
        pending = false
        bot.value = stateBot()
      }, 0)
    )
  })

  const rv = [reveal(0), reveal(1), reveal(2), reveal(3), reveal(4), reveal()]
  const dot = (cl: { id: string; hex: string; label: string }, pressed: boolean, chooseC: () => void, suffix = '') =>
    h('button', {
      key: cl.id,
      type: 'button',
      class: 'dot petite',
      style: { background: cl.hex },
      'aria-label': cl.label + suffix,
      'aria-pressed': pressed,
      onClick: chooseC
    })

  return () => {
    const s = slot.value
    const ch = choice.value[s]
    const b = bot.value
    return h(
      'div',
      { class: 'custom-body' },
      h(
        'div',
        { class: 'wrap custom-grid' },
        h(
          'div',
          { class: 'custom-left' },
          h(
            'div',
            { class: ['custom-scene', { dark: theme.value === 'dark', light: theme.value === 'light' }] },
            c(Alive, {
              key: key.value,
              size: size.value,
              eager: true,
              poster: pressedKey.value || arrival.value > 0 || reduced.value ? null : 'custom',
              alt: 'Your Mochi',
              bot: {
                shape: b.shape,
                color: b.color,
                renderStyle: b.renderStyle,
                outline: false,
                mood: b.mood,
                laptop: b.laptop,
                accessories: b.accessories,
                theme: b.theme === 'auto' ? undefined : b.theme,
                wave: arrival.value > 0 && !reduced.value,
                frozenAt: reduced.value ? 0 : undefined
              }
            }),
            h(
              'div',
              { class: 'custom-tools' },
              h(
                'div',
                { class: 'segment small', role: 'group', 'aria-label': 'Theme of this Mochi' },
                THEMES.map((x) =>
                  h(
                    'button',
                    { key: x, type: 'button', 'aria-pressed': theme.value === x, onClick: () => (theme.value = x) },
                    x === 'auto' ? 'Page' : x === 'light' ? 'Light' : 'Dark'
                  )
                )
              ),
              h('button', { type: 'button', class: 'btn small', onClick: () => arrival.value++ }, 'Replay hello')
            )
          )
        ),
        h(
          'div',
          { class: 'custom-panel' },
          h(
            'div',
            { ref: rv[0], class: 'group' },
            h('h3', null, 'Style'),
            h(
              'div',
              { class: 'segment', role: 'group', 'aria-label': 'Render style' },
              STYLES_SITE.map((r) => h('button', { key: r.id, type: 'button', 'aria-pressed': renderStyle.value === r.id, onClick: () => (renderStyle.value = r.id) }, r.label))
            )
          ),
          h(
            'div',
            { ref: rv[1], class: 'group' },
            h('h3', null, 'Shape'),
            h(
              'div',
              { class: 'shapes-choice', role: 'group', 'aria-label': 'Shape' },
              SHAPE_LIST.map((f) =>
                h(
                  'button',
                  { key: f.id, type: 'button', class: 'shape-choice', 'aria-pressed': shape.value === f.id, title: f.label, onClick: () => (shape.value = f.id) },
                  h('svg', { viewBox: '-13 -13 26 26', width: '30', height: '30', 'aria-hidden': 'true' }, h('path', { d: f.d, fill: hexCurrent.value })),
                  h('span', null, f.label)
                )
              )
            )
          ),
          h(
            'div',
            { ref: rv[2], class: 'group' },
            h('h3', null, 'Colour', h('span', { class: 'value' }, nameColor.value)),
            h(
              'div',
              { class: 'dots', role: 'group', 'aria-label': 'Colour' },
              PALETTE_SITE.map((p) =>
                h('button', {
                  key: p.hex,
                  type: 'button',
                  class: 'dot',
                  style: { background: p.hex },
                  'aria-label': p.name,
                  'aria-pressed': color.value === p.hex,
                  onClick: () => setColor(p.hex)
                })
              )
            ),
            h(
              'div',
              { class: 'free' },
              h(
                'label',
                { class: 'free-choice' },
                h('input', { type: 'color', value: hexCurrent.value, 'aria-label': 'Pick any colour', onInput: (e: Event) => setColor((e.target as HTMLInputElement).value) }),
                h('span', null, 'Any colour')
              ),
              h(
                'label',
                { class: 'free-hex' },
                h('span', { class: 'sr-only' }, 'Hex code'),
                h('input', {
                  type: 'text',
                  value: textHex.value,
                  maxlength: '7',
                  spellcheck: 'false',
                  autocomplete: 'off',
                  'aria-label': 'Hex colour code',
                  'aria-invalid': isValidHex(textHex.value) ? 'false' : 'true',
                  onInput: (e: Event) => enterHex((e.target as HTMLInputElement).value),
                  onBlur: () => (textHex.value = hexCurrent.value)
                })
              )
            )
          ),
          h(
            'div',
            { ref: rv[3], class: 'group' },
            h('h3', null, 'Mood'),
            h(
              'div',
              { class: 'chips', role: 'group', 'aria-label': 'Mood' },
              SITE_MOODS.map((hm) => h('button', { key: hm.id, type: 'button', class: 'chip', 'aria-pressed': mood.value === hm.id, onClick: () => (mood.value = hm.id) }, hm.label))
            ),
            mood.value === 'working'
              ? h(
                  'label',
                  { key: 'laptop', class: 'case' },
                  h('input', { type: 'checkbox', checked: laptop.value, onChange: (e: Event) => (laptop.value = (e.target as HTMLInputElement).checked) }),
                  'Show the laptop'
                )
              : null
          ),
          h(
            'div',
            { ref: rv[4], class: 'group' },
            h(
              'h3',
              null,
              'Accessories',
              h('span', { class: 'value' }, `${nWorn.value} worn`),
              nWorn.value ? h('button', { key: 'everything', type: 'button', class: 'link-btn', onClick: allRemove }, 'Remove all') : null
            ),
            h(
              'div',
              { class: 'tabs', role: 'tablist', 'aria-label': 'Accessory slot', onKeydown: keyboardTabs },
              SLOT_IDS.map((e) =>
                h(
                  'button',
                  {
                    key: e,
                    type: 'button',
                    role: 'tab',
                    class: 'tab',
                    'aria-selected': s === e,
                    tabindex: s === e ? 0 : -1,
                    onClick: () => (slot.value = e)
                  },
                  SLOT_LABEL[e],
                  choice.value[e].id ? h('span', { key: 'pt', class: 'tab-point', 'aria-hidden': 'true' }) : null
                )
              )
            ),
            h(
              'div',
              { class: 'pieces', role: 'tabpanel', 'aria-label': SLOT_LABEL[s] + 'accessories' },
              h(
                'button',
                { key: '__none', type: 'button', class: 'piece', 'aria-pressed': !ch.id, onClick: () => choose(s, '') },
                h(
                  'span',
                  { class: 'piece-image none', 'aria-hidden': 'true' },
                  h(
                    'svg',
                    { viewBox: '0 0 24 24', width: '26', height: '26' },
                    h('circle', { cx: '12', cy: '12', r: '8', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }),
                    h('path', { d: 'M6.5 17.5 17.5 6.5', stroke: 'currentColor', 'stroke-width': '1.6' })
                  )
                ),
                h('span', { class: 'piece-name' }, 'None')
              ),
              options(s).map((o) =>
                h(
                  'button',
                  { key: s + ':' + o.id, type: 'button', class: 'piece', 'aria-pressed': ch.id === o.id, onClick: () => choose(s, o.id) },
                  h('span', { class: 'piece-image', 'aria-hidden': 'true' }, h('img', { src: icon(s, o.id), alt: '', width: '60', height: '60', loading: 'lazy', decoding: 'async' })),
                  h('span', { class: 'piece-name' }, o.label)
                )
              )
            ),
            ch.id
              ? h(
                  'div',
                  { key: 'colors', class: 'colors-piece' },
                  h(
                    'div',
                    { class: 'dots', role: 'group', 'aria-label': SLOT_LABEL[s] + 'colour' },
                    PALETTE_ACC.map((cl) => dot(cl, ch.c1 === cl.hex, () => setC1(s, cl.hex)))
                  ),
                  hasTwoColors(s)
                    ? h(
                        'div',
                        { key: 'c2', class: 'dots', role: 'group', 'aria-label': SLOT_LABEL[s] + 'second colour' },
                        h('span', { class: 'dots-title' }, 'Second colour'),
                        PALETTE_ACC.map((cl) => dot(cl, ch.c2 === cl.hex, () => assign(s, { ...choice.value[s], c2: cl.hex }), ' (second colour)'))
                      )
                    : null
                )
              : null
          ),
          reduced.value ? h('p', { key: 'note', class: 'note' }, 'Reduced motion is on: the preview shows a still frame.') : null
        )
      ),
      h(
        'div',
        { ref: rv[5], class: 'wrap custom-code' },
        c(CodeBlock, { code: excerpt.value, title: 'index.html' }),
        h(
          'p',
          { class: 'note' },
          'Ids are the engine\'s own (in French for now: ',
          h('code', null, 'star'),
          ' is the star). See the ',
          h('a', { href: '/docs' }, 'docs'),
          ' for every option.'
        )
      )
    )
  }
}
