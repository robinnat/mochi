import { computed, lien, nextTick, ref, watch } from '@/ui/dom/reactif'
import { c, h, surMontage, type Composant } from '@/ui/dom/h'
import '@/components/mochi-bot'
import { BlockPicker } from '@/components/BlockPicker'
import { clampDuration, moveBlock, offsetOf, STEP, totalDuration, type Block } from '@/bot/cycles'
import { POSES, type StateId } from '@/bot/states'
import { BASE_SCALE, clampZoom, ticksFor } from '@/ui/timeline'
import { secondes, secondesCourtes, t } from '@/i18n'

/**
 * La piste : une regle graduee, les cartes du montage, et les gestes qui vont avec (deplacer, etirer, promener la
 * tete de lecture, zoomer). Elle ne connait ni les cycles ni le lecteur : elle recoit une suite de blocs et rend
 * celle qu'on obtient apres le geste.
 */
export interface TimelineTrackProps {
  blocks: Block[]
  /** temps ecoule dans le bloc courant, pour la tete de lecture */
  elapsed: number
  shape: string
  color: string
  expression: string
  block: number
  zoom: number
  onBlock: (i: number) => void
  onZoom: (z: number) => void
  onBlocks: (b: Block[]) => void
  /** date visee sur la regle */
  onSeek: (s: number) => void
  onAdd: (s: StateId) => void
}

type Drag = { from: number; to: number; startX: number; dx: number; moved: boolean }
type Resize = { index: number; startX: number; startDuration: number }

