import { computed, link, nextTick, ref, watch } from '@/ui/dom/reactive'
import { c, h, onMount, type Component } from '@/ui/dom/h'
import '@/components/mochi-bot'
import { BlockPicker } from '@/components/BlockPicker'
import { clampDuration, moveBlock, offsetOf, STEP, totalDuration, type Block } from '@/bot/cycles'
import { POSES, type StateId } from '@/bot/states'
import { BASE_SCALE, clampZoom, ticksFor } from '@/ui/timeline'
import { seconds, secondsShort, t } from '@/i18n'

/**
 * The track: a graduated ruler, the montage cards, and their gestures (move, stretch, scrub the playhead, zoom). It
 * knows neither cycles nor the player: it gets a list of blocks and returns the one you get after the gesture.
 */
export interface TimelineTrackProps {
  blocks: Block[]
  /** time elapsed in the current block, for the playhead */
  elapsed: number
  shape: string
  color: string
  expression: string
  block: number
  zoom: number
  onBlock: (i: number) => void
  onZoom: (z: number) => void
  onBlocks: (b: Block[]) => void
  /** time aimed at on the ruler */
  onSeek: (s: number) => void
  onAdd: (s: StateId) => void
}

type Drag = { from: number; to: number; startX: number; dx: number; moved: boolean }
type Resize = { index: number; startX: number; startDuration: number }

