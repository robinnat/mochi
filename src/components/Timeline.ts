import { computed, link, ref } from '@/ui/dom/reactive'
import { c, h, type Component } from '@/ui/dom/h'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CycleMenu } from '@/components/CycleMenu'
import { NameDialog } from '@/components/NameDialog'
import { TimelineTrack } from '@/components/TimelineTrack'
import { ZoomSlider } from '@/components/ZoomSlider'
import { iconDownload } from '@/components/ExportBar'
import { blocksWith, makeBlock, nextCycleId, offsetOf, totalDuration, uniqueName, type Cycle } from '@/bot/cycles'
import { MAX_ZOOM, MIN_ZOOM, mmss } from '@/ui/timeline'
import { nameOfCycle, plural, t } from '@/i18n'

/**
 * Barre de montage : elle tient les cycles (choix, creation, renommage, suppression) et la lecture. La piste
 * elle-meme est dans `TimelineTrack` : ici on ne sait rien des gestes, la-bas on ne sait rien des cycles.
 */
export interface TimelineProps {
  /** temps ecoule dans le bloc courant, pour le compteur */
  elapsed: number
  shape: string
  color: string
  expression: string
  cycles: Cycle[]
  activeId: string
  block: number
  playing: boolean
  onCycles: (v: Cycle[]) => void
  onActiveId: (v: string) => void
  onBlock: (v: number) => void
  onPlaying: (v: boolean) => void
  /** deplacement de la tete de lecture : seul le lecteur sait recaler le moteur */
  onSeek: (s: number) => void
  onPreview: () => void
  onExporter: () => void
}

/* Solar plein (`solar:play-bold`, `solar:pause-bold`, `solar:eye-bold`), recopies tels quels depuis Iconify. */
const LECTURE = 'M21.4086 9.35258C23.5305 10.5065 23.5305 13.4935 21.4086 14.6474L8.59662 21.6145C6.53435 22.736 4 21.2763 4 18.9671L4 5.0329C4 2.72368 6.53435 1.26402 8.59661 2.38548L21.4086 9.35258Z'
const PAUSE = ['M2 6C2 4.11438 2 3.17157 2.58579 2.58579C3.17157 2 4.11438 2 6 2C7.88562 2 8.82843 2 9.41421 2.58579C10 3.17157 10 4.11438 10 6V18C10 19.8856 10 20.8284 9.41421 21.4142C8.82843 22 7.88562 22 6 22C4.11438 22 3.17157 22 2.58579 21.4142C2 20.8284 2 19.8856 2 18V6Z', 'M14 6C14 4.11438 14 3.17157 14.5858 2.58579C15.1716 2 16.1144 2 18 2C19.8856 2 20.8284 2 21.4142 2.58579C22 3.17157 22 4.11438 22 6V18C22 19.8856 22 20.8284 21.4142 21.4142C20.8284 22 19.8856 22 18 22C16.1144 22 15.1716 22 14.5858 21.4142C14 20.8284 14 19.8856 14 18V6Z']
const EYE = ['M9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z', 'M2 12C2 13.6394 2.42496 14.1915 3.27489 15.2957C4.97196 17.5004 7.81811 20 12 20C16.1819 20 19.028 17.5004 20.7251 15.2957C21.575 14.1915 22 13.6394 22 12C22 10.3606 21.575 9.80853 20.7251 8.70433C19.028 6.49956 16.1819 4 12 4C7.81811 4 4.97196 6.49956 3.27489 8.70433C2.42496 9.80853 2 10.3606 2 12ZM12 8.25C9.92893 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92893 15.75 12 15.75C14.0711 15.75 15.75 14.0711 15.75 12C15.75 9.92893 14.0711 8.25 12 8.25Z']

