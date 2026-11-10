import { computed, ref } from '@/ui/dom/reactif'
import { h, type Composant } from '@/ui/dom/h'
import type { MochiBotElement } from '@/components/mochi-bot'
import '@/components/mochi-bot'
import { MOOD_IDS, REACTION_IDS, type MoodId } from '@/bot/humeurs'

/**
 * `#moods` : le vrai composant, avec ses humeurs et ses interactions branchees sur le pointeur. On y survole, on tape,
 * on double-tape, on appuie longtemps, on tourne vite (glisser sur le cote). La case « interactions » coupe tout ;
 * les boutons jouent une reaction a la main. `?s=<taille>` : cote d'un Mochi ; `?theme=dark`.
 */
const FORMES = [
  { forme: 'etoile', couleur: 'turquoise' },
  { forme: 'cercle', couleur: 'rose' },
  { forme: 'squircle', couleur: 'ambre' }
]

export const Moods: Composant<Record<string, never>> = () => {
  const q = new URLSearchParams(location.search)
  const taille = Number(q.get('s')) || Math.min(240, Math.max(120, window.innerWidth - 80))
  const theme = q.get('theme') === 'dark' ? 'dark' : 'light'
  const humeur = ref<MoodId>('repos')
  const interactions = ref(true)
  const yaw = ref(0)
  const bots: (MochiBotElement | null)[] = []
  const info = computed(() => `${humeur.value}${interactions.value ? '' : ' (interactions coupees)'}`)

  // glisser sur le cote fait tourner le Mochi : un tour rapide rend le Mochi etourdi (cf. `yaw`)
  let x0: number | null = null
  const bouge = (e: PointerEvent) => {
    if (x0 === null) return
    yaw.value += (e.clientX - x0) * 0.02
    x0 = e.clientX
  }
  const jouer = (id: string) => bots.forEach((b) => b?.react(id))

  return () =>
    h(
      'div',
      { class: 'p-6', 'data-humeur': info.value },
      h(
        'div',
        { class: 'mb-4 flex flex-wrap items-center gap-2 text-sm' },
        MOOD_IDS.map((m) =>
          h('button', { key: m, type: 'button', class: ['rounded border px-2 py-1', humeur.value === m ? 'font-bold underline' : ''], onClick: () => (humeur.value = m) }, m)
        ),
        h('span', { class: 'mx-2' }, '|'),
        REACTION_IDS.map((r) => h('button', { key: r, type: 'button', class: 'rounded border px-2 py-1', onClick: () => jouer(r) }, r)),
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
        FORMES.map((f, i) =>
          h(
            'div',
            {
              key: f.forme,
              style: 'touch-action: pan-y; user-select: none',
              onPointerdown: (e: PointerEvent) => (x0 = e.clientX),
              onPointermove: bouge,
              onPointerup: () => (x0 = null),
              onPointercancel: () => (x0 = null)
            },
            h('mochi-bot', {
              ref: (el: Element | null) => (bots[i] = el as MochiBotElement | null),
              size: taille,
              shape: f.forme,
              color: f.couleur,
              rendu: '3d',
              theme,
              mood: humeur.value,
              interactions: interactions.value,
              yaw: yaw.value,
              fps: 24,
              coucou: true
            })
          )
        )
      )
    )
}