export const TimelineTrack: Component<TimelineTrackProps> = (props) => {
  const block = link(() => props.block, (v) => props.onBlock(v))
  const zoom = link(() => props.zoom, (v) => props.onZoom(v))

  const scale = computed(() => BASE_SCALE * zoom.value)
  const total = computed(() => totalDuration(props.blocks))
  const at = computed(() => offsetOf(props.blocks, block.value) + props.elapsed)
  const ticks = computed(() => ticksFor(total.value, scale.value))
  const exact = computed(() => seconds(at.value))

  let track: HTMLElement | null = null
  /** Track overflow, to show the gradients only when they help. */
  const overflow = ref({ left: false, right: false })
  /** Track scroll: the time tooltip lives outside and must subtract it. */
  const scrolled = ref(0)

  const width = (index: number) => props.blocks[index]!.duration * scale.value
  const label = (index: number) => t(`states.${props.blocks[index]!.state}`)

  /* ------------------------------------------------------- defilement, loupe */

  function onScroll() {
    const el = track
    if (!el) return
    scrolled.value = el.scrollLeft
    const o = { left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }
    if (o.left !== overflow.value.left || o.right !== overflow.value.right) overflow.value = o
  }

  /** Anchor of the next zoom change, in screen coordinates: the second found there stays there. */
  let anchorX: number | null = null
  function setZoom(next: number, clientX?: number) {
    anchorX = clientX ?? null
    zoom.value = clampZoom(next)
  }
  watch(scale, (now, before) => {
    const el = track
    if (!el || before === undefined) return
    const x = (anchorX ?? el.getBoundingClientRect().left + el.clientWidth / 2) - el.getBoundingClientRect().left
    const second = (el.scrollLeft + x) / before
    anchorX = null
    nextTick(() => {
      el.scrollLeft = second * now - x
      onScroll()
    })
  })

  /**
   * Wheel and trackpad: pinch (wheel + `ctrl`) or `ctrl`/`cmd` + wheel = zoom; two fingers horizontally = scroll;
   * mouse wheel = horizontal scroll. `deltaMode` 1 counts in lines.
   */
  function onWheel(e: WheelEvent) {
    const el = track
    if (!el) return
    const unit = e.deltaMode === 1 ? 16 : 1
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setZoom(zoom.value * Math.exp((-e.deltaY * unit) / 180), e.clientX)
      return
    }
    if (el.scrollWidth <= el.clientWidth) return
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (!d) return
    e.preventDefault()
    el.scrollLeft += d * unit
  }

  onMount(onScroll)
  watch([total, () => props.blocks], () => nextTick(onScroll))

  // the current card stays visible when the track overflows
  watch(
    () => block.value,
    () => {
      const el = track
      if (!el) return
      const x = offsetOf(props.blocks, block.value) * scale.value
      if (x < el.scrollLeft || x + width(block.value) > el.scrollLeft + el.clientWidth) {
        el.scrollTo({ left: Math.max(0, x - 24), behavior: 'smooth' })
      }
    }
  )

  /* --------------------------------------------------------------- montage */

  function removeBlock(index: number) {
    // the last card does not leave: an empty montage would have nothing to play
    if (props.blocks.length < 2) return
    const n = props.blocks.length
    props.onBlocks(props.blocks.filter((_, i) => i !== index))
    // the cursor follows, and never points past the track
    if (index < block.value) block.value = block.value - 1
    else if (block.value >= n - 1) block.value = n - 2
  }

  function setDuration(index: number, wanted: number) {
    const b = props.blocks[index]
    if (!b) return
    const duration = clampDuration(b.state, wanted)
    if (duration === b.duration) return
    props.onBlocks(props.blocks.map((old, i) => (i === index ? { ...old, duration } : old)))
  }

  /* ------------------------------------------------------ glisser / etirer */

  /**
   * Drag and drop: during the gesture, the montage is NOT changed. The grabbed card follows the pointer and the
   * others move aside by its width; the montage is only rebuilt on drop.
   */
  const drag = ref<Drag | null>(null)
  const resize = ref<Resize | null>(null)
  const scrubbing = ref(false)

  function shiftOf(i: number) {
    const d = drag.value
    if (!d?.moved) return 0
    if (i === d.from) return d.dx
    const w = width(d.from)
    if (d.to > d.from && i > d.from && i <= d.to) return -w
    if (d.to < d.from && i >= d.to && i < d.from) return w
    return 0
  }
  const lifted = (i: number) => Boolean(drag.value?.moved) && i === drag.value?.from

  function indexAt(s: number) {
    let acc = 0
    for (let i = 0; i < props.blocks.length; i++) {
      acc += props.blocks[i]!.duration
      if (s < acc) return i
    }
    return props.blocks.length - 1
  }
  function pointerSeconds(e: PointerEvent) {
    const box = track?.getBoundingClientRect()
    if (!box) return 0
    return (e.clientX - box.left + (track?.scrollLeft ?? 0)) / scale.value
  }

  function onBlockDown(index: number, e: PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.value = { from: index, to: index, startX: e.clientX, dx: 0, moved: false }
  }
  function onBlockMove(e: PointerEvent) {
    const d = drag.value
    if (!d) return
    // a few pixels of tolerance: a click always shakes a little
    if (!d.moved && Math.abs(e.clientX - d.startX) <= 4) return
    drag.value = { ...d, moved: true, dx: e.clientX - d.startX, to: Math.max(0, indexAt(pointerSeconds(e))) }
  }
  function onBlockUp(index: number, e?: PointerEvent) {
    const end = drag.value
    drag.value = null
    if (!end) return
    // the card drops where the finger LIFTS: on touch, the last `pointermove` can arrive late or
    // with a stale position (seen in emulated mobile Chrome), and the card went back to its place
    const d = e && (end.moved || Math.abs(e.clientX - end.startX) > 4) ? { ...end, moved: true, to: Math.max(0, indexAt(pointerSeconds(e))) } : end
    // a click without a move is a playhead jump
    if (!d.moved) {
      block.value = index
      return
    }
    if (d.to === d.from) return
    const tracking = block.value === d.from ? d.to : block.value
    props.onBlocks(moveBlock(props.blocks, d.from, d.to))
    block.value = tracking
  }

  function onResizeDown(index: number, e: PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    resize.value = { index, startX: e.clientX, startDuration: props.blocks[index]!.duration }
  }
  function onResizeMove(e: PointerEvent) {
    const r = resize.value
    if (!r) return
    setDuration(r.index, r.startDuration + (e.clientX - r.startX) / scale.value)
  }
  const onResizeKey = (index: number, delta: number) => setDuration(index, props.blocks[index]!.duration + delta)

  /* -------------------------------------------------------------- keyboard */

  /**
   * Reordering and scrubbing WITH THE KEYBOARD: `Alt` + arrows moves the card, bare arrows move the playhead by
   * `STEP`. Focus FOLLOWS the moved card (after rendering). The card carries `aria-keyshortcuts`.
   */
  async function onCardKey(index: number, e: KeyboardEvent) {
    const direction = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (!direction) return
    e.preventDefault()
    if (!e.altKey) {
      props.onSeek(Math.max(0, Math.min(total.value - 0.001, at.value + direction * STEP)))
      return
    }
    const target = index + direction
    if (target < 0 || target >= props.blocks.length) return
    props.onBlocks(moveBlock(props.blocks, index, target))
    block.value = target
    await nextTick()
    track?.querySelectorAll<HTMLButtonElement>('[data-carte]')[target]?.focus()
  }

  /* ----------------------------------------------------------------- scrub */

  const scrubTo = (e: PointerEvent) => props.onSeek(Math.max(0, Math.min(total.value - 0.001, pointerSeconds(e))))
  function onRulerDown(e: PointerEvent) {
    // without it, moving the playhead highlights the ticks on the way
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    scrubbing.value = true
    scrubTo(e)
  }
  function onRulerMove(e: PointerEvent) {
    if (scrubbing.value) scrubTo(e)
  }

  return () =>
    h(
      'div',
      { class: 'relative flex-1' },
      h(
        'div',
        {
          ref: (el: Element | null) => (track = el as HTMLElement | null),
          class: 'h-full overflow-x-auto overflow-y-hidden [scrollbar-width:none]',
          onScroll,
          onWheel
        },
        // the track keeps room for the "+" card after it
        h(
          'div',
          { class: 'relative flex h-full flex-col', style: { width: `${total.value * scale.value + 76}px` } },
          // graduated ruler: grab it anywhere to move the playhead
          h(
            'div',
            {
              class: 'relative h-7 shrink-0 cursor-ew-resize pt-1 select-none',
              onPointerdown: onRulerDown,
              onPointermove: onRulerMove,
              onPointerup: () => (scrubbing.value = false),
              onPointercancel: () => (scrubbing.value = false)
            },
            ticks.value.map((tick) =>
              h(
                'span',
                { key: tick.t, class: 'absolute bottom-1.5 flex items-end gap-1', style: { transform: `translateX(${tick.t * scale.value}px)` } },
                h('span', { class: ['block w-px bg-[var(--line)]', tick.major ? 'h-3' : 'h-1.5'] }),
                tick.major
                  ? h('span', { class: '-mb-0.5 text-xs leading-none text-[var(--muted)]' }, secondsShort(tick.t, Number.isInteger(tick.t) ? 0 : 1))
                  : null
              )
            )
          ),
          h(
            'ul',
            { class: 'flex flex-1 items-stretch' },
            // the <li> width is exactly the duration: the gutter is inner padding
            props.blocks.map((b, i) =>
              h(
                'li',
                {
                  key: `${i}-${b.state}`,
                  class: ['group relative shrink-0 pr-1', lifted(i) ? 'z-20' : 'transition-transform duration-150 ease-out'],
                  style: { width: `${b.duration * scale.value}px`, transform: shiftOf(i) ? `translateX(${shiftOf(i)}px)` : undefined }
                },
                h(
                  'button',
                  {
                    type: 'button',
                    class: [
                      // `touch-none`: with a finger, without it the browser takes the gesture for a track scroll and
                      // cancels the pointer (pointercancel) after a few pixels, the card never moved
                      'flex h-full w-full cursor-grab touch-none flex-col justify-between overflow-hidden rounded-lg px-1.5 py-1 text-left transition select-none active:cursor-grabbing',
                      i === block.value ? 'bg-white ring-2 ring-[var(--ink)] ring-inset' : 'bg-black/[0.045] hover:bg-black/[0.08]',
                      lifted(i) ? 'scale-[1.02] opacity-75 shadow-lg' : ''
                    ],
                    'aria-label': t('timeline.blockAria', { state: label(i), duration: seconds(b.duration) }),
                    'aria-current': i === block.value ? 'true' : undefined,
                    onPointerdown: (e: PointerEvent) => onBlockDown(i, e),
                    onPointermove: onBlockMove,
                    onPointerup: (e: PointerEvent) => onBlockUp(i, e),
                    onPointercancel: () => (drag.value = null),
                    'data-card': '',
                    'aria-keyshortcuts': 'Alt+ArrowLeft Alt+ArrowRight ArrowLeft ArrowRight',
                    onKeydown: (e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        block.value = i
                      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') onCardKey(i, e)
                    }
                  },
                  // the thumbnail IS the card's identity; the name stays in the button's label
                  h(
                    'span',
                    { class: 'flex min-w-0 flex-1 items-center justify-center' },
                    width(i) > 44
                      ? h('mochi-bot', {
                          class: 'shrink-0',
                          state: b.state,
                          size: Math.min(56, Math.max(30, width(i) * 0.5)),
                          shape: props.shape,
                          color: props.color,
                          expression: props.expression,
                          paper: i === block.value ? '#ffffff' : '#f2f2f2',
                          frozenAt: POSES[b.state]
                        })
                      : null
                  ),
                  width(i) > 50
                    ? h(
                        'span',
                        {
                          class: ['tronque text-center text-xs leading-none font-semibold tabular-nums', i === block.value ? 'text-[var(--ink)]' : 'text-[var(--muted)]']
                        },
                        seconds(b.duration)
                      )
                    : null
                ),
                // duration handle: a full button, so usable with the keyboard
                h('button', {
                  type: 'button',
                  class:
                    'absolute inset-y-2 right-0.5 w-1 cursor-ew-resize touch-none rounded-full bg-[var(--muted)] opacity-0 transition group-hover:opacity-60 hover:opacity-100! focus-visible:opacity-100',
                  'aria-label': t('timeline.blockDurationAria', { state: label(i), duration: seconds(b.duration) }),
                  onPointerdown: (e: PointerEvent) => onResizeDown(i, e),
                  onPointermove: onResizeMove,
                  onPointerup: () => (resize.value = null),
                  onPointercancel: () => (resize.value = null),
                  onKeydown: (e: KeyboardEvent) => {
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault()
                      onResizeKey(i, -STEP)
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault()
                      onResizeKey(i, STEP)
                    }
                  }
                }),
                props.blocks.length > 1
                  ? h(
                      'button',
                      {
                        type: 'button',
                        class:
                          'absolute top-1 right-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/10 text-[var(--ink)] opacity-0 transition group-hover:opacity-100 hover:bg-black/20 focus-visible:opacity-100',
                        'aria-label': t('timeline.blockRemoveAria', { state: label(i) }),
                        onClick: () => removeBlock(i)
                      },
                      // drawn cross: the "×" glyph does not sit at the optical center of the dot
                      h(
                        'svg',
                        { width: '9', height: '9', viewBox: '0 0 10 10', 'aria-hidden': 'true' },
                        h('path', { d: 'M2.6 2.6 7.4 7.4M7.4 2.6 2.6 7.4', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' })
                      )
                    )
                  : null
              )
            ),
            h(
              'li',
              { key: 'most', class: 'w-[72px] shrink-0 pl-1' },
              c(BlockPicker, { shape: props.shape, color: props.color, expression: props.expression, onPick: (s) => props.onAdd(s) })
            )
          ),
          // playhead: only its transform changes from frame to frame
          h(
            'div',
            { class: 'pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-full bg-[var(--ink)]', style: { transform: `translateX(${at.value * scale.value}px)` } },
            h('span', { class: 'absolute -top-0.5 -left-[5px] h-3 w-3 rounded-full border-2 border-[var(--paper)] bg-[var(--ink)]' })
          )
        )
      ),
      // exact time during the move, outside the scrolling container (hence `scrolled`)
      scrubbing.value
        ? h(
            'div',
            { key: 'exact', class: 'pointer-events-none absolute top-0 left-0 z-10', style: { transform: `translate(${at.value * scale.value - scrolled.value}px, -70%)` } },
            h('span', { class: 'block -translate-x-1/2 rounded-md bg-[var(--ink)] px-2 py-1 text-xs tabular-nums text-[var(--paper)] shadow-sm' }, exact.value)
          )
        : null,
      // overflow gradients: the track goes on that way
      overflow.value.left
        ? h('div', { key: 'g', class: 'pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--paper)] to-transparent' })
        : null,
      overflow.value.right
        ? h('div', { key: 'd', class: 'pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--paper)] to-transparent' })
        : null
    )
}
