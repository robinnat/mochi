import { computed, ref } from '@/ui/dom/reactive'
import { h, type Component } from '@/ui/dom/h'
import 'mochis'
import { MOOD_IDS, REACTION_IDS, type MochiBotElement, type MoodId } from 'mochis'

/**
 * `#moods`: the real component, with its moods and its interactions wired to the pointer. Hover, tap, double tap,
 * long press, spin fast (drag sideways). The "interactions" box turns everything off; the buttons play a reaction by
 * hand. `?s=<size>`: side of a Mochi; `?theme=dark`.
 */
const SHAPE_LIST = [
  { shape: 'star', color: 'turquoise' },
  { shape: 'circle', color: 'pink' },
  { shape: 'squircle', color: 'amber' }
]

export const Moods: Component<Record<string, never>> = () => {
  const q = new URLSearchParams(location.search)
  const size = Number(q.get('s')) || Math.min(240, Math.max(120, window.innerWidth - 80))
  const theme = q.get('theme') === 'dark' ? 'dark' : 'light'
  const mood = ref<MoodId>('idle')
  const interactions = ref(true)
  const yaw = ref(0)
  const bots: (MochiBotElement | null)[] = []
  const info = computed(() => `${mood.value}${interactions.value ? '' : ' (interactions coupees)'}`)

  // dragging sideways turns the Mochi: a fast turn makes it dizzy (see `yaw`)
  let x0: number | null = null
  const moves = (e: PointerEvent) => {
    if (x0 === null) return
    yaw.value += (e.clientX - x0) * 0.02
    x0 = e.clientX
  }
  const play = (id: string) => bots.forEach((b) => b?.react(id))

  return () =>
    h(
      'div',
      { class: 'p-6', 'data-mood': info.value },
      h(
        'div',
        { class: 'mb-4 flex flex-wrap items-center gap-2 text-sm' },
        MOOD_IDS.map((m) =>
          h('button', { key: m, type: 'button', class: ['rounded border px-2 py-1', mood.value === m ? 'font-bold underline' : ''], onClick: () => (mood.value = m) }, m)
        ),
        h('span', { class: 'mx-2' }, '|'),
        REACTION_IDS.map((r) => h('button', { key: r, type: 'button', class: 'rounded border px-2 py-1', onClick: () => play(r) }, r)),
        h(
          'label',
          { class: 'ml-4' },
          h('input', { type: 'checkbox', checked: interactions.value, onChange: (e: Event) => (interactions.value = (e.target as HTMLInputElement).checked) }),
          ' interactions'
        )
      ),
      h(
        'div',
        { class: 'flex flex-wrap gap-6', style: theme === 'dark' ? 'background:#1b1922;padding:16px;border-radius:16px' : '' },
        SHAPE_LIST.map((f, i) =>
          h(
            'div',
            {
              key: f.shape,
              style: 'touch-action: pan-y; user-select: none',
              onPointerdown: (e: PointerEvent) => (x0 = e.clientX),
              onPointermove: moves,
              onPointerup: () => (x0 = null),
              onPointercancel: () => (x0 = null)
            },
            h('mochi-bot', {
              ref: (el: Element | null) => (bots[i] = el as MochiBotElement | null),
              size: size,
              shape: f.shape,
              color: f.color,
              renderStyle: '3d',
              theme,
              mood: mood.value,
              interactions: interactions.value,
              yaw: yaw.value,
              fps: 24,
              wave: true
            })
          )
        )
      )
    )
}
