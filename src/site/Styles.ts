import { computed, ref, watch } from '@/ui/dom/reactif'
import { c, h, surDemontage, surMontage, type Composant } from '@/ui/dom/h'
import { Affiche } from './Affiche'
import { Vivant } from './Vivant'
import { STYLE_BOT } from './affiches'
import { useReduit } from './reduced'
import { reveal, useLargeur, useVisible } from './motion'
import type { RenduId } from '@/ui/rendu'

/**
 * Les trois styles, au defilement : la scene reste collee pendant que les trois etapes passent, et le Mochi change
 * de style quand une etape arrive au milieu de l'ecran. Il tourne doucement sur lui-meme (vraie 3D, `yaw`) tant que
 * la scene est visible. Sur telephone, chaque etape porte sa propre image figee.
 */
const ETAPES: { id: RenduId; nom: string; code: string; texte: string; fond: string }[] = [
  {
    id: '3d',
    nom: 'Soft',
    code: 'rendu="3d"',
    texte: 'Smooth studio shading, rim glows and a soft highlight, lit the same way from every side. The default.',
    fond: 'var(--p-lavande)'
  },
  {
    id: 'pixel3d',
    nom: 'Pixel',
    code: 'rendu="pixel3d"',
    texte: 'The same 3D model rendered at low resolution, with a short palette and a 1 px outline. A game sprite that can turn around.',
    fond: 'var(--p-menthe)'
  },
  {
    id: 'flat3d',
    nom: 'Flat',
    code: 'rendu="flat3d"',
    texte: 'Two or three flat tones and no gloss, for a bold, graphic look. Add an outline with contour.',
    fond: 'var(--p-peche)'
  }
]

export const Styles: Composant<Record<string, never>> = () => {
  const reduit = useReduit()
  const largeur = useLargeur()
  const large = computed(() => largeur.value >= 900)
  const actif = ref(0)
  const etapes: HTMLElement[] = []
  const scene = ref<HTMLElement | null>(null)
  const visible = useVisible(scene, '100px')

  let obs: IntersectionObserver | null = null
  surMontage(() => {
    if (typeof IntersectionObserver === 'undefined') return
    // une etape devient active quand elle traverse la bande du milieu de l'ecran
    obs = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) actif.value = Number((e.target as HTMLElement).dataset.i ?? 0)
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    for (const el of etapes) obs.observe(el)
  })

  /** Tourne-disque : un aller-retour lent de +-0,55 rad, seulement quand la scene est a l'ecran. */
  const yaw = ref(0)
  let raf = 0
  let t0 = 0
  function tourner(ms: number) {
    if (!t0) t0 = ms
    yaw.value = Math.round(Math.sin(((ms - t0) / 1000) * 0.8) * 0.55 * 400) / 400
    raf = requestAnimationFrame(tourner)
  }
  watch(
    [visible, large, reduit],
    ([v, l, r]) => {
      cancelAnimationFrame(raf)
      raf = 0
      if (v && l && !r) raf = requestAnimationFrame(tourner)
    },
    { immediate: true }
  )
  surDemontage(() => {
    obs?.disconnect()
    cancelAnimationFrame(raf)
  })

  return () => {
    const e = ETAPES[actif.value]!
    return h(
      'section',
      { id: 'styles', class: 'sec styles', 'aria-labelledby': 't-styles' },
      h(
        'div',
        { class: 'wrap sec-tete' },
        h('p', { ref: reveal(), class: 'surtitre' }, 'Three styles'),
        h('h2', { id: 't-styles', ref: reveal(1), class: 'titre-sec' }, 'One model.', h('br'), 'Three looks.'),
        h('p', { ref: reveal(2), class: 'chapo' }, 'Every Mochi is a real 3D volume, so it can turn and still be itself. Switch the look with a single prop.')
      ),
      h(
        'div',
        { class: 'wrap styles-piste' },
        large.value
          ? h(
              'div',
              { key: 'scene', ref: (el: Element | null) => (scene.value = el as HTMLElement | null), class: 'styles-scene', style: { background: e.fond } },
              h('span', { key: actif.value, class: 'styles-geant', 'aria-hidden': 'true' }, e.nom),
              c(Vivant, {
                key: 'vivant',
                taille: 360,
                affiche: `style-${e.id}`,
                yaw: yaw.value,
                alt: `A purple Mochi in the ${e.nom} style`,
                bot: { ...STYLE_BOT(e.id), mood: reduit.value ? undefined : 'repos', frozenAt: reduit.value ? 0 : undefined, interactions: false }
              }),
              h(
                'div',
                { key: 'points', class: 'styles-points', 'aria-hidden': 'true' },
                ETAPES.map((x, i) => h('span', { key: x.id, class: { on: i === actif.value } }))
              )
            )
          : null,
        h(
          'ol',
          { key: 'etapes', class: 'styles-etapes' },
          ETAPES.map((x, i) =>
            h(
              'li',
              {
                key: x.id,
                ref: (el: Element | null) => {
                  if (el) etapes[i] = el as HTMLElement
                },
                class: ['etape', { on: i === actif.value }],
                'data-i': i
              },
              !large.value
                ? h('div', { key: 'img', class: 'etape-image', style: { background: x.fond } }, c(Affiche, { nom: `style-mini-${x.id}`, taille: 180, alt: `A purple Mochi in the ${x.nom} style` }))
                : null,
              h('span', { key: 'n', class: 'etape-num' }, `0${i + 1}`),
              h('h3', { key: 'h' }, x.nom),
              h('p', { key: 'p' }, x.texte),
              h('code', { key: 'c', class: 'puce-code' }, x.code)
            )
          )
        )
      )
    )
  }
}
