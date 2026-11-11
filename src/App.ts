import { computed, ref, watch } from '@/ui/dom/reactive'
import { c, h, type Component } from '@/ui/dom/h'
import type { MochiBotElement } from '@/components/mochi-bot'
import '@/components/mochi-bot'
import { BotTile } from '@/components/BotTile'
import { Customizer } from '@/components/Customizer'
import { ExportBar } from '@/components/ExportBar'
import { CycleDialog } from '@/components/CycleDialog'
import { GifDialog } from '@/components/GifDialog'
import { Settings } from '@/components/Settings'
import { SideRail, type ViewId } from '@/components/SideRail'
import { Timeline } from '@/components/Timeline'
import { nameOfCycle, t } from '@/i18n'
import { copy, copyText, cycleToGif, cycleToMp4, svgStandalone, download, toGifAnimate, toPng } from '@/ui/capture'
import {
  ACTION_BY_ID,
  CYCLE_SIZE,
  DEFAULT_GIF_BACKGROUND,
  DEFAULT_CYCLE_FORMAT,
  GIF_IMAGES,
  GIF_STEP,
  WHITE,
  Abandon,
  backgroundColor,
  cycleImages,
  cycleStep,
  nameFile,
  type ActionId,
  type StateExport,
  type BackgroundGif,
  type FormatCycle
} from '@/ui/export'
import { MOODS } from '@/ui/gaze'
import { INTRO, INTRO_GAZE, POSE_AT, introDue } from '@/ui/intro'
import { write, read, type NameStored } from '@/ui/storage'
import {
  isRenderStyle,
  currentPixel,
  DEFAULT_PIXEL,
  DEFAULT_RENDER_STYLE,
  currentRenderStyle,
  renderStyleSuffix,
  type RenderStyleId,
  type PixelSizeId
} from '@/ui/renderStyle'
import { blockAt, blocksWith, defaultCycle, makeBlock, parseCycles, totalDuration, type Cycle } from '@/bot/cycles'
import { DEFAULT_EXPRESSION, EXPRESSION_BY_ID } from '@/bot/expressions'
import { COLOR_BY_ID, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID } from '@/bot/skins'
import { POSES, SEQUENCE, STATES, type StateId } from '@/bot/states'

/**
 * The URL drives the display: `#state=wink&stop` opens a given state with the sequence stopped, `#sheet` shows the
 * sheet. We read it again on every `hashchange` so the browser's back and forward really work.
 */
function readHash() {
  const params = new URLSearchParams(location.hash.slice(1))
  const asked = params.get('state') as StateId | null
  // never trust the URL: the state must exist
  const known = STATES.some((s) => s.id === asked)
  return {
    state: known ? asked! : 'idle',
    named: known,
    playing: !params.has('stop'),
    gallery: params.has('sheet'),
    // `#arrival`: replay the arrival without going back to the site
    arrival: params.has('arrival')
  }
}

/**
 * Shape, color, expression and cycle survive a reload: it is the user's avatar. Validated on load, an unknown id
 * falls back to the default.
 */
function stored(name: NameStored, fallback: string, exists: (v: string) => boolean) {
  const v = read(name)
  return v && exists(v) ? v : fallback
}

/**
 * Product name, in capitals for the big word of the footer. NOT translated: it is a brand.
 */
const NAME = 'MOCHI'
/** Duration of a mood in the settings. Long enough to be noticed without being restless. */
const MOOD_MS = 4200
/** Delay before the export bar shows after the arrival: the time for the avatar to reach its place. */
const ARRIVAL_DELAY = 400
/** How long the export confirmation shows. */
const CONFIRMATION_MS = 1800

/**
 * Outside the player, the montage played is a single idle block (that is where the chosen shape shows).
 */
const REST = [makeBlock('idle')]
/** Entry into the settings: the swirl, then idle (same pose, the resume does not show). */
const ENTRY = [makeBlock('swirl'), makeBlock('idle')]
/** With "reduced motion", the entry goes straight to idle: the swirl is decoration. */
const ENTRY_CALM = [makeBlock('idle')]