export const Timeline: Component<TimelineProps> = (props) => {
  const cycles = link(() => props.cycles, (v) => props.onCycles(v))
  const activeId = link(() => props.activeId, (v) => props.onActiveId(v))
  const block = link(() => props.block, (v) => props.onBlock(v))
  const playing = link(() => props.playing, (v) => props.onPlaying(v))

  const zoom = ref(1)
  const cycle = computed(() => cycles.value.find((x) => x.id === activeId.value) ?? cycles.value[0]!)
  const blocks = computed(() => cycle.value.blocks)
  const total = computed(() => totalDuration(blocks.value))
  const at = computed(() => offsetOf(blocks.value, block.value) + props.elapsed)

  /** Nommage d'un cycle : meme boite pour la creation et le renommage ; la creation n'a lieu qu'a la validation. */
  const naming = ref<{ mode: 'create' | 'rename'; id?: string } | null>(null)
  const nameDraft = ref('')
  const nameOpen = ref(false)
  /** Montage en attente de confirmation de suppression. */
  const removing = ref<Cycle | null>(null)
  const confirmOpen = ref(false)
  const removingDetail = computed(() => plural('dialog.removeDetail', removing.value?.blocks.length ?? 0))

  /** Remplace le cycle courant : les cycles sont des valeurs, jamais mutees. */
  function edit(next: Partial<Cycle>) {
    cycles.value = cycles.value.map((x) => (x.id === cycle.value.id ? { ...x, ...next } : x))
  }
  function select(id: string) {
    activeId.value = id
    block.value = 0
  }
  function askCreate() {
    naming.value = { mode: 'create' }
    nameDraft.value = uniqueName(t('cycles.newName'), cycles.value)
    nameOpen.value = true
  }
  function askRename(id: string) {
    naming.value = { mode: 'rename', id }
    const aims = cycles.value.find((x) => x.id === id)
    // le montage d'amorce n'a pas de nom propre : on part de celui qui s'affiche
    nameDraft.value = aims ? nameOfCycle(aims) : ''
    nameOpen.value = true
  }
  function onNamed(name: string) {
    const request = naming.value
    naming.value = null
    if (!request) return
    if (request.mode === 'create') {
      // jamais de cycle vide : le lecteur aurait un montage sans rien a jouer
      const fresh: Cycle = { id: nextCycleId(cycles.value), name: uniqueName(name, cycles.value), blocks: [makeBlock('idle')] }
      cycles.value = [...cycles.value, fresh]
      select(fresh.id)
      return
    }
    const others = cycles.value.filter((x) => x.id !== request.id)
    const unique = uniqueName(name, others)
    cycles.value = cycles.value.map((x) => (x.id === request.id ? { ...x, name: unique } : x))
  }
  /** Suppression d'un montage : jamais sans confirmation, c'est irreversible. */
  function askRemove(id: string) {
    removing.value = cycles.value.find((x) => x.id === id) ?? null
    confirmOpen.value = true
  }
  function onRemove() {
    const target = removing.value
    removing.value = null
    if (!target) return
    const reste = cycles.value.filter((x) => x.id !== target.id)
    cycles.value = reste
    if (target.id === activeId.value) select(reste[0]!.id)
  }

  /*
   * Barre de montage fixee en bas, sans fond ni cadre au-dessus de 64rem (la page ne defile pas, rien ne passe
   * derriere). `lg:left-[4.5rem]` repond a `lg:right-[24.5rem]` : la bande couvre EXACTEMENT la colonne de l'avatar.
   * En dessous de 64rem la page defile : fond et filet du haut.
   */
  return () =>
    h(
      'div',
      { class: 'fixed inset-x-0 bottom-0 z-30 h-[var(--timeline)] px-6 pt-3 pb-5 max-lg:border-t max-lg:border-[var(--line)] max-lg:bg-[var(--paper)] max-lg:px-5 lg:right-[24.5rem] lg:left-[4.5rem]' },
      // lecture : flottante au-dessus de la piste ; les compteurs disparaissent sous 64rem
      h(
        'div',
        { class: 'absolute -top-5 left-1/2 flex -translate-x-1/2 items-center gap-3' },
        h('span', { class: 'text-sm font-medium tabular-nums max-lg:hidden' }, mmss(at.value)),
        h(
          'button',
          {
            type: 'button',
            class: 'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--ink)] text-[var(--paper)] shadow-sm transition hover:scale-105 active:scale-95',
            'aria-label': playing.value ? t('timeline.pause') : t('timeline.play'),
            onClick: () => (playing.value = !playing.value)
          },
          !playing.value
            ? h('svg', { key: 'l', width: '16', height: '16', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { fill: 'currentColor', d: LECTURE }))
            : h('svg', { key: 'p', width: '16', height: '16', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('g', { fill: 'currentColor' }, PAUSE.map((d) => h('path', { d }))))
        ),
        h('span', { class: 'text-sm tabular-nums text-[var(--muted)] max-lg:hidden' }, mmss(total.value))
      ),
      // rien ne se selectionne dans une barre d'outils
      h(
        'div',
        { class: 'flex h-full flex-col gap-2 select-none' },
        // le nom du montage a gauche, ce qu'on en fait a droite (l'export est une action sur le CYCLE)
        h(
          'div',
          { class: 'flex items-center justify-between gap-1' },
          c(CycleMenu, {
            activeId: activeId.value,
            onActiveId: (v) => (activeId.value = v),
            cycles: cycles.value,
            current: cycle.value,
            onCreate: askCreate,
            onRename: askRename,
            onRemove: askRemove
          }),
          h(
            'button',
            {
              type: 'button',
              class:
                'flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-[var(--ink)] pr-3.5 pl-3 text-sm font-medium text-[var(--paper)] shadow-sm transition hover:opacity-90 active:scale-95 max-sm:w-8 max-sm:justify-center max-sm:px-0',
              onClick: () => props.onExporter()
            },
            iconDownload('16'),
            // `sr-only` et pas `hidden` : le libelle reste le NOM accessible du bouton reduit a son icone
            h('span', { class: 'max-sm:sr-only' }, t('timeline.export'))
          )
        ),
        c(TimelineTrack, {
          block: block.value,
          onBlock: (v) => (block.value = v),
          zoom: zoom.value,
          onZoom: (v) => (zoom.value = v),
          blocks: blocks.value,
          elapsed: props.elapsed,
          shape: props.shape,
          color: props.color,
          expression: props.expression,
          onBlocks: (b) => edit({ blocks: b }),
          onAdd: (s) => edit({ blocks: blocksWith(blocks.value, s) }),
          onSeek: (s) => props.onSeek(s)
        }),
        // barre d'outils, dans le coin : loupe, compteur, apercu
        h(
          'div',
          { class: 'flex shrink-0 items-center justify-end gap-4 max-sm:gap-2' },
          c(ZoomSlider, { zoom: zoom.value, onZoom: (v) => (zoom.value = v), min: MIN_ZOOM, max: MAX_ZOOM }),
          h('p', { class: 'text-xs tabular-nums text-[var(--muted)]' }, h('span', { class: 'text-[var(--ink)]' }, mmss(at.value)), ` / ${mmss(total.value)}`),
          // infobulle au survol ET au focus clavier, comme la barre laterale
          h(
            'span',
            { class: 'group relative flex' },
            h(
              'button',
              {
                type: 'button',
                class: 'flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)]',
                'aria-label': t('timeline.preview'),
                onClick: () => props.onPreview()
              },
              h(
                'svg',
                { width: '17', height: '17', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
                h('g', { fill: 'currentColor' }, h('path', { d: EYE[0] }), h('path', { 'fill-rule': 'evenodd', 'clip-rule': 'evenodd', d: EYE[1] }))
              )
            ),
            h(
              'span',
              {
                class:
                  'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs whitespace-nowrap text-[var(--paper)] opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100',
                role: 'tooltip'
              },
              t('timeline.preview')
            )
          )
        )
      ),
      c(NameDialog, {
        open: nameOpen.value,
        onOpen: (v) => (nameOpen.value = v),
        value: nameDraft.value,
        title: naming.value?.mode === 'rename' ? t('dialog.nameRenameTitle') : t('dialog.nameCreateTitle'),
        label: t('dialog.nameField'),
        submitLabel: naming.value?.mode === 'rename' ? t('dialog.nameRename') : t('dialog.nameCreate'),
        onSubmit: onNamed
      }),
      c(ConfirmDialog, {
        open: confirmOpen.value,
        onOpen: (v) => (confirmOpen.value = v),
        title: t('dialog.removeTitle', { name: removing.value ? nameOfCycle(removing.value) : '' }),
        detail: removingDetail.value,
        confirmLabel: t('dialog.removeConfirm'),
        onConfirm: onRemove
      })
    )
}