export const TimelineTrack: Composant<TimelineTrackProps> = (props) => {
  const block = lien(() => props.block, (v) => props.onBlock(v))
  const zoom = lien(() => props.zoom, (v) => props.onZoom(v))

  const scale = computed(() => BASE_SCALE * zoom.value)
  const total = computed(() => totalDuration(props.blocks))
  const at = computed(() => offsetOf(props.blocks, block.value) + props.elapsed)
  const ticks = computed(() => ticksFor(total.value, scale.value))
  const exact = computed(() => secondes(at.value))

  let track: HTMLElement | null = null
  /** Debordement de la piste, pour n'afficher les degrades que s'ils servent. */
  const overflow = ref({ left: false, right: false })
  /** Defilement de la piste : l'infobulle de temps vit dehors et doit le retrancher. */
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

  /** Point d'ancrage du prochain changement d'echelle, en coordonnees d'ecran : la seconde qui s'y trouve y reste. */
  let anchorX: number | null = null
  function setZoom(next: number, clientX?: number) {
    anchorX = clientX ?? null
    zoom.value = clampZoom(next)
  }
  watch(scale, (now, before) => {
    const el = track
    if (!el || before === undefined) return
    const x = (anchorX ?? el.getBoundingClientRect().left + el.clientWidth / 2) - el.getBoundingClientRect().left
    const seconde = (el.scrollLeft + x) / before
    anchorX = null
    nextTick(() => {
      el.scrollLeft = seconde * now - x
      onScroll()
    })
  })

  /**
   * Molette et trackpad : pincement (molette + `ctrl`) ou `ctrl`/`cmd` + molette = loupe ; deux doigts a
   * l'horizontale = defilement ; molette de souris = defilement horizontal. `deltaMode` 1 compte en lignes.
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

  surMontage(onScroll)
  watch([total, () => props.blocks], () => nextTick(onScroll))

  // la carte courante reste visible quand la piste deborde
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
    // la derniere carte ne part pas : un montage vide n'aurait rien a jouer
    if (props.blocks.length < 2) return
    const n = props.blocks.length
    props.onBlocks(props.blocks.filter((_, i) => i !== index))
    // le curseur suit, et ne pointe jamais au-dela de la piste
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
   * Glisser-deposer : pendant le geste, le montage n'est PAS modifie. La carte saisie suit le pointeur et les autres
   * s'ecartent de sa largeur ; le montage n'est recompose qu'au lacher.
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
    // quelques pixels de tolerance : un clic tremble toujours un peu
    if (!d.moved && Math.abs(e.clientX - d.startX) <= 4) return
    drag.value = { ...d, moved: true, dx: e.clientX - d.startX, to: Math.max(0, indexAt(pointerSeconds(e))) }
  }
  function onBlockUp(index: number, e?: PointerEvent) {
    const fin = drag.value
    drag.value = null
    if (!fin) return
    // la carte tombe la ou le doigt se LEVE : au toucher, le dernier `pointermove` peut arriver en retard ou
    // avec une position perimee (vu en Chrome mobile emule), et la carte revenait a sa place
    const d = e && (fin.moved || Math.abs(e.clientX - fin.startX) > 4) ? { ...fin, moved: true, to: Math.max(0, indexAt(pointerSeconds(e))) } : fin
    // un clic sans deplacement, c'est un saut de la tete de lecture
    if (!d.moved) {
      block.value = index
      return
    }
    if (d.to === d.from) return
    const suivi = block.value === d.from ? d.to : block.value
    props.onBlocks(moveBlock(props.blocks, d.from, d.to))
    block.value = suivi
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

  /* -------------------------------------------------------------- au clavier */

  /**
   * Reordonner et pointer AU CLAVIER : `Alt` + fleches deplace la carte, les fleches nues promenent la tete de
   * lecture de `STEP`. Le focus SUIT la carte deplacee (apres le rendu). La carte porte `aria-keyshortcuts`.
   */
  async function onCardKey(index: number, e: KeyboardEvent) {
    const sens = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (!sens) return
    e.preventDefault()
    if (!e.altKey) {
      props.onSeek(Math.max(0, Math.min(total.value - 0.001, at.value + sens * STEP)))
      return
    }
    const cible = index + sens
    if (cible < 0 || cible >= props.blocks.length) return
    props.onBlocks(moveBlock(props.blocks, index, cible))
    block.value = cible
    await nextTick()
    track?.querySelectorAll<HTMLButtonElement>('[data-carte]')[cible]?.focus()
  }

  /* ----------------------------------------------------------------- scrub */

  const scrubTo = (e: PointerEvent) => props.onSeek(Math.max(0, Math.min(total.value - 0.001, pointerSeconds(e))))
  function onRulerDown(e: PointerEvent) {
    // sans ca, promener la tete de lecture surligne les graduations au passage
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
        // la piste garde de la place pour la carte « + » a sa suite
        h(
          'div',
          { class: 'relative flex h-full flex-col', style: { width: `${total.value * scale.value + 76}px` } },
          // regle graduee : on attrape n'importe ou dessus pour promener la tete de lecture
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
                  ? h('span', { class: '-mb-0.5 text-xs leading-none text-[var(--muted)]' }, secondesCourtes(tick.t, Number.isInteger(tick.t) ? 0 : 1))
                  : null
              )
            )
          ),
          h(
            'ul',
            { class: 'flex flex-1 items-stretch' },
            // la largeur du <li> vaut exactement la duree : la gouttiere est un padding interne
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
                      // `touch-none` : au doigt, sans lui le navigateur prend le geste pour un defilement de la piste et
                      // annule le pointeur (pointercancel) au bout de quelques pixels, la carte ne bougeait jamais
                      'flex h-full w-full cursor-grab touch-none flex-col justify-between overflow-hidden rounded-lg px-1.5 py-1 text-left transition select-none active:cursor-grabbing',
                      i === block.value ? 'bg-white ring-2 ring-[var(--ink)] ring-inset' : 'bg-black/[0.045] hover:bg-black/[0.08]',
                      lifted(i) ? 'scale-[1.02] opacity-75 shadow-lg' : ''
                    ],
                    'aria-label': t('timeline.blockAria', { state: label(i), duration: secondes(b.duration) }),
                    'aria-current': i === block.value ? 'true' : undefined,
                    onPointerdown: (e: PointerEvent) => onBlockDown(i, e),
                    onPointermove: onBlockMove,
                    onPointerup: (e: PointerEvent) => onBlockUp(i, e),
                    onPointercancel: () => (drag.value = null),
                    'data-carte': '',
                    'aria-keyshortcuts': 'Alt+ArrowLeft Alt+ArrowRight ArrowLeft ArrowRight',
                    onKeydown: (e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        block.value = i
                      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') onCardKey(i, e)
                    }
                  },
                  // la miniature EST l'identite de la carte ; le nom reste dans l'etiquette du bouton
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
                        secondes(b.duration)
                      )
                    : null
                ),
                // poignee de duree : bouton a part entiere, donc utilisable au clavier
                h('button', {
                  type: 'button',
                  class:
                    'absolute inset-y-2 right-0.5 w-1 cursor-ew-resize touch-none rounded-full bg-[var(--muted)] opacity-0 transition group-hover:opacity-60 hover:opacity-100! focus-visible:opacity-100',
                  'aria-label': t('timeline.blockDurationAria', { state: label(i), duration: secondes(b.duration) }),
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
                      // croix dessinee : le glyphe « × » ne tombe pas au centre optique de la pastille
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
              { key: 'plus', class: 'w-[72px] shrink-0 pl-1' },
              c(BlockPicker, { shape: props.shape, color: props.color, expression: props.expression, onPick: (s) => props.onAdd(s) })
            )
          ),
          // tete de lecture : seule sa transformation change d'une image a l'autre
          h(
            'div',
            { class: 'pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-full bg-[var(--ink)]', style: { transform: `translateX(${at.value * scale.value}px)` } },
            h('span', { class: 'absolute -top-0.5 -left-[5px] h-3 w-3 rounded-full border-2 border-[var(--paper)] bg-[var(--ink)]' })
          )
        )
      ),
      // temps exact pendant le deplacement, hors du conteneur qui defile (d'ou `scrolled`)
      scrubbing.value
        ? h(
            'div',
            { key: 'exact', class: 'pointer-events-none absolute top-0 left-0 z-10', style: { transform: `translate(${at.value * scale.value - scrolled.value}px, -70%)` } },
            h('span', { class: 'block -translate-x-1/2 rounded-md bg-[var(--ink)] px-2 py-1 text-xs tabular-nums text-[var(--paper)] shadow-sm' }, exact.value)
          )
        : null,
      // degrades de debordement : la piste continue par la
      overflow.value.left
        ? h('div', { key: 'g', class: 'pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--paper)] to-transparent' })
        : null,
      overflow.value.right
        ? h('div', { key: 'd', class: 'pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--paper)] to-transparent' })
        : null
    )
}