export const App: Component<Record<string, never>> = () => {
  const initial = readHash()
  const gallery = ref(initial.gallery)

  /*
   * "Reduced motion" asked by the system, TRACKED and not read once. What it cuts is DECORATION (transitions, entry
   * swirl); not the breathing, the gaze or the blinks.
   */
  const calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const calm = ref(calmQuery.matches)
  calmQuery.addEventListener('change', (e) => (calm.value = e.matches))

  // "coming" to the site is known by the browser: `navigate` (and not `reload` or `back_forward`)
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  const navigation = nav?.type ?? 'navigate'

  const intro = ref(
    initial.arrival || introDue({ named: initial.named, gallery: initial.gallery, reload: navigation !== 'navigate', calm: calm.value })
  )

  /* ------------------------------------------------------------------ cycles */

  /** The measured montage is only a seed: after that, the user's montages are the reference. */
  const restored = parseCycles(read('cycles'))
  const cycles = ref<Cycle[]>(restored.length ? restored : [defaultCycle()])

  const activeId = ref(stored('cycle', cycles.value[0]!.id, (v) => cycles.value.some((x) => x.id === v)))
  const block = ref(0)
  const elapsed = ref(0)
  const cycle = computed(() => cycles.value.find((x) => x.id === activeId.value) ?? cycles.value[0]!)

  /**
 * Where to find a state for `#state=` links: in the current montage if it is there, else in another one.
 */
  function locate(id: StateId) {
    const order = [cycle.value, ...cycles.value.filter((x) => x.id !== activeId.value)]
    for (const x of order) {
      const index = x.blocks.findIndex((b) => b.state === id)
      if (index >= 0) return { id: x.id, index }
    }
    return null
  }

  // a link to a given state opens the montage that holds it
  if (initial.named) {
    const found = locate(initial.state)
    if (found) {
      activeId.value = found.id
      block.value = found.index
    }
  }

  // the state is a player output; on arrival it starts from IDLE whatever the montage
  const state = ref<StateId>(intro.value ? 'idle' : (cycle.value.blocks[block.value]?.state ?? 'idle'))

  /**
 * Delayed write: stretching a card replaces the cycle on every move, and `localStorage` is synchronous.
 */
  let pending: ReturnType<typeof setTimeout>
  function savedCycles() {
    clearTimeout(pending)
    write('cycles', JSON.stringify(cycles.value))
  }
  watch(cycles, () => {
    clearTimeout(pending)
    pending = setTimeout(savedCycles, 250)
  })
  watch(activeId, (v) => write('cycle', v))
  // the delayed write is flushed on close (`pagehide`: also when entering the back-forward cache on mobile)
  window.addEventListener('pagehide', savedCycles)

  /* -------------------------------------------------------------------- affichages */

  // customization is the home view, unless the URL names a given state
  const view = ref<ViewId>(initial.named ? 'animations' : 'customize')

  /** Preview: the scene alone. Leave it with Escape or the button. */
  const preview = ref(false)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') preview.value = false
  })

  // the sequence does not play during customization, otherwise the shape cannot be read
  const playing = ref(intro.value || (initial.playing && view.value === 'animations'))
  /** The preview drives playback both ways: entering it plays, leaving it pauses. */
  watch(preview, (on) => {
    playing.value = on
  })

  /**
   * The last fragment WE wrote, waiting for its `hashchange`: without it, a state present twice in the montage
   * brought the playhead back to its first occurrence. Consumed on the first read.
   */
  let writtenByUs = ''
  // the URL can be shared, so it follows the state AND playback; replace, not push
  watch([state, playing], ([id, on]) => {
    // the URL describes the PLAYER: outside it, the displayed state is only decor
    if (view.value !== 'animations') return
    writtenByUs = `#state=${id}${on ? '' : '&stop'}`
    location.replace(writtenByUs)
  })

  window.addEventListener('hashchange', () => {
    if (location.hash === writtenByUs) {
      writtenByUs = ''
      return
    }
    const next = readHash()
    // the arrival stages the page OPENING: reload to replay it
    if (next.arrival && !initial.arrival) {
      location.reload()
      return
    }
    gallery.value = next.gallery
    if (next.gallery) return
    // only a link that NAMES a state moves playback
    if (!next.named) return
    const found = locate(next.state)
    if (!found) return
    view.value = 'animations'
    activeId.value = found.id
    block.value = found.index
  })

  /*
   * The player opens STOPPED, except for a link that NAMES a state (`#state=`), which already describes its playback.
   */
  let resume = initial.named && initial.playing
  let resumeBlock = block.value

  const played = computed(() => {
    if (intro.value) return INTRO
    if (view.value === 'animations') return cycle.value.blocks
    if (view.value !== 'settings') return REST
    return calm.value ? ENTRY_CALM : ENTRY
  })

  watch(view, (now, before) => {
    // changing the view interrupts the arrival
    intro.value = false
    // the position is only remembered when LEAVING the player
    if (before === 'animations') {
      resume = playing.value
      resumeBlock = block.value
    }
    if (now === 'animations') {
      playing.value = resume
      block.value = resumeBlock
      return
    }
    block.value = 0
    // only the settings play something outside the player: their entry swirl
    playing.value = now === 'settings'
  })

  /** An entry only plays once: as soon as the player reaches its idle block, chaining stops. */
  watch(block, (i) => {
    if (intro.value) {
      if (i >= INTRO.length - 1) {
        intro.value = false
        playing.value = false
      }
      return
    }
    if (view.value === 'settings' && i > 0) playing.value = false
  })

  /** Is the ball still alone on stage? The PLAYER POSITION says so. */
  const bare = computed(() => intro.value && block.value < POSE_AT)
  const left = computed(() => !bare.value && view.value === 'settings')
  const right = computed(() => !bare.value && view.value !== 'settings')

  /* ------------------------------------------------------------------- skins */

  const shape = ref(stored('shape', DEFAULT_SHAPE, (v) => SHAPE_BY_ID.has(v)))
  const color = ref(stored('color', DEFAULT_COLOR, (v) => COLOR_BY_ID.has(v)))
  const expression = ref(stored('expression', DEFAULT_EXPRESSION, (v) => EXPRESSION_BY_ID.has(v)))
  watch(shape, (v) => write('shape', v))
  watch(color, (v) => write('color', v))
  watch(expression, (v) => write('expression', v))

  /** Render style and pixel size, saved; also set on `currentRenderStyle` / `currentPixel`. */
  const renderStyle = ref<RenderStyleId>(stored('style', DEFAULT_RENDER_STYLE, isRenderStyle) as RenderStyleId)
  // pixel density: the finest, with no choice in the interface
  const pixel = ref<PixelSizeId>(DEFAULT_PIXEL)
  currentRenderStyle.value = renderStyle.value
  currentPixel.value = pixel.value
  watch(renderStyle, (v) => {
    currentRenderStyle.value = v
    write('style', v)
  })

  /** What an exported bot carries: the same as on screen, style included. */
  const settingsBot = () => ({
    shape: shape.value,
    color: color.value,
    expression: expression.value,
    // animations are rendered in 3D, frame by frame, in the screen's style
    renderStyle: renderStyle.value,
    pixel: pixel.value
  })

  /* ----------------------------------------------------------------- moods */

  /**
   * The ball becomes ROUND again during a turn (settings, arrival): on another shape, eyes stuck to the outline would
   * jitter. The user's choice is not touched, it comes back with a morph.
   */
  const displayShape = computed(() => (view.value === 'settings' || bare.value ? DEFAULT_SHAPE : shape.value))

  /** In the settings, the bot changes mood now and then: a page touch, not a setting. */
  const mood = ref<string | null>(null)
  let moodTimer: ReturnType<typeof setInterval> | undefined
  watch(view, (v) => {
    clearInterval(moodTimer)
    if (v !== 'settings') {
      mood.value = null
      return
    }
    let i = 0
    moodTimer = setInterval(() => {
      mood.value = MOODS[i % MOODS.length]!
      i++
    }, MOOD_MS)
  })

  const order = SEQUENCE.map((id) => STATES.find((s) => s.id === id)!)

  /** Adds an animation at the end of the current montage. */
  function addBlock(id: StateId) {
    cycles.value = cycles.value.map((x) => (x.id === cycle.value.id ? { ...x, blocks: blocksWith(x.blocks, id) } : x))
  }

  /** Only the player can set the engine again (it holds the clock), hence the direct call. */
  let bot: MochiBotElement | null = null
  function onSeek(s: number) {
    const { index, elapsed: offset } = blockAt(cycle.value.blocks, s)
    bot?.seek(index, offset)
  }

  /* ------------------------------------------------------------------ export */

  /** Bar hidden while the scene settles, only after the arrival. */
  const barHidden = ref(false)
  let timerBar: ReturnType<typeof setTimeout> | undefined
  watch(bare, (again, before) => {
    if (!before || again) return
    barHidden.value = true
    clearTimeout(timerBar)
    timerBar = setTimeout(() => (barHidden.value = false), ARRIVAL_DELAY)
  })

  const dialogCycle = ref(false)
  const formatCycle = ref<FormatCycle>(DEFAULT_CYCLE_FORMAT)
  const backgroundCycle = ref<BackgroundGif>(DEFAULT_GIF_BACKGROUND)
  /** `null` while not encoding; else the fraction done. */
  const progressCycle = ref<number | null>(null)
  /** Did the last montage export fail? (the export bar is not on screen in Animations) */
  const errorCycle = ref(false)
  let abandonCycle: AbortController | null = null

  /** Exports the MONTAGE: the current cycle is replayed off screen, from start to end. */
  async function exportCycle() {
    if (progressCycle.value !== null) return
    errorCycle.value = false
    const check = new AbortController()
    abandonCycle = check
    const blocks = cycle.value.blocks
    const format = formatCycle.value
    const images = cycleImages(totalDuration(blocks), format)
    const step = cycleStep(format)
    const size = CYCLE_SIZE[format]
    const settings = settingsBot()
    const suit = (done: number, total: number) => (progressCycle.value = done / total)
    progressCycle.value = 0
    try {
      const mp4 = format === 'mp4'
      // video has no alpha: it forces white; the GIF keeps the choice
      const file = mp4
        ? await cycleToMp4(settings, blocks, size, images, step, WHITE, suit, check.signal)
        : await cycleToGif(settings, blocks, size, images, step, backgroundColor(backgroundCycle.value), suit, check.signal)
      download(file, nameFile(nameOfCycle(cycle.value), '', '', mp4 ? 'mp4' : 'gif'))
      dialogCycle.value = false
    } catch (e) {
      // giving up is not a failure
      if (!(e instanceof Abandon)) errorCycle.value = true
    } finally {
      progressCycle.value = null
      abandonCycle = null
    }
  }
  const cancelsCycle = () => abandonCycle?.abort()
  // the failure belongs to the ATTEMPT: opening the dialog again makes it new
  watch(dialogCycle, (open) => {
    if (open) errorCycle.value = false
  })

  const stateExport = ref<StateExport>('ready')
  let confirmation: ReturnType<typeof setTimeout> | undefined
  /** GIF background, and the dialog that asks for it (the only format with one-bit transparency). */
  const backgroundGif = ref<BackgroundGif>(DEFAULT_GIF_BACKGROUND)
  const dialogGif = ref(false)

  /** Exports the avatar as it is SHOWN: the live node is serialized. */
  async function runExport(id: ActionId, confirmed = false) {
    // SYNCHRONOUS guard: two clicks in the same frame used to download twice
    if (stateExport.value === 'busy') return
    // the GIF asks for its background before leaving; the dialog calls back with `confirmed`
    if (!confirmed && ACTION_BY_ID.get(id)?.mode === 'gif') {
      dialogGif.value = true
      return
    }
    const action = ACTION_BY_ID.get(id)
    const svg = bot?.svg
    if (!action || !svg) return
    clearTimeout(confirmation)
    stateExport.value = 'busy'
    const name = () =>
      nameFile(
        shape.value,
        expression.value,
        color.value,
        action.extension,
        [renderStyleSuffix(renderStyle.value), action.suffix].filter(Boolean).join('-')
      )
    try {
      if (action.mode === 'gif') {
        // the animation is replayed from the start on an off-screen instance, in 3D
        download(await toGifAnimate(settingsBot(), action.size, GIF_IMAGES, GIF_STEP, backgroundColor(backgroundGif.value)), name())
        stateExport.value = 'export'
      } else {
        const markup = svgStandalone(svg, action.size)
        if (action.mode === 'copyImage') {
          // the blob leaves as a PROMISE: see `copy` in capture.ts
          await copy(toPng(markup, action.size))
          stateExport.value = 'copy'
        } else if (action.mode === 'copyText') {
          await copyText(markup)
          stateExport.value = 'copy'
        } else {
          const file = action.extension === 'svg' ? new Blob([markup], { type: 'image/svg+xml' }) : await toPng(markup, action.size)
          download(file, name())
          stateExport.value = 'export'
        }
      }
    } catch {
      // a clipboard refusal or an impossible encoding must not leave the bar on "busy"
      stateExport.value = 'error'
    }
    confirmation = setTimeout(() => (stateExport.value = 'ready'), CONFIRMATION_MS)
  }

  /** Replays the entry on EVERY arrival in the settings (after the player got the new montage). */
  watch(
    view,
    (v) => {
      if (v === 'settings') bot?.seek(0, 0)
    },
    { flush: 'post' }
  )

  /* ------------------------------------------------------------------ drawing */

  const sheet = () =>
    h(
      'div',
      { key: 'sheet', class: 'p-5' },
      h('a', { class: 'text-xs text-[var(--muted)] underline underline-offset-2', href: '#' }, t('gallery.back')),
      h(
        'div',
        { class: 'mt-4 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3' },
        order.map((s) =>
          h(
            'figure',
            { key: s.id, class: 'flex flex-col items-center' },
            h('mochi-bot', { label: t('app.botAria'), state: s.id, size: 210, shape: shape.value, color: color.value, expression: expression.value, frozenAt: POSES[s.id] }),
            h('figcaption', { class: 'text-xs text-[var(--muted)]' }, t(`states.${s.id}`))
          )
        )
      )
    )

  const editeur = () => {
    const v = view.value
    const pv = preview.value
    return h(
      'div',
      { key: 'editeur', style: 'display: contents' },
      // structure heading: a document with no h1 cannot be navigated with a screen reader
      h('h1', { class: 'sr-only' }, t('app.name')),
      // during the arrival the bar stays mounted but inert (otherwise it would stay in the tab order)
      !pv
        ? c(SideRail, { key: 'rail', view: v, onView: (x) => (view.value = x), class: 'rail', inert: bare.value || undefined })
        : // preview exit: the only element left on screen with the avatar
          h(
            'button',
            {
              key: 'exit',
              type: 'button',
              class:
                'fixed top-5 right-5 z-30 flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs text-[var(--muted)] shadow-sm backdrop-blur transition hover:text-[var(--ink)]',
              onClick: () => (preview.value = false)
            },
            t('preview.exit'),
            h('kbd', { class: 'rounded bg-black/5 px-1 py-0.5 text-[10px]' }, t('preview.key'))
          ),
      // room for the montage bar is ONLY kept where it exists
      h(
        'div',
        {
          key: 'scene',
          class: [
            'scene min-h-full items-stretch justify-center p-8 max-lg:flex max-lg:flex-col max-lg:gap-10 max-lg:px-5',
            !pv && v === 'animations' && 'pb-[calc(var(--timeline)_+_1rem)]',
            // under 64rem the rail becomes a TOP band: the scene keeps its height for it (except in preview)
            !pv && 'max-lg:pt-20',
            bare.value || pv ? 'scene--alone' : v === 'settings' && 'scene--left'
          ]
        },
        // settings panel, LEFT column: its width hides it, not a removal
        !pv
          ? h(
              'aside',
              {
                key: 'left',
                class: [
                  'panel scene__left w-full lg:flex lg:h-[calc(100dvh_-_3rem_-_var(--timeline))] lg:w-80 lg:shrink-0 lg:flex-col lg:justify-center lg:self-start lg:-translate-y-12 lg:pl-14',
                  left.value ? 'panel--open max-lg:order-2' : 'max-lg:hidden'
                ],
                // closed, it was only transparent (its column folds): without `inert` its fields stayed in
                // the tab order and were read by screen readers
                inert: !left.value,
                'aria-hidden': left.value ? undefined : 'true'
              },
              c(Settings, {})
            )
          : null,
        // scene: its height does not depend on the right panel
        h(
          'main',
          {
            key: 'main',
            class: [
              'scene__avatar relative flex flex-1 items-center justify-center max-lg:order-1 max-lg:flex-col max-lg:gap-4 lg:self-start',
              pv ? 'lg:min-h-[calc(100dvh_-_4rem)]' : 'lg:min-h-[calc(100dvh_-_3rem_-_var(--timeline))]'
            ]
          },
          // the avatar takes the available height
          h(
            'div',
            {
              class: [
                'avatar flex aspect-square w-full items-center justify-center',
                pv ? 'max-w-[min(560px,calc(100dvh_-_6rem))]' : 'max-w-[min(460px,calc(100dvh_-_var(--timeline)_-_7rem))]',
                bare.value && 'avatar--intro',
                v === 'settings' && !pv && 'avatar--giant'
              ]
            },
            h('mochi-bot', {
              ref: (el: Element | null) => (bot = el as MochiBotElement | null),
              // the tag's own label is English: the app passes it in the visitor's language
              label: t('app.botAria'),
              class: 'h-auto max-w-full',
              state: state.value,
              block: block.value,
              elapsed: elapsed.value,
              playing: playing.value,
              onStatechange: (e: CustomEvent<StateId>) => (state.value = e.detail),
              onBlockchange: (e: CustomEvent<number>) => (block.value = e.detail),
              onElapsedchange: (e: CustomEvent<number>) => (elapsed.value = e.detail),
              onPlayingchange: (e: CustomEvent<boolean>) => (playing.value = e.detail),
              cycle: played.value,
              size: pv ? 560 : 440,
              shape: displayShape.value,
              color: color.value,
              expression: mood.value ?? expression.value,
              follow: v === 'settings',
              gaze: intro.value ? INTRO_GAZE : null
            })
          ),
          // export bar: out of the flow, fitted on the avatar column; hidden and inert during the arrival
          v === 'customize' && !pv
            ? h(
                'div',
                { key: 'export', class: ['bar-export', (bare.value || barHidden.value) && 'bar-export--hidden'], inert: bare.value || barHidden.value },
                c(ExportBar, { state: stateExport.value, onExporter: (id) => runExport(id) })
              )
            : null,
          // both dialogs are OUTSIDE the export bar: `inert` would also neutralize the top layer
          v === 'animations' && !pv
            ? c(CycleDialog, {
                key: 'dcycle',
                open: dialogCycle.value,
                onOpen: (x) => (dialogCycle.value = x),
                format: formatCycle.value,
                onFormat: (x) => (formatCycle.value = x),
                background: backgroundCycle.value,
                onBackground: (x) => (backgroundCycle.value = x),
                progress: progressCycle.value,
                error: errorCycle.value,
                onConfirm: exportCycle,
                onCancel: cancelsCycle
              })
            : null,
          v === 'customize' && !pv
            ? c(GifDialog, {
                key: 'dgif',
                open: dialogGif.value,
                onOpen: (x) => (dialogGif.value = x),
                background: backgroundGif.value,
                onBackground: (x) => (backgroundGif.value = x),
                onConfirm: () => runExport('gif', true)
              })
            : null
        ),
        // fixed width, the same in both views: otherwise the scene shifts when the tab changes
        !pv
          ? h(
              'aside',
              {
                key: 'right',
                class: ['panel scene__right w-full lg:w-80 lg:shrink-0', right.value ? 'panel--open max-lg:order-2' : 'max-lg:hidden'],
                // same reason as the left panel: transparent is not hidden for the keyboard
                inert: !right.value,
                'aria-hidden': right.value ? undefined : 'true'
              },
              v === 'animations'
                ? [
                    h('h2', { key: 'ta', class: 'text-sm font-semibold' }, t('panel.animations')),
                    h(
                      'div',
                      { key: 'ga', class: 'mt-2 grid grid-cols-4 gap-1.5' },
                      order.map((s) =>
                        c(BotTile, {
                          key: s.id,
                          label: t(`states.${s.id}`),
                          selected: s.id === state.value,
                          state: s.id,
                          shape: shape.value,
                          color: color.value,
                          expression: expression.value,
                          frozenAt: POSES[s.id],
                          onClick: () => addBlock(s.id)
                        })
                      )
                    )
                  ]
                : c(Customizer, {
                    key: 'custom',
                    shape: shape.value,
                    onShape: (x) => (shape.value = x),
                    color: color.value,
                    onColor: (x) => (color.value = x),
                    expression: expression.value,
                    onExpression: (x) => (expression.value = x),
                    renderStyle: renderStyle.value,
                    onRender: (x) => (renderStyle.value = x)
                  })
            )
          : null
      ),
      // the project name, big, at the PAGE level; purely graphic
      v === 'settings' && !pv ? h('p', { key: 'word', class: 'wordmark', 'aria-hidden': 'true' }, NAME) : null,
      v === 'animations' && !pv
        ? c(Timeline, {
            key: 'timeline',
            cycles: cycles.value,
            onCycles: (x) => (cycles.value = x),
            activeId: activeId.value,
            onActiveId: (x) => (activeId.value = x),
            block: block.value,
            onBlock: (x) => (block.value = x),
            playing: playing.value,
            onPlaying: (x) => (playing.value = x),
            elapsed: elapsed.value,
            shape: shape.value,
            color: color.value,
            expression: expression.value,
            onSeek,
            onPreview: () => (preview.value = true),
            onExporter: () => (dialogCycle.value = true)
          })
        : null
    )
  }

  return () => (gallery.value ? sheet() : editeur())
}
