import { computed, ref, watch } from '@/ui/dom/reactive'
import { c, h, onUnmount, onMount, type Component } from '@/ui/dom/h'
import { Poster } from './Poster'
import { Alive } from './Alive'
import { STYLE_BOT } from './posters'
import { useReduced } from './reduced'
import { reveal, useWidth, useVisible } from './motion'
import type { RenderStyleId } from 'mochis/catalogue'

/**
 * The three styles, on scroll: the scene stays stuck while the three steps go by, and the Mochi changes style when a
 * step reaches the middle of the screen. It turns slowly on itself (real 3D, `yaw`) as long as the scene is visible.
 * On a phone, each step carries its own frozen image.
 */
const STEPS: { id: RenderStyleId; name: string; code: string; text: string; background: string }[] = [
  {
    id: '3d',
    name: 'Soft',
    code: 'render-style="3d"',
    text: 'Smooth studio shading, rim glows and a soft highlight, lit the same way from every side. The default.',
    background: 'var(--p-lavande)'
  },
  {
    id: 'pixel3d',
    name: 'Pixel',
    code: 'render-style="pixel3d"',
    text: 'The same 3D model rendered at low resolution, with a short palette and a 1 px outline. A game sprite that can turn around.',
    background: 'var(--p-menthe)'
  },
  {
    id: 'flat3d',
    name: 'Flat',
    code: 'render-style="flat3d"',
    text: 'Two or three flat tones and no gloss, for a bold, graphic look. Add an outline with contour.',
    background: 'var(--p-peche)'
  }
]

export const Styles: Component<Record<string, never>> = () => {
  const reduced = useReduced()
  const width = useWidth()
  const large = computed(() => width.value >= 900)
  const active = ref(0)
  const steps: HTMLElement[] = []
  const scene = ref<HTMLElement | null>(null)
  const visible = useVisible(scene, '100px')

  let obs: IntersectionObserver | null = null
  onMount(() => {
    if (typeof IntersectionObserver === 'undefined') return
    // a step becomes active when it crosses the band in the middle of the screen
    obs = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) active.value = Number((e.target as HTMLElement).dataset.i ?? 0)
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    for (const el of steps) obs.observe(el)
  })

  /** Turntable: a slow back and forth of +-0.55 rad, only when the scene is on screen. */
  const yaw = ref(0)
  let raf = 0
  let t0 = 0
  function rotate(ms: number) {
    if (!t0) t0 = ms
    yaw.value = Math.round(Math.sin(((ms - t0) / 1000) * 0.8) * 0.55 * 400) / 400
    raf = requestAnimationFrame(rotate)
  }
  watch(
    [visible, large, reduced],
    ([v, l, r]) => {
      cancelAnimationFrame(raf)
      raf = 0
      if (v && l && !r) raf = requestAnimationFrame(rotate)
    },
    { immediate: true }
  )
  onUnmount(() => {
    obs?.disconnect()
    cancelAnimationFrame(raf)
  })

  return () => {
    const e = STEPS[active.value]!
    return h(
      'section',
      { id: 'styles', class: 'sec styles', 'aria-labelledby': 't-styles' },
      h(
        'div',
        { class: 'wrap sec-head' },
        h('p', { ref: reveal(), class: 'eyebrow' }, 'Three styles'),
        h('h2', { id: 't-styles', ref: reveal(1), class: 'title-sec' }, 'One model.', h('br'), 'Three looks.'),
        h('p', { ref: reveal(2), class: 'lede' }, 'Every Mochi is a real 3D volume, so it can turn and still be itself. Switch the look with a single prop.')
      ),
      h(
        'div',
        { class: 'wrap styles-track' },
        large.value
          ? h(
              'div',
              { key: 'scene', ref: (el: Element | null) => (scene.value = el as HTMLElement | null), class: 'styles-scene', style: { background: e.background } },
              h('span', { key: active.value, class: 'styles-giant', 'aria-hidden': 'true' }, e.name),
              c(Alive, {
                key: 'alive',
                size: 360,
                poster: `style-${e.id}`,
                yaw: yaw.value,
                alt: `A purple Mochi in the ${e.name} style`,
                bot: { ...STYLE_BOT(e.id), mood: reduced.value ? undefined : 'idle', frozenAt: reduced.value ? 0 : undefined, interactions: false }
              }),
              h(
                'div',
                { key: 'points', class: 'styles-points', 'aria-hidden': 'true' },
                STEPS.map((x, i) => h('span', { key: x.id, class: { on: i === active.value } }))
              )
            )
          : null,
        h(
          'ol',
          { key: 'steps', class: 'styles-steps' },
          STEPS.map((x, i) =>
            h(
              'li',
              {
                key: x.id,
                ref: (el: Element | null) => {
                  if (el) steps[i] = el as HTMLElement
                },
                class: ['step', { on: i === active.value }],
                'data-i': i
              },
              !large.value
                ? h('div', { key: 'img', class: 'step-image', style: { background: x.background } }, c(Poster, { name: `style-mini-${x.id}`, size: 180, alt: `A purple Mochi in the ${x.name} style` }))
                : null,
              h('span', { key: 'n', class: 'step-num' }, `0${i + 1}`),
              h('h3', { key: 'h' }, x.name),
              h('p', { key: 'p' }, x.text),
              h('code', { key: 'c', class: 'puce-code' }, x.code)
            )
          )
        )
      )
    )
  }
}
